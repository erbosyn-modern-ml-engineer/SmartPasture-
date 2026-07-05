import type { GisProbeCell, GisProbeDataset, GisProbeGeometry } from '@/lib/types'

export async function loadGisProbeDataset(): Promise<GisProbeDataset> {
  const response = await fetch('/data/gis_probe_grid.json')
  if (!response.ok) {
    throw new Error(`Failed to load GIS probe grid: ${response.status}`)
  }
  return response.json() as Promise<GisProbeDataset>
}

export function isWithinGisProbeBounds(dataset: GisProbeDataset, lat: number, lon: number): boolean {
  return (
    lat >= dataset.bounds.minLat &&
    lat <= dataset.bounds.maxLat &&
    lon >= dataset.bounds.minLon &&
    lon <= dataset.bounds.maxLon
  )
}

function pointInRing(ring: number[][], lon: number, lat: number): boolean {
  let inside = false

  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [x1, y1] = ring[index]
    const [x2, y2] = ring[previous]
    const intersects = ((y1 > lat) !== (y2 > lat)) && lon < ((x2 - x1) * (lat - y1)) / ((y2 - y1) || Number.EPSILON) + x1
    if (intersects) inside = !inside
  }

  return inside
}

function pointInPolygon(polygon: number[][][], lon: number, lat: number): boolean {
  if (polygon.length === 0) return false
  const [outer, ...holes] = polygon
  if (!pointInRing(outer, lon, lat)) return false
  return !holes.some((hole) => pointInRing(hole, lon, lat))
}

export function isWithinGisProbeAoi(geometry: GisProbeGeometry, lat: number, lon: number): boolean {
  if (geometry.type === 'Polygon') {
    return pointInPolygon(geometry.coordinates, lon, lat)
  }
  return geometry.coordinates.some((polygon) => pointInPolygon(polygon, lon, lat))
}

export function resolveGisProbeCell(dataset: GisProbeDataset, lat: number, lon: number): GisProbeCell | null {
  if (!isWithinGisProbeBounds(dataset, lat, lon) || !isWithinGisProbeAoi(dataset.boundary, lat, lon)) {
    return null
  }

  const col = Math.max(0, Math.min(dataset.cols - 1, Math.round((lon - dataset.bounds.minLon) / dataset.stepDeg)))
  const row = Math.max(0, Math.min(dataset.rows - 1, Math.round((dataset.bounds.maxLat - lat) / dataset.stepDeg)))
  const index = row * dataset.cols + col
  return dataset.cells[index] ?? null
}

export function findBestGisProbeCell(dataset: GisProbeDataset): GisProbeCell | null {
  const populatedCells = dataset.cells.filter((cell): cell is GisProbeCell => cell !== null)
  if (populatedCells.length === 0) {
    return null
  }

  return populatedCells.reduce((best, current) => (
    current.scores.priority > best.scores.priority ? current : best
  ))
}

export function prettifyProbeClass(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

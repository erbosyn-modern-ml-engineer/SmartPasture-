from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import numpy as np
import shapefile
from shapely.geometry import Point, shape as shapely_shape
from shapely.geometry.base import BaseGeometry
from shapely.ops import transform
from shapely.strtree import STRtree
from tifffile import TiffFile


DEFAULT_DATASET_ROOT = Path(r"D:\SmartPasture Datasets")
DEFAULT_BOUNDARY_PATH = Path(__file__).resolve().parents[1] / "public" / "data" / "kyzylorda_boundary.geojson"
DEFAULT_OUTPUT_PATH = Path(__file__).resolve().parents[1] / "public" / "data" / "gis_probe_grid.json"
DEFAULT_STEP_DEG = 0.05

DRIVABLE_ROAD_CLASSES = {
    "motorway",
    "motorway_link",
    "trunk",
    "trunk_link",
    "primary",
    "primary_link",
    "secondary",
    "secondary_link",
    "tertiary",
    "tertiary_link",
    "unclassified",
    "residential",
    "service",
    "track",
    "track_grade1",
    "track_grade2",
    "track_grade3",
    "track_grade4",
    "track_grade5",
}

LANDUSE_SUITABILITY = {
    "open_steppe": 0.74,
    "grass": 0.8,
    "meadow": 0.82,
    "farmland": 0.76,
    "farmyard": 0.7,
    "allotments": 0.62,
    "orchard": 0.58,
    "forest": 0.42,
    "park": 0.34,
    "residential": 0.12,
    "industrial": 0.08,
    "commercial": 0.1,
    "cemetery": 0.12,
}

URBAN_PENALTY = {
    "open_steppe": 0.08,
    "grass": 0.1,
    "meadow": 0.08,
    "farmland": 0.16,
    "farmyard": 0.2,
    "allotments": 0.22,
    "orchard": 0.26,
    "forest": 0.2,
    "park": 0.32,
    "residential": 0.62,
    "industrial": 0.82,
    "commercial": 0.74,
    "cemetery": 0.72,
}

WATER_CLASS_BONUS = {
    "water": 0.95,
    "riverbank": 0.9,
    "river": 0.82,
    "canal": 0.76,
    "drain": 0.6,
    "stream": 0.7,
}


@dataclass(frozen=True)
class GridConfig:
    min_lon: float
    max_lon: float
    min_lat: float
    max_lat: float
    step_deg: float
    rows: int
    cols: int
    km_per_deg_lon: float
    km_per_deg_lat: float


@dataclass(frozen=True)
class DemConfig:
    min_lon: float
    max_lon: float
    min_lat: float
    max_lat: float
    origin_lon: float
    origin_lat: float
    scale_lon: float
    scale_lat: float


def clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, value))


def bbox_intersects(left: Iterable[float], right: Iterable[float]) -> bool:
    left_min_x, left_min_y, left_max_x, left_max_y = left
    right_min_x, right_min_y, right_max_x, right_max_y = right
    return not (
        left_max_x < right_min_x
        or left_min_x > right_max_x
        or left_max_y < right_min_y
        or left_min_y > right_max_y
    )


def score_to_action(priority: float, risk: float, confidence: float) -> str:
    if priority >= 0.78 and risk <= 0.28 and confidence >= 0.68:
        return "INSPECT_FIRST"
    if priority >= 0.56 and risk <= 0.46 and confidence >= 0.5:
        return "INSPECT_WITH_QUICK_VERIFICATION"
    if priority < 0.32 or risk >= 0.78:
        return "NOT_RECOMMENDED_CURRENT_EVIDENCE"
    if risk >= 0.58 or confidence < 0.42:
        return "HUMAN_REVIEW_REQUIRED"
    return "DEFER"


def load_boundary_geometry(boundary_path: Path) -> tuple[dict[str, Any], BaseGeometry]:
    payload = json.loads(boundary_path.read_text(encoding="utf-8"))
    geometry_payload = payload["geometry"] if payload.get("type") == "Feature" else payload
    return payload, shapely_shape(geometry_payload)


def build_grid_config(geometry: BaseGeometry, step_deg: float) -> GridConfig:
    min_lon, min_lat, max_lon, max_lat = geometry.bounds
    mid_lat = (min_lat + max_lat) / 2
    km_per_deg_lat = 110.574
    km_per_deg_lon = 111.320 * math.cos(math.radians(mid_lat))
    cols = int(round((max_lon - min_lon) / step_deg)) + 1
    rows = int(round((max_lat - min_lat) / step_deg)) + 1
    return GridConfig(
        min_lon=min_lon,
        max_lon=max_lon,
        min_lat=min_lat,
        max_lat=max_lat,
        step_deg=step_deg,
        rows=rows,
        cols=cols,
        km_per_deg_lon=km_per_deg_lon,
        km_per_deg_lat=km_per_deg_lat,
    )


def read_dem(dataset_root: Path) -> tuple[np.ndarray, DemConfig]:
    dem_path = dataset_root / "02_dem" / "n44_e065_1arc_v3.tif"
    with TiffFile(dem_path) as tif:
        page = tif.pages[0]
        array = page.asarray()
        scale_lon, scale_lat, _ = page.tags["ModelPixelScaleTag"].value
        _, _, _, origin_lon, origin_lat, _ = page.tags["ModelTiepointTag"].value

    min_lon = origin_lon
    max_lon = origin_lon + scale_lon * (array.shape[1] - 1)
    max_lat = origin_lat
    min_lat = origin_lat - scale_lat * (array.shape[0] - 1)
    return array, DemConfig(
        min_lon=min_lon,
        max_lon=max_lon,
        min_lat=min_lat,
        max_lat=max_lat,
        origin_lon=origin_lon,
        origin_lat=origin_lat,
        scale_lon=scale_lon,
        scale_lat=scale_lat,
    )


def build_projector(config: GridConfig):
    def project_geometry(geometry: BaseGeometry):
        return transform(
            lambda x, y, z=None: (np.asarray(x) * config.km_per_deg_lon, np.asarray(y) * config.km_per_deg_lat),
            geometry,
        )

    return project_geometry


def shape_record_dict(reader: shapefile.Reader, record: Any) -> dict[str, object]:
    fields = [field[0] for field in reader.fields[1:]]
    return dict(zip(fields, record, strict=False))


def load_layer(path: Path, bbox: tuple[float, float, float, float], project_geometry):
    reader = shapefile.Reader(str(path))
    geometries = []
    attributes = []
    for shape_record in reader.iterShapeRecords():
        if not bbox_intersects(shape_record.shape.bbox, bbox):
            continue
        geometry = shapely_shape(shape_record.shape.__geo_interface__)
        if geometry.is_empty:
            continue
        geometries.append(project_geometry(geometry))
        attributes.append(shape_record_dict(reader, shape_record.record))
    return geometries, attributes


def build_tree(geometries):
    return STRtree(geometries) if geometries else None


def nearest_distance(point: Point, geometries, tree: STRtree | None) -> tuple[float, int]:
    if not geometries or tree is None:
        return float("inf"), -1
    index = int(tree.nearest(point))
    return float(point.distance(geometries[index])), index


def containing_index(point: Point, geometries, tree: STRtree | None) -> int:
    if not geometries or tree is None:
        return -1
    for index in tree.query(point):
        if geometries[int(index)].intersects(point):
            return int(index)
    return -1


def has_dem_coverage(dem: DemConfig, lon: float, lat: float) -> bool:
    return dem.min_lon <= lon <= dem.max_lon and dem.min_lat <= lat <= dem.max_lat


def sample_dem(array: np.ndarray, grid: GridConfig, dem: DemConfig, lon: float, lat: float) -> tuple[float, float]:
    col = int(round((lon - dem.origin_lon) / dem.scale_lon))
    row = int(round((dem.origin_lat - lat) / dem.scale_lat))
    row = max(1, min(array.shape[0] - 2, row))
    col = max(1, min(array.shape[1] - 2, col))

    center = float(array[row, col])
    left = float(array[row, col - 1])
    right = float(array[row, col + 1])
    top = float(array[row - 1, col])
    bottom = float(array[row + 1, col])

    cell_size_x_m = dem.scale_lon * grid.km_per_deg_lon * 1000
    cell_size_y_m = dem.scale_lat * grid.km_per_deg_lat * 1000
    dzdx = (right - left) / (2 * cell_size_x_m)
    dzdy = (top - bottom) / (2 * cell_size_y_m)
    slope_percent = math.sqrt(dzdx * dzdx + dzdy * dzdy) * 100
    return center, slope_percent


def water_access_score(distance_km: float, inside_water: bool, water_class: str) -> float:
    if inside_water:
        return 0.0
    distance_score = 1 - clamp(distance_km / 12)
    class_bonus = WATER_CLASS_BONUS.get(water_class, 0.55)
    return clamp(0.72 * distance_score + 0.28 * class_bonus)


def context_score_label(context_score: float, risk: float) -> str:
    if context_score >= 0.68 and risk < 0.45:
        return "favorable"
    if context_score >= 0.45 and risk < 0.7:
        return "mixed"
    return "constrained"


def build_cell(
    lat: float,
    lon: float,
    point_xy: Point,
    elevation_m: float | None,
    slope_percent: float | None,
    has_dem: bool,
    road_geometries,
    road_attributes,
    road_tree: STRtree | None,
    water_geometries,
    water_attributes,
    water_tree: STRtree | None,
    landuse_geometries,
    landuse_attributes,
    landuse_tree: STRtree | None,
):
    road_distance_km, road_index = nearest_distance(point_xy, road_geometries, road_tree)
    water_distance_km, water_index = nearest_distance(point_xy, water_geometries, water_tree)
    landuse_index = containing_index(point_xy, landuse_geometries, landuse_tree)

    road_class = str(road_attributes[road_index]["fclass"]) if road_index >= 0 else "unknown"
    water_class = str(water_attributes[water_index]["fclass"]) if water_index >= 0 else "unknown"
    landuse_class = str(landuse_attributes[landuse_index]["fclass"]) if landuse_index >= 0 else "open_steppe"
    inside_water = water_index >= 0 and water_geometries[water_index].contains(point_xy)

    road_access = 1 - clamp(road_distance_km / 10)
    hydro_score = water_access_score(water_distance_km, inside_water, water_class)
    landuse_score = LANDUSE_SUITABILITY.get(landuse_class, LANDUSE_SUITABILITY["open_steppe"])
    urban_penalty = URBAN_PENALTY.get(landuse_class, URBAN_PENALTY["open_steppe"])
    terrain_score = None if slope_percent is None else 1 - clamp(slope_percent / 6)

    context_components = [
        (0.34, hydro_score),
        (0.28, road_access),
        (0.22, landuse_score),
    ]
    if terrain_score is not None:
        context_components.append((0.16, terrain_score))
    context_weight = sum(weight for weight, _ in context_components)
    context_score = clamp(sum(weight * value for weight, value in context_components) / context_weight)

    risk = clamp(
        (0.46 if inside_water else 0.0)
        + 0.24 * urban_penalty
        + 0.18 * clamp(road_distance_km / 12)
        + (0.12 * clamp((slope_percent or 0.0) / 8) if terrain_score is not None else 0.0)
    )

    confidence_components = [
        (0.28, 1 - urban_penalty),
        (0.28, road_access),
        (0.24, hydro_score),
    ]
    if terrain_score is not None:
        confidence_components.append((0.2, terrain_score))
    confidence_weight = sum(weight for weight, _ in confidence_components)
    confidence = sum(weight * value for weight, value in confidence_components) / confidence_weight
    if terrain_score is None:
        confidence -= 0.18
    if inside_water:
        confidence -= 0.16
    confidence = clamp(confidence)

    priority = clamp(0.42 * context_score + 0.23 * confidence + 0.35 * (1 - risk))
    action_id = score_to_action(priority, risk, confidence)

    return {
        "lat": round(lat, 6),
        "lon": round(lon, 6),
        "elevationM": None if elevation_m is None else round(elevation_m, 1),
        "slopePct": None if slope_percent is None else round(slope_percent, 3),
        "roadKm": round(road_distance_km, 3),
        "waterKm": round(water_distance_km, 3),
        "roadClass": road_class,
        "waterClass": water_class,
        "landuseClass": landuse_class,
        "insideWater": inside_water,
        "hasDem": has_dem,
        "evidenceLevel": "full" if has_dem else "partial",
        "contextScoreLabel": context_score_label(context_score, risk),
        "scores": {
            "contextScore": round(context_score, 4),
            "risk": round(risk, 4),
            "confidence": round(confidence, 4),
            "priority": round(priority, 4),
        },
        "actionId": action_id,
    }


def build_grid(
    dataset_root: Path,
    output_path: Path,
    boundary_path: Path = DEFAULT_BOUNDARY_PATH,
    step_deg: float = DEFAULT_STEP_DEG,
) -> None:
    boundary_feature, boundary_geometry = load_boundary_geometry(boundary_path)
    grid = build_grid_config(boundary_geometry, step_deg)
    boundary_projector = build_projector(grid)
    aoi_projected = boundary_projector(boundary_geometry)
    bbox = (grid.min_lon, grid.min_lat, grid.max_lon, grid.max_lat)

    dem_array, dem = read_dem(dataset_root)

    roads_path = dataset_root / "05_roads" / "kazakhstan-260330-free.shp" / "gis_osm_roads_free_1.shp"
    waterways_path = dataset_root / "05_roads" / "kazakhstan-260330-free.shp" / "gis_osm_waterways_free_1.shp"
    water_polygons_path = dataset_root / "05_roads" / "kazakhstan-260330-free.shp" / "gis_osm_water_a_free_1.shp"
    landuse_path = dataset_root / "05_roads" / "kazakhstan-260330-free.shp" / "gis_osm_landuse_a_free_1.shp"

    print("Loading roads...")
    road_geometries, road_attributes = load_layer(roads_path, bbox, boundary_projector)
    filtered_road_geometries = []
    filtered_road_attributes = []
    for geometry, attributes in zip(road_geometries, road_attributes, strict=False):
        if attributes.get("fclass") in DRIVABLE_ROAD_CLASSES:
            filtered_road_geometries.append(geometry)
            filtered_road_attributes.append(attributes)

    print("Loading water polygons...")
    water_polygon_geometries, water_polygon_attributes = load_layer(water_polygons_path, bbox, boundary_projector)
    print("Loading waterways...")
    waterway_geometries, waterway_attributes = load_layer(waterways_path, bbox, boundary_projector)
    print("Loading landuse...")
    landuse_geometries, landuse_attributes = load_layer(landuse_path, bbox, boundary_projector)

    road_tree = build_tree(filtered_road_geometries)
    water_geometries = [*water_polygon_geometries, *waterway_geometries]
    water_attributes = [*water_polygon_attributes, *waterway_attributes]
    water_tree = build_tree(water_geometries)
    landuse_tree = build_tree(landuse_geometries)

    print("Building province-wide grid...")
    cells: list[dict[str, Any] | None] = []
    populated_cells = 0
    full_evidence_cells = 0
    for row in range(grid.rows):
        lat = grid.max_lat - row * grid.step_deg
        for col in range(grid.cols):
            lon = grid.min_lon + col * grid.step_deg
            point_geo = Point(lon, lat)
            if not boundary_geometry.covers(point_geo):
                cells.append(None)
                continue

            populated_cells += 1
            point_xy = Point(lon * grid.km_per_deg_lon, lat * grid.km_per_deg_lat)
            if has_dem_coverage(dem, lon, lat):
                elevation_m, slope_percent = sample_dem(dem_array, grid, dem, lon, lat)
                full_evidence_cells += 1
            else:
                elevation_m = None
                slope_percent = None

            cells.append(
                build_cell(
                    lat=lat,
                    lon=lon,
                    point_xy=point_xy,
                    elevation_m=elevation_m,
                    slope_percent=slope_percent,
                    has_dem=elevation_m is not None,
                    road_geometries=filtered_road_geometries,
                    road_attributes=filtered_road_attributes,
                    road_tree=road_tree,
                    water_geometries=water_geometries,
                    water_attributes=water_attributes,
                    water_tree=water_tree,
                    landuse_geometries=landuse_geometries,
                    landuse_attributes=landuse_attributes,
                    landuse_tree=landuse_tree,
                )
            )

    payload = {
        "meta": {
            "name": "Kyzylorda province GIS screening grid",
            "description": "Province-wide GIS screening grid derived from AOI, roads, water, landuse, and partial DEM coverage.",
            "sourceLayers": [
                boundary_path.name,
                roads_path.name,
                waterways_path.name,
                water_polygons_path.name,
                landuse_path.name,
                "n44_e065_1arc_v3.tif (partial coverage)",
            ],
            "generatedWithStepDegrees": step_deg,
        },
        "boundary": boundary_feature["geometry"] if boundary_feature.get("type") == "Feature" else boundary_feature,
        "bounds": {
            "minLat": round(grid.min_lat, 6),
            "maxLat": round(grid.max_lat, 6),
            "minLon": round(grid.min_lon, 6),
            "maxLon": round(grid.max_lon, 6),
        },
        "rows": grid.rows,
        "cols": grid.cols,
        "stepDeg": grid.step_deg,
        "cells": cells,
        "summary": {
            "aoiCells": populated_cells,
            "fullEvidenceCells": full_evidence_cells,
            "partialEvidenceCells": populated_cells - full_evidence_cells,
        },
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(
        f"Saved {populated_cells} AOI cells ({full_evidence_cells} full / {populated_cells - full_evidence_cells} partial) to {output_path}"
    )


if __name__ == "__main__":
    build_grid(DEFAULT_DATASET_ROOT, DEFAULT_OUTPUT_PATH)

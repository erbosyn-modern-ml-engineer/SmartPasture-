const booleanValues = new Set(['1', 'true', 'yes', 'on'])

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback
  return booleanValues.has(value.toLowerCase())
}

export const env = {
  appEnv: import.meta.env.VITE_APP_ENV || import.meta.env.MODE || 'local',
  mapTileUrl: import.meta.env.VITE_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  analyticsEnabled: readBoolean(import.meta.env.VITE_ANALYTICS_ENABLED, false),
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '',
  demoModeEnabled: readBoolean(import.meta.env.VITE_ENABLE_DEMO_MODE, true),
  publicSiteUrl: import.meta.env.VITE_PUBLIC_SITE_URL || 'https://smartpasture.example.com',
}

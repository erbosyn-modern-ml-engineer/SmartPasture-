const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on'])

function readFlag(value: string | undefined): boolean {
  return Boolean(value && ENABLED_VALUES.has(value.toLowerCase()))
}

/**
 * Experimental ML screens are intentionally disabled for public users.
 * They can only be restored for internal development after setting
 * VITE_ENABLE_EXPERIMENTAL_ML_UI=true at build time.
 */
export const featureFlags = Object.freeze({
  experimentalMlUi: readFlag(import.meta.env.VITE_ENABLE_EXPERIMENTAL_ML_UI),
})

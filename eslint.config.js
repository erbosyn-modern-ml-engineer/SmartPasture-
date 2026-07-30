import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // The Expo prototype is a separate JavaScript application with its own toolchain.
  // Root quality checks cover the Vite/TypeScript web application only.
  globalIgnores(['dist', 'smartpasture-expo/**']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Selection state on map/validation pages intentionally follows a filtered
      // external dataset. These effects keep a valid selected item after filters change.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])

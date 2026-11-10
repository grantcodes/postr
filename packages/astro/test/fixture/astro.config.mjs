import { defineConfig } from 'astro/config'

// Resolve @postr/core to its TypeScript source, like the package tests do. Astro runs the
// content config in its own `astro` Vite environment.
const resolve = {
  conditions: ['@postr/source', 'module', 'node', 'development|production'],
  externalConditions: ['@postr/source', 'node'],
}

export default defineConfig({
  site: 'https://example.com',
  vite: { environments: { astro: { resolve } } },
})

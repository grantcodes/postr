#!/usr/bin/env node

/**
 * publish-release-please-packages.mjs
 *
 * Publishes only the packages that release-please just released.
 * Called from CI after release-please-action creates releases.
 *
 * Usage:
 *   node scripts/publish-release-please-packages.mjs <next|latest>
 *
 * Environment:
 *   PATHS_RELEASED  – JSON array of released package paths, e.g.
 *                     '["packages/core","packages/plugin"]'
 *                     (from steps.release.outputs.paths_released)
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ── Package path → npm name mapping ──────────────────────────────────
// Include ALL publishable workspace packages so we can validate/reject
// unknown released paths. The paths here must match the keys in
// .release-please-manifest.json and release-please-config.json.
const PACKAGE_MAP = {
  'packages/core': '@postr/core',
  'packages/plugin': '@postr/plugin',
  'packages/plugin-feeds': '@postr/plugin-feeds',
  'packages/plugin-webmention-endpoint': '@postr/plugin-webmention-endpoint',
  'packages/syndicator': '@postr/syndicator',
  'packages/syndicator-instagram': '@postr/syndicator-instagram',
  'packages/syndicator-superfeedr': '@postr/syndicator-superfeedr',
  'packages/syndicator-telegram': '@postr/syndicator-telegram',
}

const VALID_TAGS = ['next', 'latest']

// ── Helpers ──────────────────────────────────────────────────────────

function fail(msg) {
  console.error(`ERROR: ${msg}`)
  process.exit(1)
}

function getPackageVersion(pkgPath) {
  const manifestPath = resolve(ROOT, pkgPath, 'package.json')
  if (!existsSync(manifestPath)) {
    fail(`Package manifest not found at ${manifestPath}`)
  }
  const pkg = JSON.parse(readFileSync(manifestPath, 'utf8'))
  return pkg.version
}

function isPrereleaseVersion(version) {
  return version.includes('-')
}

// ── Main ─────────────────────────────────────────────────────────────

function main() {
  // 1. Validate CLI argument
  const distTag = process.argv[2]
  if (!distTag) {
    fail('Missing required argument: <next|latest>')
  }
  if (!VALID_TAGS.includes(distTag)) {
    fail(`Invalid dist-tag "${distTag}". Must be one of: ${VALID_TAGS.join(', ')}`)
  }

  // 2. Read released paths
  const pathsReleased = (process.env.PATHS_RELEASED || '').trim()
  if (!pathsReleased) {
    fail('PATHS_RELEASED is empty, but this step only runs when releases_created=true. ' +
         'Either releases were created without reported paths (a release-please bug) ' +
         'or the workflow guard is misconfigured.')
  }

  let releasedPaths
  try {
    releasedPaths = JSON.parse(pathsReleased)
  } catch (err) {
    fail(`PATHS_RELEASED is not valid JSON: ${err.message}\n  Raw value: ${pathsReleased}`)
  }
  if (!Array.isArray(releasedPaths)) {
    fail(`PATHS_RELEASED is not a JSON array. Got: ${typeof releasedPaths}`)
  }
  console.log(`Processing ${releasedPaths.length} released package(s): ${releasedPaths.join(', ')}`)

  // 3. Validate every released path
  for (const pkgPath of releasedPaths) {
    if (!PACKAGE_MAP[pkgPath]) {
      fail(`Unknown released path "${pkgPath}". Allowed paths: ${Object.keys(PACKAGE_MAP).join(', ')}`)
    }
    const version = getPackageVersion(pkgPath)
    console.log(`  ${pkgPath} → ${PACKAGE_MAP[pkgPath]}@${version}`)

    // Guard: dev (next tag) must produce prerelease versions
    if (distTag === 'next' && !isPrereleaseVersion(version)) {
      fail(`Package ${PACKAGE_MAP[pkgPath]}@${version} is NOT a prerelease version but dist-tag is "next". Refusing to publish.`)
    }

    // Guard: stable (latest tag) must NOT produce prerelease versions
    if (distTag === 'latest' && isPrereleaseVersion(version)) {
      fail(`Package ${PACKAGE_MAP[pkgPath]}@${version} IS a prerelease version but dist-tag is "latest". Refusing to publish.`)
    }
  }

  // 4. Publish each released package
  console.log(`\nPublishing with dist-tag "${distTag}" ...`)
  for (const pkgPath of releasedPaths) {
    const pkgName = PACKAGE_MAP[pkgPath]
    const version = getPackageVersion(pkgPath)
    console.log(`  Publishing ${pkgName}@${version} --tag ${distTag} ...`)

    try {
      execSync(
        `pnpm --filter "${pkgName}" publish --no-git-checks --access public --tag "${distTag}" --provenance`,
        {
          cwd: ROOT,
          stdio: 'inherit',
          env: {
            ...process.env,
            NPM_CONFIG_PROVENANCE: 'true',
          },
        }
      )
      console.log(`  ✓ ${pkgName}@${version} published to tag "${distTag}"`)
    } catch (err) {
      fail(`Failed to publish ${pkgName}@${version}: ${err.message}`)
    }
  }

  console.log('\nAll released packages published successfully.')
}

main()

/**
 * Generates e2b-template/package.json and e2b-template/baked-manifest.json
 * from the runtime version maps, so the prebaked E2B template can never
 * silently drift from what the preview route actually installs.
 *
 * Sources (parsed, never hand-copied):
 *   - SANDBOX_VERIFIED_VERSIONS        app/api/sandbox/route.ts (wins on conflicts —
 *     the preview route normalizes incoming package.json to these before install)
 *   - GENERATED_APP_DEPENDENCY_VERSIONS + createPackageJson()
 *     lib/generated-project-validation.ts (react, react-dom, typescript, @types/*)
 *
 * Neither source file is importable from Node directly (route.ts pulls in
 * firebase-admin side effects, both are TypeScript), so the const declarations
 * are extracted with targeted parsing. Any structural change to those
 * declarations makes this script fail loudly rather than emit a stale template.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const ROUTE_FILE = path.join(ROOT, "app", "api", "sandbox", "route.ts")
const VALIDATION_FILE = path.join(ROOT, "lib", "generated-project-validation.ts")
const OUT_DIR = path.join(ROOT, "e2b-template")

function fail(message) {
  console.error(`[generate-template] ERROR: ${message}`)
  process.exit(1)
}

const VERSION_RE = /^(?:[\^~]?\d+\.\d+\.\d+(?:[-+][\w.]+)?|\d+\.x|\*)$/

function assertVersion(name, version, source) {
  if (!VERSION_RE.test(version)) {
    fail(`Suspicious version "${version}" for "${name}" parsed from ${source}`)
  }
}

/** Returns the balanced `{ ... }` block starting at the first `{` after `anchorRe`. */
function extractBraceBlock(source, anchorRe, label) {
  const anchor = anchorRe.exec(source)
  if (!anchor) fail(`Could not find ${label}`)
  const open = source.indexOf("{", anchor.index + anchor[0].length - 1)
  if (open === -1) fail(`No opening brace after ${label}`)
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++
    else if (source[i] === "}") {
      depth--
      if (depth === 0) return source.slice(open, i + 1)
    }
  }
  fail(`Unbalanced braces in ${label}`)
}

function stripLineComments(block) {
  return block
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("//")
      return idx === -1 ? line : line.slice(0, idx)
    })
    .join("\n")
}

/** Parses `name: "version"` / `"name": "version"` entries out of an object literal. */
function parseLiteralEntries(block, label) {
  const entries = {}
  const entryRe = /(?:"([^"]+)"|([A-Za-z_$][\w$]*))\s*:\s*"([^"]+)"/g
  let match
  for (const line of stripLineComments(block).split("\n")) {
    entryRe.lastIndex = 0
    while ((match = entryRe.exec(line))) {
      const name = match[1] ?? match[2]
      const version = match[3]
      assertVersion(name, version, label)
      entries[name] = version
    }
  }
  if (Object.keys(entries).length === 0) fail(`Parsed zero entries from ${label}`)
  return entries
}

// --- 1. SANDBOX_VERIFIED_VERSIONS (source of truth, wins on conflict) -------
const routeSource = readFileSync(ROUTE_FILE, "utf8")
const verifiedBlock = extractBraceBlock(
  routeSource,
  /const SANDBOX_VERIFIED_VERSIONS\s*:\s*Record<string,\s*string>\s*=\s*\{/,
  "SANDBOX_VERIFIED_VERSIONS in app/api/sandbox/route.ts"
)
const sandboxVerified = parseLiteralEntries(verifiedBlock, "SANDBOX_VERIFIED_VERSIONS")

// --- 2. GENERATED_APP_DEPENDENCY_VERSIONS -----------------------------------
const validationSource = readFileSync(VALIDATION_FILE, "utf8")
const generatedBlock = extractBraceBlock(
  validationSource,
  /export const GENERATED_APP_DEPENDENCY_VERSIONS\s*:\s*Record<string,\s*string>\s*=\s*\{/,
  "GENERATED_APP_DEPENDENCY_VERSIONS in lib/generated-project-validation.ts"
)
const generatedVersions = parseLiteralEntries(generatedBlock, "GENERATED_APP_DEPENDENCY_VERSIONS")

// --- 3. createPackageJson(): react/react-dom + devDependencies --------------
const createPkgBlock = extractBraceBlock(
  validationSource,
  /function createPackageJson\(\)\s*\{/,
  "createPackageJson in lib/generated-project-validation.ts"
)
const scaffoldDepsBlock = extractBraceBlock(
  createPkgBlock,
  /dependencies\s*:\s*\{/,
  "createPackageJson dependencies"
)
const scaffoldDevBlock = extractBraceBlock(
  createPkgBlock,
  /devDependencies\s*:\s*\{/,
  "createPackageJson devDependencies"
)
const scaffoldDeps = parseLiteralEntries(scaffoldDepsBlock, "createPackageJson dependencies")

// devDependencies mixes literal versions with GENERATED_APP_DEPENDENCY_VERSIONS
// references — resolve both.
const scaffoldDevDeps = {}
const devEntryRe =
  /(?:"([^"]+)"|([A-Za-z_$][\w$]*))\s*:\s*(?:"([^"]+)"|GENERATED_APP_DEPENDENCY_VERSIONS(?:\.([\w-]+)|\["([^"]+)"\]))/g
let devMatch
const cleanDevBlock = stripLineComments(scaffoldDevBlock)
while ((devMatch = devEntryRe.exec(cleanDevBlock))) {
  const name = devMatch[1] ?? devMatch[2]
  const literal = devMatch[3]
  const refKey = devMatch[4] ?? devMatch[5]
  const version = literal ?? generatedVersions[refKey]
  if (!version) fail(`createPackageJson devDependencies: could not resolve version for "${name}" (ref: ${refKey})`)
  assertVersion(name, version, "createPackageJson devDependencies")
  scaffoldDevDeps[name] = version
}
if (Object.keys(scaffoldDevDeps).length === 0) fail("Parsed zero entries from createPackageJson devDependencies")

for (const required of ["react", "react-dom"]) {
  if (!scaffoldDeps[required]) fail(`createPackageJson dependencies missing "${required}"`)
}
for (const required of ["typescript", "vite", "@types/react", "@types/react-dom"]) {
  if (!scaffoldDevDeps[required]) fail(`createPackageJson devDependencies missing "${required}"`)
}

// --- 4. Merge: generated map + scaffold, SANDBOX_VERIFIED_VERSIONS wins -----
const merged = {
  ...generatedVersions,
  ...scaffoldDeps,
  ...scaffoldDevDeps,
  ...sandboxVerified,
}

const devDepNames = new Set(Object.keys(scaffoldDevDeps))
const dependencies = {}
const devDependencies = {}
for (const name of Object.keys(merged).sort()) {
  if (devDepNames.has(name)) devDependencies[name] = merged[name]
  else dependencies[name] = merged[name]
}

// --- 5. Write outputs --------------------------------------------------------
mkdirSync(OUT_DIR, { recursive: true })

// This package.json only exists to bake node_modules into the template image.
// At preview time the generated project's package.json overwrites it.
const templatePackageJson = {
  name: "lotus-vite-web-template",
  version: "0.0.0",
  private: true,
  scripts: { dev: "vite" },
  dependencies,
  devDependencies,
}

const manifest = {
  bakedAt: new Date().toISOString(),
  dependencies: Object.fromEntries(Object.keys(merged).sort().map((name) => [name, merged[name]])),
}

const pkgPath = path.join(OUT_DIR, "package.json")
const manifestPath = path.join(OUT_DIR, "baked-manifest.json")
writeFileSync(pkgPath, JSON.stringify(templatePackageJson, null, 2) + "\n")
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n")

console.log(`[generate-template] SANDBOX_VERIFIED_VERSIONS: ${Object.keys(sandboxVerified).length} entries`)
console.log(`[generate-template] GENERATED_APP_DEPENDENCY_VERSIONS: ${Object.keys(generatedVersions).length} entries`)
console.log(`[generate-template] createPackageJson: ${Object.keys(scaffoldDeps).length} deps, ${Object.keys(scaffoldDevDeps).length} devDeps`)
console.log(`[generate-template] Baked dependency set (${Object.keys(merged).length} packages):`)
for (const [name, version] of Object.entries(manifest.dependencies)) {
  console.log(`  ${name}@${version}`)
}
console.log(`[generate-template] Wrote ${path.relative(ROOT, pkgPath)}`)
console.log(`[generate-template] Wrote ${path.relative(ROOT, manifestPath)}`)

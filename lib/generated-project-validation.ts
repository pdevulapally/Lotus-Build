export type GeneratedProjectFile = {
  path: string
  content: string
}

export type GeneratedProjectIssue = {
  code:
    | "missing-package-json"
    | "missing-required-file"
    | "missing-relative-import"
    | "missing-asset"
    | "invalid-package-json"
    | "missing-package-dependency"
  message: string
  filePath?: string
  importPath?: string
  packageName?: string
}

export const GENERATED_APP_DEPENDENCY_VERSIONS: Record<string, string> = {
  vite: "^5.4.11",
  "@vitejs/plugin-react": "^4.3.4",
  tailwindcss: "^3.4.17",
  postcss: "^8.4.49",
  autoprefixer: "^10.4.20",
  "react-icons": "^5.0.0",
  "framer-motion": "12.39.0",
  "lucide-react": "1.16.0",
}

const REQUIRED_NEW_APP_FILES = [
  "package.json",
  "vite.config.ts",
  "tailwind.config.ts",
  "postcss.config.js",
  "index.html",
  "src/main.tsx",
  "src/App.tsx",
  "src/index.css",
]

const CODE_FILE_RE = /\.(tsx?|jsx?)$/i
const ASSET_REFERENCE_RE = /["'](?:\/|\.\/|\.\.\/)[^"']+\.(svg|png|jpg|jpeg|webp|gif|ico)["']/gi
const NPM_IMPORT_RE =
  /(?:import\s+(?:type\s+)?(?:[^"']*?\s+from\s*)?["']([^."'\/][^"']*)["']|require\(\s*["']([^."'\/][^"']*)["']\s*\)|import\(\s*["']([^."'\/][^"']*)["']\s*\))/g

function normalizePath(path: string) {
  return path.replace(/\\/g, "/").replace(/^\/+/, "").trim()
}

function dedupeFiles(files: GeneratedProjectFile[]) {
  const byPath = new Map<string, GeneratedProjectFile>()
  for (const file of files) {
    if (!file || typeof file.content !== "string") continue
    const path = typeof file.path === "string" ? normalizePath(file.path) : ""
    if (!path) continue
    byPath.set(path, { ...file, path })
  }
  return Array.from(byPath.values())
}

export function resolveRelativeImport(importerPath: string, relativePath: string) {
  const normalizedImporter = normalizePath(importerPath)
  const baseDir = normalizedImporter.includes("/")
    ? normalizedImporter.slice(0, normalizedImporter.lastIndexOf("/"))
    : ""
  const parts: string[] = []

  for (const part of `${baseDir}/${relativePath}`.split("/")) {
    if (!part || part === ".") continue
    if (part === "..") {
      parts.pop()
      continue
    }
    parts.push(part)
  }

  return parts.join("/")
}

export function getRelativeImportCandidates(importerPath: string, relativePath: string) {
  const resolved = resolveRelativeImport(importerPath, relativePath)
  return [
    resolved,
    `${resolved}.ts`,
    `${resolved}.tsx`,
    `${resolved}.js`,
    `${resolved}.jsx`,
    `${resolved}.css`,
    `${resolved}/index.ts`,
    `${resolved}/index.tsx`,
    `${resolved}/index.js`,
    `${resolved}/index.jsx`,
  ]
}

function getImporterDir(path: string) {
  const normalized = normalizePath(path)
  return normalized.includes("/") ? normalized.slice(0, normalized.lastIndexOf("/")) : ""
}

function normalizeAssetReference(filePath: string, assetPath: string) {
  if (assetPath.startsWith("/")) return `public${assetPath}`
  return resolveRelativeImport(`${getImporterDir(filePath)}/_file.tsx`, assetPath)
}

function getPackageName(specifier: string) {
  if (!specifier || specifier.startsWith(".") || specifier.startsWith("/") || specifier.includes("://")) {
    return ""
  }
  return specifier.startsWith("@")
    ? specifier.split("/").slice(0, 2).join("/")
    : specifier.split("/")[0]
}

export function extractNpmPackages(files: GeneratedProjectFile[]) {
  const packages = new Set<string>()
  for (const file of files) {
    if (!CODE_FILE_RE.test(file.path)) continue
    let match: RegExpExecArray | null
    NPM_IMPORT_RE.lastIndex = 0
    while ((match = NPM_IMPORT_RE.exec(file.content)) !== null) {
      const packageName = getPackageName(match[1] || match[2] || match[3] || "")
      if (packageName) packages.add(packageName)
    }
  }
  return Array.from(packages).sort()
}

function parsePackageJson(files: GeneratedProjectFile[]) {
  const packageFile = files.find((file) => file.path === "package.json")
  if (!packageFile) return { packageFile: null, packageJson: null, parseError: false }
  try {
    return { packageFile, packageJson: JSON.parse(packageFile.content) as Record<string, any>, parseError: false }
  } catch {
    return { packageFile, packageJson: null, parseError: true }
  }
}

function stringifyPackageJson(pkg: Record<string, any>) {
  return `${JSON.stringify(pkg, null, 2)}\n`
}

function createPackageJson() {
  return {
    scripts: {
      dev: "vite --host 0.0.0.0 --port 3000",
      build: "vite build",
      preview: "vite preview --host 0.0.0.0 --port 3000",
    },
    dependencies: {
      react: "^18.3.1",
      "react-dom": "^18.3.1",
    },
    devDependencies: {
      "@vitejs/plugin-react": GENERATED_APP_DEPENDENCY_VERSIONS["@vitejs/plugin-react"],
      autoprefixer: GENERATED_APP_DEPENDENCY_VERSIONS.autoprefixer,
      postcss: GENERATED_APP_DEPENDENCY_VERSIONS.postcss,
      tailwindcss: GENERATED_APP_DEPENDENCY_VERSIONS.tailwindcss,
      typescript: "^5.6.3",
      vite: GENERATED_APP_DEPENDENCY_VERSIONS.vite,
      "@types/react": "^18.3.12",
      "@types/react-dom": "^18.3.1",
    },
  }
}

function ensurePackageJson(files: GeneratedProjectFile[]) {
  const nextFiles = [...files]
  const importedPackages = extractNpmPackages(nextFiles)
  const parsed = parsePackageJson(nextFiles)
  const packageJson = parsed.packageJson ?? createPackageJson()
  let changed = !parsed.packageFile || parsed.parseError

  const dependencies = packageJson.dependencies && typeof packageJson.dependencies === "object"
    ? packageJson.dependencies
    : {}
  const devDependencies = packageJson.devDependencies && typeof packageJson.devDependencies === "object"
    ? packageJson.devDependencies
    : {}

  packageJson.dependencies = dependencies
  packageJson.devDependencies = devDependencies

  for (const [packageName, version] of Object.entries({
    react: dependencies.react || "^18.3.1",
    "react-dom": dependencies["react-dom"] || "^18.3.1",
  })) {
    if (!dependencies[packageName]) {
      dependencies[packageName] = version
      changed = true
    }
  }

  for (const packageName of importedPackages) {
    if (packageName === "react" || packageName === "react-dom") continue
    if (dependencies[packageName] || devDependencies[packageName]) continue
    dependencies[packageName] = GENERATED_APP_DEPENDENCY_VERSIONS[packageName] ?? "latest"
    changed = true
  }

  for (const [packageName, version] of Object.entries(GENERATED_APP_DEPENDENCY_VERSIONS)) {
    const target = packageName === "vite" ||
      packageName === "@vitejs/plugin-react" ||
      packageName === "tailwindcss" ||
      packageName === "postcss" ||
      packageName === "autoprefixer"
      ? devDependencies
      : dependencies

    if (target[packageName] && target[packageName] !== version) {
      target[packageName] = version
      changed = true
    }
  }

  const scripts = packageJson.scripts && typeof packageJson.scripts === "object" ? packageJson.scripts : {}
  if (typeof scripts.dev !== "string" || !scripts.dev.trim()) {
    scripts.dev = "vite --host 0.0.0.0 --port 3000"
    changed = true
  }
  if (typeof scripts.build !== "string" || !scripts.build.trim()) {
    scripts.build = "vite build"
    changed = true
  }
  packageJson.scripts = scripts

  const packageFile = { path: "package.json", content: stringifyPackageJson(packageJson) }
  const index = nextFiles.findIndex((file) => file.path === "package.json")
  if (index === -1) nextFiles.unshift(packageFile)
  else if (changed) nextFiles[index] = packageFile

  return nextFiles
}

export function ensureGeneratedProjectScaffold(files: GeneratedProjectFile[]) {
  const nextFiles = ensurePackageJson(dedupeFiles(files))
  const byPath = new Map(nextFiles.map((file) => [file.path, file]))

  if (!byPath.has("vite.config.ts")) {
    byPath.set("vite.config.ts", {
      path: "vite.config.ts",
      content: `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({\n  plugins: [react()],\n  server: { host: '0.0.0.0', port: 3000 },\n})\n`,
    })
  }

  if (!byPath.has("tailwind.config.ts")) {
    byPath.set("tailwind.config.ts", {
      path: "tailwind.config.ts",
      content: `import type { Config } from 'tailwindcss'\n\nexport default {\n  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],\n  theme: { extend: {} },\n  plugins: [],\n} satisfies Config\n`,
    })
  }

  if (!byPath.has("postcss.config.js")) {
    byPath.set("postcss.config.js", {
      path: "postcss.config.js",
      content: `module.exports = {\n  plugins: { tailwindcss: {}, autoprefixer: {} },\n}\n`,
    })
  }

  if (!byPath.has("index.html")) {
    byPath.set("index.html", {
      path: "index.html",
      content: `<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <title>Lotus Build App</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>\n`,
    })
  }

  const indexCss = byPath.get("src/index.css")
  const tailwindDirectives = "@tailwind base;\n@tailwind components;\n@tailwind utilities;"
  if (!indexCss) {
    byPath.set("src/index.css", {
      path: "src/index.css",
      content: `${tailwindDirectives}\n\n:root {\n  --radius: 12px;\n}\n\nbody {\n  margin: 0;\n}\n`,
    })
  } else if (!indexCss.content.includes("@tailwind")) {
    byPath.set("src/index.css", {
      ...indexCss,
      content: `${tailwindDirectives}\n\n${indexCss.content}`,
    })
  }

  const main = byPath.get("src/main.tsx") ?? byPath.get("src/main.jsx")
  if (main && !main.content.includes("index.css")) {
    byPath.set(main.path, {
      ...main,
      content: `import './index.css'\n${main.content}`,
    })
  } else if (!main && byPath.has("src/App.tsx")) {
    byPath.set("src/main.tsx", {
      path: "src/main.tsx",
      content: `import React from 'react'\nimport { createRoot } from 'react-dom/client'\nimport './index.css'\nimport App from './App'\n\ncreateRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n)\n`,
    })
  }

  return Array.from(byPath.values())
}

const NON_CODE_IMPORT_RE = /\.(css|scss|sass|less|json|svg|png|jpe?g|webp|gif|ico|avif|mp4|webm|woff2?|ttf)$/i
const IMPORT_CLAUSE_RE =
  /import\s+(?:type\s+)?(?:([A-Za-z0-9_$]+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*["'](\.[^"']+)["']/g

function toComponentName(path: string): string {
  const base = path.split("/").pop()?.replace(/\.(tsx?|jsx?)$/i, "") ?? "Component"
  const cleaned = base.replace(/[^A-Za-z0-9]/g, " ").trim()
  const pascal = cleaned
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")
  return /^[A-Za-z_$]/.test(pascal) ? pascal : `Component${pascal}`
}

function buildComponentStub(path: string, info: { hasDefault: boolean; named: Set<string> }): string {
  const name = toComponentName(path)
  const lines = [
    "// Auto-generated placeholder. The original component was referenced but never generated;",
    "// this stub keeps the build working. Replace it with the real implementation.",
    `import { createElement } from "react"`,
    "",
    `function ${name}(_props: Record<string, unknown>) {`,
    "  return createElement(",
    '    "div",',
    "    {",
    "      style: {",
    '        padding: "20px 24px",',
    '        margin: "16px",',
    '        border: "1.5px dashed #c4783c",',
    '        borderRadius: "10px",',
    '        background: "#fdf6ee",',
    '        color: "#7a4a1f",',
    '        fontFamily: "system-ui, sans-serif",',
    '        fontSize: "14px",',
    "      },",
    "    },",
    `    createElement("strong", null, "${name} could not be generated. "),`,
    `    createElement("span", null, 'Ask the AI to "fix the missing ${name} component" to complete this section.')`,
    "  )",
    "}",
    "",
  ]
  if (info.hasDefault || info.named.size === 0) {
    lines.push(`export default ${name}`)
  }
  for (const named of info.named) {
    if (named === "default") continue
    lines.push(`export const ${named} = ${name}`)
  }
  return `${lines.join("\n")}\n`
}

/**
 * Deterministic safety net for missing local module imports. When generated code
 * imports a relative component/module that was never emitted, this creates a
 * minimal stub module (default + any named exports actually imported) so the
 * preview always builds instead of crashing on an unresolved import. Existing
 * files are never overwritten, and non-code references (css/json/assets) are
 * left alone for the asset/scaffold validators to handle.
 */
export function injectMissingComponentStubs(files: GeneratedProjectFile[]): GeneratedProjectFile[] {
  const deduped = dedupeFiles(files)
  const byPath = new Map(deduped.map((file) => [file.path, file]))
  const availablePaths = new Set(byPath.keys())

  const isResolvable = (importerPath: string, rawImport: string) =>
    getRelativeImportCandidates(importerPath, rawImport).some((candidate) => availablePaths.has(candidate))

  const stubs = new Map<string, { hasDefault: boolean; named: Set<string> }>()

  const registerStub = (importerPath: string, rawImport: string, defaultName?: string, namedRaw?: string) => {
    if (NON_CODE_IMPORT_RE.test(rawImport)) return
    if (isResolvable(importerPath, rawImport)) return
    const target = `${resolveRelativeImport(importerPath, rawImport)}.tsx`
    if (availablePaths.has(target)) return
    const entry = stubs.get(target) ?? { hasDefault: false, named: new Set<string>() }
    if (defaultName) entry.hasDefault = true
    if (namedRaw) {
      for (const part of namedRaw.split(",")) {
        const exportName = part.trim().split(/\s+as\s+/)[0].trim()
        if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(exportName)) entry.named.add(exportName)
      }
    }
    stubs.set(target, entry)
  }

  for (const file of deduped) {
    if (!CODE_FILE_RE.test(file.path)) continue

    let match: RegExpExecArray | null
    IMPORT_CLAUSE_RE.lastIndex = 0
    while ((match = IMPORT_CLAUSE_RE.exec(file.content)) !== null) {
      registerStub(file.path, match[3], match[1], match[2])
    }

    // Side-effect imports (e.g. `import './x'`) that the clause regex skips.
    for (const rawImport of extractRelativeImports(file.content)) {
      registerStub(file.path, rawImport)
    }
  }

  if (stubs.size === 0) return deduped

  for (const [path, info] of stubs) {
    if (availablePaths.has(path)) continue
    byPath.set(path, { path, content: buildComponentStub(path, info) })
    availablePaths.add(path)
  }

  return Array.from(byPath.values())
}

export function validateGeneratedProjectFiles(
  files: GeneratedProjectFile[],
  options: { existingFiles?: GeneratedProjectFile[]; requireNewAppScaffold?: boolean } = {}
) {
  const generatedFiles = dedupeFiles(files)
  const existingFiles = dedupeFiles(options.existingFiles ?? [])
  const knownFiles = dedupeFiles([...existingFiles, ...generatedFiles])
  const availablePaths = new Set(knownFiles.map((file) => file.path))
  const issues: GeneratedProjectIssue[] = []

  if (options.requireNewAppScaffold) {
    for (const path of REQUIRED_NEW_APP_FILES) {
      if (!availablePaths.has(path)) {
        issues.push({
          code: path === "package.json" ? "missing-package-json" : "missing-required-file",
          message: `Missing required generated app file: ${path}`,
          filePath: path,
        })
      }
    }
  }

  const parsed = parsePackageJson(knownFiles)
  if (parsed.packageFile && parsed.parseError) {
    issues.push({
      code: "invalid-package-json",
      message: "package.json is not valid JSON.",
      filePath: "package.json",
    })
  }

  for (const file of generatedFiles) {
    if (!CODE_FILE_RE.test(file.path)) continue

    for (const rawImport of extractRelativeImports(file.content)) {
      const hasMatch = getRelativeImportCandidates(file.path, rawImport)
        .some((candidate) => availablePaths.has(candidate))
      if (!hasMatch) {
        issues.push({
          code: "missing-relative-import",
          message: `Missing import target "${rawImport}" referenced from ${file.path}`,
          filePath: file.path,
          importPath: rawImport,
        })
      }
    }

    const assetMatches = file.content.match(ASSET_REFERENCE_RE) ?? []
    for (const rawAsset of assetMatches) {
      const assetPath = rawAsset.slice(1, -1)
      const normalizedAssetPath = normalizeAssetReference(file.path, assetPath)
      if (!availablePaths.has(normalizedAssetPath) && !availablePaths.has(assetPath.replace(/^\//, ""))) {
        issues.push({
          code: "missing-asset",
          message: `Missing asset "${assetPath}" referenced from ${file.path}`,
          filePath: file.path,
          importPath: assetPath,
        })
      }
    }
  }

  const packageJson = parsed.packageJson
  const allDeps = {
    ...(packageJson?.dependencies && typeof packageJson.dependencies === "object" ? packageJson.dependencies : {}),
    ...(packageJson?.devDependencies && typeof packageJson.devDependencies === "object" ? packageJson.devDependencies : {}),
  }

  if (!packageJson && extractNpmPackages(generatedFiles).length > 0) {
    issues.push({
      code: "missing-package-json",
      message: "Generated code imports npm packages but no package.json was generated.",
      filePath: "package.json",
    })
  } else if (packageJson) {
    for (const packageName of extractNpmPackages(generatedFiles)) {
      if (!allDeps[packageName]) {
        issues.push({
          code: "missing-package-dependency",
          message: `Missing package.json dependency for "${packageName}".`,
          packageName,
        })
      }
    }
  }

  return {
    files: generatedFiles,
    issues,
    issueMessages: Array.from(new Set(issues.map((issue) => issue.message))),
  }
}

function extractRelativeImports(content: string): string[] {
  const importRegex = /from\s+["'](\.[^"']+)["']|import\s+["'](\.[^"']+)["']/g
  const imports: string[] = []
  let match: RegExpExecArray | null

  while ((match = importRegex.exec(content)) !== null) {
    const raw = match[1] || match[2]
    if (raw && raw.startsWith(".")) imports.push(raw)
  }

  return imports
}

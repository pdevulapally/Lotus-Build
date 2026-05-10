export type GeneratedCodeFile = {
  path: string
  content: string
}

const LUCIDE_IMPORT_ALIASES: Record<string, string> = {
  GitHub: "Github",
  LinkedIn: "Linkedin",
  YouTube: "Youtube",
}

function isCodePath(path: string) {
  return /\.(tsx?|jsx?)$/i.test(path)
}

export function normalizeGeneratedCodeContent(path: string, content: string) {
  if (!isCodePath(path) || !content.includes("lucide-react")) return content

  return content.replace(
    /import\s*\{([\s\S]*?)\}\s*from\s*["']lucide-react["']/g,
    (fullImport, importList: string) => {
      const nextImportList = importList
        .split(",")
        .map((rawSpecifier) => {
          const specifier = rawSpecifier.trim()
          if (!specifier) return rawSpecifier

          const [importedRaw, aliasRaw] = specifier.split(/\s+as\s+/i).map((part) => part.trim())
          const canonical = LUCIDE_IMPORT_ALIASES[importedRaw] ?? importedRaw
          if (aliasRaw) return `${canonical} as ${aliasRaw}`
          return canonical === importedRaw ? canonical : `${canonical} as ${importedRaw}`
        })
        .join(", ")

      return fullImport.replace(importList, ` ${nextImportList} `)
    }
  )
}

export function normalizeGeneratedCodeFiles<T extends GeneratedCodeFile>(files: T[]): T[] {
  return files.map((file) => {
    if (!file?.path || typeof file.content !== "string") return file
    const content = normalizeGeneratedCodeContent(file.path, file.content)
    return content === file.content ? file : { ...file, content }
  })
}

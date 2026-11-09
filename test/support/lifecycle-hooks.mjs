// Plain JavaScript: module hooks run on their own thread, outside tsx's transform.
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve as resolvePath } from 'node:path'
const here = dirname(fileURLToPath(import.meta.url))
const stubs = {
  '@/lib/firebase': 'stubs/firebase.ts',
  'firebase/auth': 'stubs/firebase-auth.ts',
  'next/navigation': 'stubs/next-navigation.ts',
  '@/lib/backend/browser': 'stubs/backend-browser.ts',
  '@/components/settings/settings-dialog': 'stubs/settings-dialog.ts',
}
const isStylesheet = (url) => /\.css$/.test(url.split('?')[0])
export async function resolve(specifier, context, next) {
  if (isStylesheet(specifier)) return { url: new URL(specifier, context.parentURL).href, shortCircuit: true, format: 'module' }
  const stub = stubs[specifier]
  if (stub !== undefined) return { url: pathToFileURL(resolvePath(here, stub)).href, shortCircuit: true }
  return next(specifier, context)
}
export async function load(url, context, next) {
  // Stylesheets (CSS modules) have no meaning under node; class names resolve to undefined, which the tests never read.
  if (isStylesheet(url)) return { format: 'module', source: 'export default {}', shortCircuit: true }
  return next(url, context)
}

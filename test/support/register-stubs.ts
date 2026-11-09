// Registered after tsx (`--import tsx --import ./test/support/register-stubs.ts`). tsx loads this repository's
// TypeScript through Node's CommonJS pipeline (no `"type": "module"`), so the seams are redirected there:
// `Module._resolveFilename` maps the browser-only modules (Firebase auth, Next navigation, the backend client)
// to fakes the lifecycle tests drive, and stylesheets become empty modules. Everything else — AuthProvider,
// the invitation page, UI — is the real code. The ESM hooks cover the same for any module loaded as ESM.
import Module from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve as resolvePath } from 'node:path'
import { stubs } from './stubs/index'

const here = dirname(fileURLToPath(import.meta.url))
type Loader = { _resolveFilename: (request: string, ...rest: unknown[]) => string; _extensions: Record<string, (module: { exports: unknown }, filename: string) => void> }
const loader = Module as unknown as Loader
const resolveFilename = loader._resolveFilename
loader._resolveFilename = function (request: string, ...rest: unknown[]) {
  const stub = stubs[request]
  return resolveFilename.call(this, stub === undefined ? request : resolvePath(here, stub), ...rest)
}
loader._extensions['.css'] = (module) => { module.exports = {} }
Module.register('./lifecycle-hooks.mjs', import.meta.url)

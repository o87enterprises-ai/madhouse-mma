/**
 * Prerender script: builds the client bundle, then uses the SSR build to
 * render App to a string and injects it into dist/index.html.
 *
 * Run via: node scripts/prerender.mjs
 * (Called by "npm run build" automatically.)
 */
import { build } from 'vite'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// 1. Build the client bundle
await build({ root, logLevel: 'info' })

// 2. Build the SSR bundle
await build({
  root,
  logLevel: 'info',
  build: {
    ssr: true,
    outDir: 'dist/server',
    rollupOptions: {
      input: resolve(root, 'src/entry-server.jsx'),
    },
  },
})

// 3. Use the SSR bundle to render the page
const entryServer = resolve(root, 'dist/server/entry-server.js')
const { render } = await import(pathToFileURL(entryServer).href)
const html = render()

// 4. Inject the rendered HTML into the dist/index.html template
const template = readFileSync(resolve(root, 'dist/index.html'), 'utf-8')
const output = template
  .replace('<!--ssr-html-->', html)
  .replace('<!--ssr-head-->', '') // reserved for JSON-LD injection in Batch 3

writeFileSync(resolve(root, 'dist/index.html'), output)
console.log('✓ Prerender complete — dist/index.html contains server-rendered markup')

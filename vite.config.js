import { defineConfig } from 'vite'
import { resolve, dirname } from 'path'
import { copyFileSync, existsSync, cpSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
      output: {
        // Keep CSS as a separate file (no fingerprint — simpler for extension)
        assetFileNames: 'assets/[name][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: '[name].js',
      }
    },
    cssCodeSplit: false,
  },
  plugins: [
    // Copy extension assets (manifest, icons) to dist after build
    {
      name: 'copy-extension-assets',
      closeBundle() {
        const src = __dirname
        const dst = resolve(__dirname, 'dist')
        for (const file of ['manifest.json', 'background.js']) {
          copyFileSync(resolve(src, file), resolve(dst, file))
          console.log(`[build] Copied: ${file}`)
        }
        // config.local.js is optional (gitignored), skip if missing
        const cfgSrc = resolve(src, 'config.local.js')
        if (existsSync(cfgSrc)) copyFileSync(cfgSrc, resolve(dst, 'config.local.js'))

        // Copy icons/
        mkdirSync(resolve(dst, 'icons'), { recursive: true })
        cpSync(resolve(src, 'icons'), resolve(dst, 'icons'), { recursive: true })
        console.log('[build] Copied: icons/')
        console.log('[build] Extension assets ready in dist/')
      }
    }
  ]
})

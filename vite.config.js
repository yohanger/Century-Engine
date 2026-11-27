import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { editorSourceFingerprint, BUILD_MANIFEST_NAME } from './scripts/editor-build-fingerprint.mjs'

// Nether Film Maker: los archivos de MediaPipe (wasm + modelos) se sirven en /mediapipe/<paquete>/ sin internet.
// En desarrollo se leen de node_modules; al compilar se copian a dist/mediapipe/ (sin el modelo «heavy», demasiado pesado).
const MP = ['pose', 'hands']
const mpDir = (pkg) => fileURLToPath(new URL(`./node_modules/@mediapipe/${pkg}/`, import.meta.url))
const mpSkip = (f) => /heavy|\.d\.ts$|README|package\.json/.test(f)
function mediapipeAssets() {
  return {
    name: 'mediapipe-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = /^\/mediapipe\/(pose|hands)\/([\w.-]+)$/.exec((req.url || '').split('?')[0])
        if (!m) return next()
        const f = path.join(mpDir(m[1]), m[2])
        if (!existsSync(f)) { res.statusCode = 404; return res.end() }
        res.setHeader('Content-Type', f.endsWith('.wasm') ? 'application/wasm' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream')
        res.end(readFileSync(f))
      })
    },
    generateBundle() {
      for (const pkg of MP) {
        if (!existsSync(mpDir(pkg))) continue
        for (const f of readdirSync(mpDir(pkg))) if (!mpSkip(f)) this.emitFile({ type: 'asset', fileName: `mediapipe/${pkg}/${f}`, source: readFileSync(path.join(mpDir(pkg), f)) })
      }
    },
  }
}

// Los transcodificadores oficiales pertenecen a la versión instalada de Three.js.
// Se sirven también en desarrollo y se empaquetan dentro de ambas distribuciones (sin CDN).
const decoderFiles = {
  basis: ['basis_transcoder.js', 'basis_transcoder.wasm'],
  draco: ['draco_decoder.js', 'draco_wasm_wrapper.js', 'draco_decoder.wasm'],
}
const decoderRoot = folder => path.join(fileURLToPath(new URL('./node_modules/three/examples/jsm/libs/', import.meta.url)), folder === 'draco' ? 'draco/gltf' : folder)
function threeDecoderAssets() {
  return {
    name: 'three-decoders-local',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = /^\/three-decoders\/(basis|draco)\/([\w.-]+)$/.exec((req.url || '').split('?')[0])
        if (!m || !decoderFiles[m[1]].includes(m[2])) return next()
        const file = path.join(decoderRoot(m[1]), m[2])
        if (!existsSync(file)) { res.statusCode = 404; return res.end() }
        res.setHeader('Content-Type', file.endsWith('.wasm') ? 'application/wasm' : 'text/javascript')
        res.end(readFileSync(file))
      })
    },
    generateBundle() {
      for (const [folder, files] of Object.entries(decoderFiles)) for (const name of files) {
        const file = path.join(decoderRoot(folder), name)
        if (!existsSync(file)) throw new Error(`Falta el decodificador oficial de Three.js: ${file}`)
        this.emitFile({ type: 'asset', fileName: `three-decoders/${folder}/${name}`, source: readFileSync(file) })
      }
    },
  }
}

// Política de contenido del juego exportado (solo en la compilación autónoma del Runtime): nada de red ni de páginas externas.
// 'unsafe-eval' hace falta porque las interfaces (.ui) se compilan al jugar (Vue) y los scripts del juego se ejecutan con Function;
// 'wasm-unsafe-eval' para Jolt (física). `file:` porque dentro de Electron el Runtime se abre desde el disco.
const RUNTIME_CSP = [
  "default-src 'none'",
  "script-src 'self' file: 'unsafe-eval' 'wasm-unsafe-eval'",
  "style-src 'self' file: 'unsafe-inline'",
  "img-src 'self' file: data: blob:",
  "font-src 'self' file: data: blob:",
  "media-src 'self' file: data: blob:",
  "connect-src 'self' file: data: blob:",
  "worker-src 'self' blob:",
  "object-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-src 'none'",
].join('; ')
const runtimeCsp = () => ({
  name: 'runtime-csp',
  apply: 'build',
  transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: RUNTIME_CSP }, injectTo: 'head-prepend' }],
})

const F = (n) => fileURLToPath(new URL(`./${n}`, import.meta.url))

function vendorChunk(id) {
  if (id.endsWith('/three/build/three.core.js')) return 'three-core'
  if (id.endsWith('/three/build/three.module.js')) return 'three-webgl'
  if (id.endsWith('/three/examples/jsm/lights/RectAreaLightTexturesLib.js')) return 'three-ltc'
  if (id.endsWith('/engine/runtime/world/astro-data.js')) return 'sky-data'
  if (/\/node_modules\/(vue|@vue)\//.test(id)) return 'vue'
}

function runtimeChunks() {
  let chunks
  const groups = [
    ['engine-render', ['render/viewport.js']],
    ['engine-geometry', ['geometry/terrain.js', 'geometry/waterworld.js', 'geometry/csg.js', 'scene/models.js']],
    ['engine-scene', ['scene-graph.js']],
    ['engine-play', ['events/play.js']],
  ]
  return (id, { getModuleIds, getModuleInfo }) => {
    if (!chunks) {
      chunks = new Map()
      for (const moduleId of getModuleIds()) {
        const vendor = vendorChunk(moduleId)
        if (vendor) chunks.set(moduleId, vendor)
      }
      // Asignar también las dependencias estáticas permite que cada grupo
      // importe los anteriores, sin hacer eager las importaciones dinámicas.
      const assign = (moduleId, chunk) => {
        const module = getModuleInfo(moduleId)
        if (!module || module.isExternal || chunks.has(moduleId)) return
        chunks.set(moduleId, chunk)
        for (const dependency of module.importedIds) assign(dependency, chunk)
      }
      for (const [chunk, entries] of groups) {
        for (const entry of entries) assign(F(`src/engine/runtime/${entry}`).replaceAll('\\', '/'), chunk)
      }
    }
    return chunks.get(id)
  }
}

function editorBuildStamp() {
  const startedAt = String(Date.now())
  return {
    name: 'editor-build-stamp',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'build-started-at.txt', source: startedAt })
      const { sha256, fileCount } = editorSourceFingerprint(fileURLToPath(new URL('.', import.meta.url)))
      const packageVersion = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8')).version
      this.emitFile({ type: 'asset', fileName: BUILD_MANIFEST_NAME,
        source: JSON.stringify({ schema: 1, sha256, fileCount, packageVersion }, null, 2) + '\n' })
    },
  }
}

// Dos compilaciones: el editor (index.html + filmmaker.html → dist/) y el juego exportado (--mode runtime → dist-runtime/, solo runtime.html).
// El AppImage de un juego incorpora únicamente el Runtime autónomo: ni editor ni Film Maker ni MediaPipe.
export default defineConfig(({ mode }) => {
  const standaloneRuntime = mode === 'runtime'
  return {
    plugins: [vue(), threeDecoderAssets(), ...(standaloneRuntime ? [runtimeCsp()] : [mediapipeAssets(), editorBuildStamp()])],
    // compilador de plantillas incluido: las interfaces (.ui) del proyecto se compilan al jugar
    optimizeDeps: { include: ['three/addons/libs/meshopt_simplifier.module.js', 'three/webgpu', 'three/tsl'] },
    resolve: { alias: { vue: 'vue/dist/vue.esm-bundler.js' } },
    define: { __VUE_OPTIONS_API__: true, __VUE_PROD_DEVTOOLS__: false, __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false },
    base: './', // rutas relativas: necesario para abrir el .html con file:// dentro de Electron
    server: { port: 5173, host: true },
    build: {
      chunkSizeWarningLimit: 1200,
      ...(standaloneRuntime ? { outDir: 'dist-runtime' } : {}),
      rollupOptions: {
        input: standaloneRuntime ? { runtime: F('runtime.html') } : { index: F('index.html'), filmmaker: F('filmmaker.html') },
        // Emscripten solo usa createRequire cuando se ejecuta directamente en Node.
        external: (id, importer) => id === 'node:module' && importer?.endsWith('/jolt-physics/dist/jolt-physics.wasm.js'),
        output: { manualChunks: runtimeChunks(), onlyExplicitManualChunks: true },
      },
    },
  }
})

import { createApp } from 'vue'
import ColorInput from './components/ColorInput.vue'
import { registerUiComponents } from './engine/runtime/ui/components.js'
import App from './App.vue'
// Herramientas solo del editor: el juego exportado (runtime.html) no las registra y su paquete no las incluye (core/tools.js)
import { registerEditorTools } from './tools-register.js'
import { applyEditorAppearance } from './core/editor/appearance.js'
registerEditorTools()
// Tipografía incluida en la app (sin depender de internet): IBM Plex Sans 400 / 500 / 600, subconjunto latino (tildes y ñ incluidas)
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import './styles.css'

document.documentElement.classList.add('lf-editor')

// En Electron (ver electron/preload.cjs) no hay menú contextual nativo: los menús los dibuja la propia interfaz.
if (window.lf?.isElectron) {
  document.documentElement.classList.add('electron')
  window.addEventListener('contextmenu', (e) => e.preventDefault())
}

async function mountEditor() {
  try { await applyEditorAppearance() } catch (error) { console.warn('Configuración del editor:', error.message) }
  const app = createApp(App)
  registerUiComponents(app)
  app.component('ColorInput', ColorInput)
  app.mount('#app')
}
mountEditor()

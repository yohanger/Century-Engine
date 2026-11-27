// Nether Film Maker: editor íntegro en PC; en el APK, diagnóstico de capacidades del camarógrafo S01.
import { createApp } from 'vue'
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '../styles.css'
import './film-ux.css'

// Mantener el await dentro de la función: el target Vite es2020 no acepta top-level await.
async function mountFilmMaker() {
  const android = !!window.Capacitor?.isNativePlatform?.()
  const preview = new URLSearchParams(location.search).has('mobile-diagnostics')
  if (android || preview) {
    const { default: MobileCapabilities } = await import('./MobileCapabilities.vue')
    createApp(MobileCapabilities).mount('#app')
    return
  }

  const [{ default: FilmApp }, { default: ColorInput }, { registerUiComponents }, { showClippedText }, { registerCaptureFilm }] = await Promise.all([
    import('./FilmApp.vue'),
    import('../components/ColorInput.vue'),
    import('../engine/runtime/ui/components.js'),
    import('../core/tooltips.js'),
    import('../tools-register.js'),
  ])
  registerCaptureFilm()
  const app = createApp(FilmApp)
  registerUiComponents(app)
  app.component('ColorInput', ColorInput)
  app.mount('#app')
  showClippedText()
}

void mountFilmMaker()

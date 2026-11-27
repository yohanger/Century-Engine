// Punto de entrada autónomo del Runtime para juegos exportados. Usa el mismo motor del modo Jugar, sin herramientas del Editor.
import { createApp } from 'vue'
import { registerUiComponents } from '../engine/runtime/ui/components.js'
import RuntimeApp from './RuntimeApp.vue'
import '../styles.css'

window.addEventListener('contextmenu', (e) => e.preventDefault())
const app = createApp(RuntimeApp)
registerUiComponents(app)
app.mount('#app')

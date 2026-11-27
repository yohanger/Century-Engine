// Crea el Worker del baking. «?worker&inline» lo empaqueta como Blob: funciona también al abrir la app con file:// (Electron).
import BakeWorker from './bake.worker.js?worker&inline'
export const createBakeWorker = () => new BakeWorker()

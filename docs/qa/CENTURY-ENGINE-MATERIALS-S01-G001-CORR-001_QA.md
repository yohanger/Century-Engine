# QA — Inspector profesional de materiales importados

- Baseline acumulativo de Jerarquía, 3875 archivos, cotejo sin diferencias. No se verifican cambios externos al ZIP. Jerarquía continúa pendiente de aprobación explícita. El Gate original de materiales está aprobado por el usuario, no se inventan nuevos resultados locales.
- Node específico: 12/12 PASS, pruebas de transición local, herencia de mapas, estado compartido, aislamiento, serialización y contrato estático de UI. No acreditan render real.
- Regresión: importador, material UX, detalle de superficie y dos suites road: 71 PASS, 2 FAIL; mismos nombres de runner fallido en baseline. Inspector de primitivas: 24/24 PASS antes y después. Total de regresión 95 PASS, 2 FAIL preexistentes; sin fallo adicional detectado en suites ejecutadas.
- Sintaxis JS de los módulos y scripts setup extraídos, más fixture: node --check PASS. No equivale a compilación Vue.
- Build: Vite no encontrado (exit 127). Runner Electron: falta Vite; fixture no ejecutado. Paridad Player, persistencia real de proyecto/Prefab, rendimiento GPU y QA visual NO VERIFICADOS.

## QA local
`npm run test:suite -- model-material-inspector-ux` y `npm run test:suite -- model-material-inspector-ux-electron`.

Abrir un modelo OBJ con textura y un GLB con mapas embebidos. Verificar diseño, miniatura, menú, plegado, ancho reducido, edición directa, textura por arrastre, asignación compartida, restauración, Undo/Redo, duplicación, reapertura y Player exportado. Comprobar que la primera edición de rugosidad conserva mapas importados no modificados y que un mapa vacío explícito los elimina. Verificar rendimiento local; la miniatura es CSS y no implica un contexto GPU por slot.

Estado: IMPLEMENTADO EN FUENTES, QA Node PASS, compilación/Electron/Player NO VERIFICADOS, NO APROBADO, NO CERRADO.

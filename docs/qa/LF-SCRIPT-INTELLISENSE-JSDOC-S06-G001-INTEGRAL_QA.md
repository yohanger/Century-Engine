# LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL · QA

Estado: **IMPLEMENTADO · NODE PASS · ELECTRON/BUILD NO VERIFICADOS · QA LOCAL PENDIENTE**.

## Matriz automatizada

| ID | Objetivo | Estado |
|---|---|---|
| JSDOC-01–06 | `@type`, `@typedef`, `@property`, tipos inline y game-api.d.ts | NODE PASS |
| JSDOC-07–12 | `@param`, función flecha, `@returns`, firmas y Nodo | NODE PASS |
| JSDOC-13–16 | Aislamiento entre documentos, comentarios incompletos/falsos | NODE PASS |
| JSDOC-17–21 | Diagnósticos conservadores, API previa y miembros inexistentes | NODE PASS |
| JSDOC-22–23 | Sombreado local y arrays de tipos JSDoc | NODE PASS |
| JSDOC-E01 | 16 verificaciones Vue + CodeMirror y tipos JSDoc en Electron embebido | NO VERIFICADO |
| BUILD | `npm run build`, Editor y Player | NO VERIFICADO |
| QA LOCAL | Revisión y aprobación del usuario | PENDIENTE |

## Comandos desde la raíz del proyecto

```bash
node --test scripts/test-script-intellisense-jsdoc-s06-g001-integral.mjs
node --test scripts/test-script-intellisense-jsdoc-s06-g001-integral-electron.mjs
npm run build
npm run electron
```

Si faltan dependencias y la copia es nueva, ejecutar `npm ci` antes de Electron/build. El runner de Electron es el existente del proyecto; no se utilizarán navegadores externos.

## QA usuario obligatorio

1. Crear un script Global con `/** @type {{ vida: number, nombre: string }} */ const jugador = {}`; al escribir `jugador.` deben aparecer `vida` y `nombre`.
2. Declarar `@typedef {Object} Ficha` y `@property {number} vida`; anotar `@type {Ficha}` y comprobar completado y hover.
3. Probar función `@param {NodeHandle} n` y `@returns {NodeHandle}`; verificar miembros dentro de la función y firma al llamarla.
4. Alternar a script Nodo, y luego volver a Global: el autocompletado anterior no debe contaminar el segundo recurso.
5. Verificar que `game.node(...)` y los miembros de la API LevelForge continúan sugiriéndose.
6. Verificar diagnóstico solo en un caso literal inequívoco (`@type {number}` con una cadena) y que expresiones dinámicas no produzcan advertencias engañosas.
7. Escribir un JSDoc incompleto y continuar editando: no debe congelarse CodeMirror ni generar sugerencias falsas.
8. Guardar, cerrar y reabrir scripts con JSDoc; comprobar que el texto permanece idéntico, que el editor sigue acoplándose y que Script Editor/UI Designer de S04/S05 funcionan.

**No confundir:** Node PASS no equivale a Electron PASS; Electron DOM no equivale a QA visual; build no equivale a QA local. S06 solo se cerrará con aprobación del usuario.

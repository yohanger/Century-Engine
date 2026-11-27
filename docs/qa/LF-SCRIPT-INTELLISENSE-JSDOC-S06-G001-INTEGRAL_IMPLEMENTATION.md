# LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL · Implementación

Fecha: 2026-11-03 · Estado: **IMPLEMENTADO, QA LOCAL PENDIENTE**.

## Baseline y autoridad

- Fuente de partida: `LevelForge_UI_DESIGNER_PRO_UX_S05_G001_INTEGRAL_CLOSE_SOURCE_BASELINE.zip`.
- Autorización literal del usuario: `Listo. LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL autoriza comenzar`.
- S04 Script Editor y S05 UI Designer permanecen cerrados y aprobados; runtime, Player, formatos `.js`/`.ui`, señales, Multiscript y docking no se modificaron.
- Mecanismo autorizado: ampliar el motor de tipos existente y su análisis; no duplicar CodeMirror ni incorporar un segundo Language Service sin necesidad demostrada.

## Observaciones previas

`types.js` ya conoce las declaraciones de `game-api.d.ts`, los tipos de primitivas, variables inferidas, miembros, firmas y parámetros de callbacks de la API. `analysis.js` implementa hover y diagnósticos. El contexto de CodeMirror se reconfigura cuando cambia Global/Nodo, conservando una sola instancia de editor. El soporte JSDoc local no cubría de forma integrada los tags requeridos.

## Mecanismo aplicado

- Nuevo módulo **específico** `src/core/editor/types-jsdoc.js`: lee comentarios JSDoc del documento activo sin ejecutar código, reconoce tipos con llaves anidadas y vincula anotaciones a la declaración inmediata.
- `types.js`: integra las anotaciones en su `contextAt` existente, respetando la precedencia de variables locales y los tipos del `.d.ts`; sin duplicar caches ni modificar la API pública de CodeMirror.
- `analysis.js`: incorpora aviso **conservador** solo cuando un literal inequívoco contradice `@type {number|string|boolean}`. Conserva los diagnósticos anteriores.
- Compatibilidad demostrada por pruebas Node: `@type`, `@param`, `@returns`/`@return`, `@typedef`, `@property`/`@prop` (incluye opcionales), objetos inline anidados y referencias a tipos existentes en `game-api.d.ts`.
- El análisis se limita al recurso y texto activos; no persiste tipos en `store`, no transfiere estado entre scripts Global/Nodo y no altera el código generado.

## Límites deliberados

- **No es un Language Service TypeScript completo** ni equivale a `checkJs`. No implementa inferencia entre archivos, tipos condicionales, `@template`, imports JSDoc ni análisis de flujo completo.
- Los tipos desconocidos o JSDoc malformados no generan sugerencias inventadas. No se diagnostican expresiones dinámicas cuyo tipo no sea demostrable.
- La inferencia de JavaScript sigue siendo la implementada previamente en `types.js`. La ejecución permanece JavaScript sin transpilación TypeScript.

## Evidencia y estados

- Unitarias S06: **23/23 Node PASS**.
- Regresión cruzada previa a revisión final: **175/175 Node PASS** (incluye las 21 unitarias iniciales; repetir batería final con 23 tests).
- Fixture Electron embebido S06: **16 comprobaciones preparadas; NO VERIFICADO**, porque falta `node_modules/vite` en el entorno de entrega.
- Build Editor/Player: **NO VERIFICADO**, `vite: not found`.
- QA visual y local del usuario: **PENDIENTE**; no se declara cierre.

## Dependencias y exclusiones

- Sin paquetes nuevos, workers, scripts `.sh`, segundo registro de scripts, alteraciones de `game-api.d.ts`, runtime ni Player.
- Se preserva la optimización de los editores y el modelo de nodos autorizado.
- Referencia normativa de sintaxis JSDoc: https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html. Se implementa un subconjunto documentado, no se declara paridad.

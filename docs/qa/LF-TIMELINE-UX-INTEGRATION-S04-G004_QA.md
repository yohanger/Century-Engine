# QA · LF-TIMELINE-UX-INTEGRATION-S04-G004

**Autorización exacta:** `Listo. LF-TIMELINE-UX-INTEGRATION-S04-G004 autoriza comenzar`.

**SOURCE_BASELINE de entrada vinculante:** `LevelForge_TIMELINE_NODE_METHOD_TRACK_S04_G003_SOURCE_BASELINE.zip`, aprobado por el usuario mediante QA local declarado. Se registra su cierre en `LF-TIMELINE-NODE-METHOD-TRACK-S04-G003_CLOSE.md`.

**Estado de esta entrega:** IMPLEMENTADO · 73/73 Node PASS (10 focales G004 y 63 regresión). Electron embebido, build de Editor y Player, `docs:check` completo y QA local **NO VERIFICADOS**. **NO CERRADO.**

## Auditoría: hechos y causa

- **OBSERVADO:** `TimelinePanel.vue` utilizaba barra con `flex-wrap: wrap`, cabeceras fijas de 190 px y el cálculo de `scrub()` restaba manualmente 190 px de la posición de ratón. La regla, las cabeceras y el playhead repetían ese valor. En docks pequeños la barra consumía altura y su geometría de edición quedaba atada al layout.
- **OBSERVADO:** zoom funcional de 20–240 px/s, sin encuadre de duración. Etiquetas de audio, comandos y métodos podían ocupar hasta 160 px, interfiriendo con claves cercanas.
- **CAUSA RAÍZ:** un único componente contiene interacción temporal y medidas del panel repetidas, en lugar de calcular la posición desde el rectángulo real del carril; barra no priorizaba operaciones por anchura.
- **DECISIÓN:** extender `TimelinePanel.vue` sin tocar modelo, runtime, Inspector, docking, assets, animaciones o Player.

## Contrato implementado

1. Barra de una fila: controles de reproducción, tiempo actual y creación de pista siempre accesibles; título, zoom, snap y controles adicionales adaptados a la anchura. El menú **Opciones** conserva nombre, duración, zoom, ajuste a duración, snap, preview, loop, lock player, skip, letterbox y eliminación de cinemática.
2. `ResizeObserver` sobre el scroll real para establecer un solo `headerWidth`, compartido mediante `--tl-header-width` por cabeceras, regla, carriles y cabezal. Al cerrar el componente se desconecta. El cálculo de tiempo en `scrub()` utiliza directamente `getBoundingClientRect()` del carril o regla que recibió el puntero. No se resta el valor codificado 190 px.
3. Zoom accesible con acercar/alejar, deslizador y ajustar duración; regla con intervalo adaptativo y marcas limitadas a 1.200 nodos para no perjudicar la máquina de 4 GB RAM.
4. Selección, menús, drag de nodos, doble clic, mover claves, snap, preview y Deshacer/Rehacer conservan su código y estados. Las claves etiquetadas limitan su anchura a la distancia de la clave siguiente usando el orden ya establecido por `sortKeys()`; no se escanea la pista completa por cada clave.
5. El nuevo diseño utiliza los tokens del tema y `Icon.vue` existentes. No introduce un segundo Inspector, otra toolbar, eventos globales nuevos ni bibliotecas externas. El campo `--tl-grid-step` se deriva del zoom editorial sin persistencia.
6. Sin cambios en formatos `.lfproj`, `.lfcap`, IDs, interpolaciones G002, métodos G003, comandos existentes ni runtime de Jolt. **Renombrar Animación → Cinemática** e **instalación/actualización integrada de VS Code** permanecen fuera del Gate.

## Evidencia ejecutada en este entorno

| Prueba | Resultado | Evidencia |
|---|---|---|
| Node focales de G004 | **10/10 PASS** | `evidence/LF-TIMELINE-UX-INTEGRATION-S04-G004/node-73-pass.log` |
| Node regresión S02, S03, S04-G001/G002/G003 | **63/63 PASS** | Mismo log |
| Node total | **73/73 PASS** | Mismo log |
| Electron embebido: fixture de 48 verificaciones estáticas/DOM previstas | **NO VERIFICADO** (Vite ausente) | `electron-not-verified.log` |
| Build de Editor/Player | **NO VERIFICADO** (Vite ausente) | `build-not-verified.log` |
| `docs:check` | **NO VERIFICADO**: primera fase de referencia PASS, segunda bloqueada por ausencia de `marked` | `docs-not-verified.log` |
| QA local (incluida vista visual, Player, docking) | **PENDIENTE** | Declaración del usuario tras pruebas |

Las 10 pruebas Node G004 verifican geometría Reactiva de cabecera 260/400/800, conversión de posición real tras desplazamiento horizontal, zoom, marcas, separación de etiquetas, controles en menú compacto, preservación de arrastre/preview y desconexión de observer. **No equivalen a comprobar render Vue ni WebGL.** El fixture Electron hereda la integración real de DnD/Inspector/Undo/Redo de G003 y añade medidas DOM, interacción de puntero, zoom fit, scroll, reglas y menú a varias anchuras. Si falla se necesita diagnóstico y corrección en nuevo paso del mismo Gate antes del cierre.

## Extracción local y ejecución (Linux)

1. Conservar intacto G003 aprobado y extraer **SOLO SOURCE_BASELINE** G004 en una carpeta independiente: `~/Desktop/LevelForge_TIMELINE_UX_INTEGRATION_S04_G004_SOURCE_BASELINE/`. El CHANGE solo sirve para auditar/aplicar diferencias tras comparación, **nunca** sobreescribir un proyecto local modificado sin comparación.
2. Abrir terminal en la raíz extraída. Ejecutar en orden:

```bash
npm ci
node --test scripts/test-timeline-ux-integration-s04-g004.mjs scripts/test-timeline-node-method-track-s04-g003.mjs scripts/test-timeline-interpolation-s04-g002.mjs scripts/test-timeline-hierarchy-dnd-s04-g001.mjs scripts/test-temporal-context-menu-s03-g001.mjs scripts/test-temporal-inspector-s02-g001.mjs
node --test scripts/test-timeline-ux-integration-s04-g004-electron.mjs
npm run docs:check
npm run build
npm run electron
```

**Esperado, pendiente de verificar localmente:** 73/73 Node PASS; al menos 45 comprobaciones Electron (el fixture define 48); documentación y build Editor/Player sin errores. El operador debe comprobar visualmente que no hay errores en consola, porque la compilación no equivale a QA.

## QA visual indispensable

1. Abrir una cinemática desde Assets; verificar barra compacta a **800, 400 y 260 px**. La barra no debe generar segunda fila ni cortar Reproducir, Detener, tiempo, Opciones y Pista. Controles ocultos deben existir en Opciones y modificar el mismo recurso/estado. Inspector conserva selección contextual.
2. En Timeline acoplado y flotante, cambiar anchura, scroll horizontal y zoom. La regla, los rombos, el indicador de duración y el cabezal deben permanecer alineados. Clic/arrastre sobre regla y carril deben situar el tiempo correcto, también tras scroll. Probar zoom fit en cinemáticas de varias duraciones.
3. Crear pistas de cámara, nodo, audio, comandos y método; comprobar etiquetas cercanas sin superposición sobre las claves siguientes. Renombrar pista, insertar con doble clic y mediante menú, arrastrar clave con snap y Deshacer/Rehacer. Con muchas claves, comprobar fluidez en hardware local.
4. Arrastrar nodo desde Jerarquía y crear pista ligada por ID (G001); cambiar interpolación (G002); crear método `node.expose()` y comprobar que **NO** se ejecuta en scrub pero sí en Play/Player (G003).
5. Pausar, detener, modo bucle, preview con restauración de poses, abrir otro documento, guardar y reabrir. Probar Player exportado con First Person y Jolt, preservando independiente la incidencia conocida de plantilla sin controlador.
6. Reducir el Inspector principal a 260 px, ocultarlo/mostrarlo, cambiar docking de Timeline entre acoplado y flotante y reacoplar sin perder selección ni datos.

**Si hay fallo:** devolver operación, anchura aproximada, zoom, tipo de pista, captura o screencast y error relevante. **Si todo pasa:** basta la aprobación local declarada; el cierre de G004 se registrará en la siguiente entrega autorizada.

## Restricciones de entrega

Dos ZIP exactos: `CHANGE` (solo nuevos/modificados + documentación, pruebas y ledger) y `SOURCE_BASELINE` completo. No `.sh`, SHA-256 separado, `node_modules`, builds, cachés ni temporales. Inventario diferencial en `LF-TIMELINE-UX-INTEGRATION-S04-G004_DIFF.md`.

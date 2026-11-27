# LF-SHADER-GRAPH-UX-S02-G001_CORR-002 — QA de corrección visual

**Autorización literal:** `Listo. LF-SHADER-GRAPH-UX-S02-G001_CORR-002 autoriza comenzar` (2026-10-27).

**ESTADO REAL: IMPLEMENTACIÓN PARCIAL · TEST NODE PASS · VALIDACIÓN VISUAL BLOQUEADA · ENTREGA AÚN NO APROBADA.**

Esta corrección se autorizó tras rechazo visual de G001 y CORR-001. La **segunda imagen de referencia** (editor profesional de materiales) conserva autoridad visual. No se ha aprobado el aspecto de esta implementación; el resultado solo se considerará apto cuando la interfaz Vue **real** pueda capturarse y compararse. El acoplamiento de ventanas está expresamente pospuesto.

## Cambios implementados en el editor existente

- `ShaderGraphEditor.vue`: geometría de nodos de textura con miniatura lateral y puertos en la misma región, sin que los parámetros queden por debajo de la altura calculada; cuadrícula menor/mayor; encabezados diferenciados por categoría; Inspector con detalle de recurso de textura y edición original; nodo de datos seleccionado inicialmente para evitar Inspector vacío; refinamiento del workspace, toolbar, consola, Inspector, bordes, campos y selección. Mantiene `setParam`, `setInline`, `edit`, `push`, `apply`, compilador y rutas originales.
- `ShaderPreview.vue`: cámara de estudio más cercana para ocupar mejor el panel, iluminación PBR reajustada y fondo editorial. Sigue usando shader y material originales, con `assetImage` para recursos asociados. No inserta texturas de muestra.
- `scripts/fixtures/shader-graph-visual.html` y `shader-graph-visual.js`: página **de QA, no de producción**, que monta `ShaderGraphEditor.vue` mediante `createApp()` y usa `sampleGraph()`/`newGraph()` reales; no contiene una maqueta duplicada.
- `scripts/qa-shader-graph-visual.py`: captura real automatizada mediante Playwright/Chromium a 1366 × 768 y 1536 × 960 para Material y Post. Registra rectángulos de layout, overflow y errores JS, además de PNG y JSON. Un fallo de Vite o de navegador provoca salida de error, no genera imágenes falsas.
- `scripts/test-shader-graph-ux-s02-g001-corr002.mjs`: 14 casos nuevos de contratos estructurales, compilación de grafos y preparación del runner.

No se modifican `compile.js`, `nodes.js`, `state/shaders.js`, serialización, Player, física ni acoplamiento.

## Ejecuciones verificadas

| Evidencia | Resultado |
|---|---|
| Suite nueva CORR-002 | 14 PASS / 0 FAIL |
| Suites CORR-002 + CORR-001 + G001 | 45 PASS / 0 FAIL |
| Regresión Node disponible (`--test-concurrency=1`, sin `test-starcat.mjs`) | **1758 PASS / 0 FAIL / 18 SKIP** |
| Regresión concurrente previa | 1757 PASS / 1 FAIL / 18 SKIP (`test-clouds.mjs`) |
| `test-clouds.mjs` aislado y regresión secuencial | PASS; fallo inicial asociado a ejecución concurrente, sin conclusión definitiva sobre causa raíz |
| `npm ci --offline` | BLOQUEADO: caché incompleta, falta `zip-stream` |
| `npm ci` normal | NO COMPLETADO: entorno sin resolución DNS para registry.npmjs.org |
| Vue/Vite en navegador | **NO VERIFICADO, Vite no disponible** |
| Capturas de Chromium de la UI actual | **NO GENERADAS** (no se ha servido el Vue real) |
| Build Editor/Player, Electron, QA visual | **NO VERIFICADOS** |

### BLOQUEO CONTRACTUAL

La metodología autorizada **exige** renderizar Vue en Chromium, capturar y comparar visualmente con la segunda referencia. Esa verificación **no pudo ejecutarse** en el entorno de entrega por dependencias Vite/Vue ausentes. Las modificaciones implementadas y la regresión Node **no acreditan fidelidad visual**. Es incorrecto declarar este Gate terminado o aprobado. El paquete, si se comparte para QA, debe considerarse una **copia candidata no aprobada**, no el cierre de CORR-002.

## Procedimiento para ejecutar el Vue real en el entorno local con dependencias instaladas

Comprobar en una copia de QA con el CHANGE aplicado y sin sobrescribir cambios propios.

Terminal 1:

```bash
cd ~/ENGINES/lf-0.26.13/lf
npm run dev -- --host 127.0.0.1
```

Abrir en navegador Chromium/Brave:

- `http://127.0.0.1:5173/scripts/fixtures/shader-graph-visual.html?target=material`
- `http://127.0.0.1:5173/scripts/fixtures/shader-graph-visual.html?target=post`

La página utiliza **el componente Vue real** y un grafo de QA construido mediante `sampleGraph()`/`newGraph()`. No es una maqueta HTML. No utiliza texturas falsas; un material con texturas reales requiere un proyecto que las tenga asignadas. No sustituye la comprobación de tus escenas.

Opcionalmente, si Playwright para Python está disponible (`python3 -m pip install playwright` en un entorno de QA independiente), desde una segunda terminal:

```bash
python3 scripts/qa-shader-graph-visual.py
```

Esto genera capturas y JSON en `docs/qa/shader-graph-corr002-capturas/` (solo datos de QA). El runner devuelve código 2 cuando no puede arrancar. Las capturas deberán **compararse con la referencia real** antes de aprobar. Probar también el Editor de LevelForge integrado y el Shader Graph con un material con texturas reales a 1366 × 768.

## Aceptación aún pendiente

- [ ] Captura auténtica del Vue real Material, 1366 × 768.
- [ ] Captura auténtica del Vue real Post, 1366 × 768.
- [ ] Capturas a 1536 × 960.
- [ ] Comparación formal de nodos, toolbar, panel lateral, preview y consola respecto a la referencia aprobada.
- [ ] Validación del material con texturas verdaderas, sin recursos inventados.
- [ ] Ningún overflow, clipping o solapamiento de nodos/puertos o toolbar.
- [ ] Compilación Editor y Player después del cambio.
- [ ] QA local del usuario y aprobación visual expresa.

**Regla:** no aprobar G001, CORR-001 ni CORR-002 visualmente mientras estas evidencias no existan. Conservar registro histórico de los rechazos; no modificar contratos ni falsificar pruebas.

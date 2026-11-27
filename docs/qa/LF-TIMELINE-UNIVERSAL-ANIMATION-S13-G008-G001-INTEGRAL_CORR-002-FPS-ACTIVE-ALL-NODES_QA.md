# LevelForge · S13-G008-G001 · CORR-002 — FPS, active y todos los nodos

**Gate autorizado:** `LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-INTEGRAL_CORR-002-FPS-ACTIVE-ALL-NODES`

**Estado técnico:** IMPLEMENTACIÓN PARCIAL; **NO CERRADO; QA LOCAL PENDIENTE**.
**Base:** SOURCE_BASELINE CORR-001 CAMERA-PREVIEW-INSPECTOR-UX QA-HOST CORR-001, conservado de forma acumulativa.
**Contrato:** UPA-CA-001 ratificado, UA-CA-001, autoridad de propietarios/Camera Orchestration/Jolt vigente.

## Objetivo y resultado observado

1. El recurso Timeline almacena `fps` entero validado (1–240, por defecto 30 para datos antiguos), conservándolo en `normalizeTimeline`, sin cambiar la velocidad del reloj de reproducción.
2. El Inspector muestra una llave de `active` junto a su casilla de activación para los tipos de nodo que exponen ese booleano. `active` no se confunde con `visible`. Se registra con valores `true`/`false` discretos.
3. Timeline permite Snap de **un fotograma** utilizando FPS del recurso, además de Snap libre y a segundos. Avanzar/retroceder un fotograma cuantiza exactamente el tiempo del cabezal para evitar deriva por redondeo.
4. En PlayMode/Player, la pista `active` usa `_nodeActive()` —mecanismo original de ciclo de vida, descendientes, scripts, audio y física—, sin mutar `obj.active` ni usar otro gestor. Se preservan reservas de otros canales del mismo Timeline cuando el nodo se desactiva y se restaura el estado anterior al terminar.
5. En Preview del Editor, `active` se representa visualmente sin disparar los scripts ni la física; se restaura al detenerse. Animation Clips independientes que usen el mismo canal `active` emplean también `_nodeActive()`, respetando el arbitraje existente de Timeline.
6. Persisten `method`, `commands`, `audio`, tomas explícitas de cámara y clips históricos Nodo/Cámara. El diseño de Codex no fue reemplazado.

## Límite expreso — animación universal NO certificada

La participación de **todos los tipos de nodos en `active`** no implica que **todas sus propiedades especializadas** tengan animación implementada. La matriz previa registra 259 apariciones de controles de UI en once componentes (no son 259 propiedades independientes). En especial, Canvas, materiales, Jolt, Terrain, VFX, recursos y opciones de audio no disponen aún de lectores, aplicadores, snapshots y restauradores completos por propietario. No se añadieron llaves decorativas ni escrituras directas para eludir esa situación.

**G001 y CORR-002 no pueden aprobarse/cerrarse como animación universal de 100 %:** sigue PENDIENTE el inventario dinámico por cada tipo y la integración completa de los sistemas propietarios. La autoridad de G007 `object3D` permanece NO CERTIFICADA.

## Evidencia automatizada en este entorno

- **180 PASS / 0 FAIL / 0 SKIP**, batería seleccionada de 8 suites: CORR-002 FPS/active; G001; CORR-001; CORR-004 UX; S04 método; geometría temporal G002; propiedad CORR-003; jerarquía CORR-002.
- **13/13 PASS** en la nueva batería FPS/active. Los casos incluyen 24/25/30/60/48/120/240 FPS, legacy, entradas inválidas, cuantización, `Node` inicialmente inactivo, `true → false → true`, propietario de física/audio, descendientes, exclusividad por canal, restauración cuando convive con otra propiedad y clips independientes.
- Regresión extendida anterior: **235 PASS, 3 FAIL, 2 SKIP**. Un fallo fue carga de suite por dependencia `three` ausente en este entorno. Otro exige que Inspector no contenga `PropertyKey`, condición obsoleta tras UPA-CA-001. El tercero usa una aserción histórica sobre la estructura de aplicador de Animation Clips; requiere QA funcional en instalación completa, no se declara PASS.
- **Compilación Editor/Player: NO VERIFICADA** (`node_modules`, `three`, `vue`, `vite` ausentes aquí).
- **Electron y QA local del usuario: PENDIENTES**. Compilar no sustituye prueba visual.

## QA local solicitado

Desde la raíz que contiene `package.json`, después de respaldar y comparar archivos locales contra CHANGE:

```bash
node --test scripts/test-timeline-universal-animation-s13-g008-g001-corr002-fps-active.mjs
node --test scripts/test-timeline-universal-animation-s13-g008-g001-integral.mjs scripts/test-timeline-universal-animation-s13-g008-g001-corr001.mjs
node --test scripts/test-timeline-universal-animation-s13-g008-g001-corr001-electron.mjs
npm run build
npm run electron
```

Esperado: **13 PASS** en la suite nueva; pruebas Node G001/CORR-001 sin fallos; el resto puede revelar regresiones que habrá que registrar y corregir. Electron y compilación no se han ejecutado satisfactoriamente en este entorno; **no se prometen PASS**.

En Electron, comprobar: cambiar FPS 24/25/30/60 y valor personalizado, guardar/reabrir y Snap por fotograma; activar/desactivar desde Timeline un `Node` sin geometría y un padre con descendientes; cambio discreto y restauración al detener; edición simultánea de otra propiedad; cámara POV conservada, métodos/eventos/audio conservados y reproducción correcta en Player.

## Entrega y continuidad

- Exactamente `CHANGE` (solo archivos afectados) y `SOURCE_BASELINE` completo actualizado; excluye `node_modules`, builds y cachés. Conservar copias anteriores.
- No extraer el SOURCE_BASELINE encima de un proyecto con modificaciones locales sin comparar.
- Se actualizan las seis hojas del ledger con los resultados reales. **No declarar APROBADO, CERRADO ni 100 % UNIVERSAL.**
- El siguiente corte deberá resolver las propiedades especializadas mediante sus propietarios con pruebas integrales; G009–G014 continúan pendientes.

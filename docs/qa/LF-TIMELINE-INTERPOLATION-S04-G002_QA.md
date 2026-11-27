# QA · LF-TIMELINE-INTERPOLATION-S04-G002

**Autorización exacta:** `Listo. LF-TIMELINE-INTERPOLATION-S04-G002 autoriza comenzar`.

**SOURCE_BASELINE de entrada:** `LevelForge_TIMELINE_HIERARCHY_DND_S04_G001_SOURCE_BASELINE.zip`, G001 aprobado con QA local declarado (documentado en `LF-TIMELINE-HIERARCHY-DND-S04-G001_CLOSE.md`).

**Estado a la entrega:** IMPLEMENTADO · 44/44 Node PASS (17 G002 + 27 S02–S04 anteriores). Electron embebido, compilación del Editor/Player y QA visual local **NO VERIFICADOS**. `docs:check` bloqueado por dependencia ausente. **NO CERRADO** hasta QA y aprobación del usuario.

## Diagnóstico basado en código real

- **OBSERVADO:** `src/core/timeline/model.js` carecía de modo `interpolation` por pista. Las claves solo tenían `ease` por segmento; `visible` es booleana. `src/engine/runtime/timeline/eval.js` usaba `animationEase()` para nodos, pero `evalCamera()` solo conocía cinco modos (desconocidos caían a inOut), mientras que el Inspector ofrecía Bézier, rebote, elástico y otros.
- **OBSERVADO:** la normalización de claves de cámara eliminaba controles `bz` que ya se utilizan en el modelo de clips y claves de nodo. `TimelinePanel.vue` y el Player importan los evaluadores de Timeline compartidos.
- **CAUSA RAÍZ:** selección de interpolación de pista inexistente, evaluadores de cámara/nodo divergentes y datos Bézier omitidos durante la normalización de cámara.
- **INFERENCIA/DECISIÓN:** conservar el `ease` heredado cuando no existe `interpolation` y añadir modos explícitos únicamente donde aportan valor; no replicar el motor de evaluación ni modificar formatos completos.

## Implementación dentro del Gate

1. `src/core/timeline/model.js`: `INTERPOLATIONS` (`nearest`, `linear`, `cubic`, `linear-angle`, `cubic-angle`); `normalizeTrack` persiste el modo solo en pistas `node` con propiedad compatible, conservando ausencia del campo en pistas heredadas. Los modos angulares solo se admiten con `rotation`; no se interpolan bool ni bake. Se conservan `byId`, IDs, `ease`, `path`, comandos y orden de claves.
2. `src/engine/runtime/timeline/eval.js`: evaluación lineal y de muestra más cercana, interpolación cúbica Hermite con tangentes según marcas de tiempo, modos angulares de camino corto y representación desenvuelta para evitar saltos numéricos de ±360° en claves sucesivas. La cámara aplica los mismos suavizados temporales que ya ofrecía el modelo, manteniendo `path` para trayectoria espacial.
3. `src/core/timeline/model.js`: las claves Bézier de cámara y nodo conservan y normalizan cuatro puntos `bz` (x acotadas entre 0 y 1).
4. `src/components/TemporalResourceInspector.vue`: selector de interpolación de pista de nodo; `Por clave (heredado)` devuelve la semántica anterior, la rotación expone modos angulares y el cambio de propiedad desactiva o convierte modos no aplicables. `commit()` y `temporalEditRevision` reutilizan historial/preview existente. Curva Bézier editable también para las claves Timeline de cámara/nodo en modo por clave.
5. `scripts/test-timeline-interpolation-s04-g002.mjs`: 17 pruebas focales. El evaluador fuente se ejecuta con un sustituto **únicamente de Three.js en Node** para probar los resultados numéricos; no es una prueba de render ni de cuaterniones reales. `scripts/fixtures/editor/timeline-interpolation-s04-g002.html`: fixture de Vue/Inspector para Electron embebido con al menos 37 comprobaciones previstas.

**Compatibilidad:** las pistas de nodo existentes sin campo `interpolation` conservan el suavizado previo y los archivos `.lfproj` no requieren migración. Las pistas de cámara con efectos (`bezier`, `back`, `bounce`, `elastic`) pueden comportarse de modo diferente al reproducirse: es una **corrección explícita autorizada** de los modos ya expuestos por el Inspector, no una reinterpretación encubierta. Cámara `path` (`smooth`/`linear`) sigue siendo trayectoria espacial separada.

## Evidencia separada

| Comprobación | Resultado | Archivo |
|---|---|---|
| 17 pruebas Node G002 (normalización, modos, continuidad, compatibilidad, cámara/Bezier, UI contractual) | PASS | `evidence/LF-TIMELINE-INTERPOLATION-S04-G002/node-regression.log` |
| 27 regresiones Node S02/S03/S04 | PASS | mismo archivo: 44/44 total |
| Fixture Electron embebido: Jerarquía, Timeline, Inspector estrecho, Undo/Redo, interpolaciones | PREPARADO · NO VERIFICADO | `scripts/fixtures/editor/timeline-interpolation-s04-g002.html`; `electron-blocked.log` |
| Build Editor y Player | NO VERIFICADO (falta Vite) | `build-blocked.log` |
| `npm run docs:check` | NO VERIFICADO (falta marked) | `docs-check-blocked.log` |
| QA local del usuario | PENDIENTE | Declaración posterior del usuario, sin pedir logs salvo incidencia |

## Instalación y ejecución (Linux)

Conserva el ZIP S04-G001 aprobado. Extrae el ZIP completo `LevelForge_TIMELINE_INTERPOLATION_S04_G002_SOURCE_BASELINE.zip` en una **carpeta independiente** del escritorio; no sobrescribas el proyecto de juego, cambios locales, `.lfproj`, perfiles del editor ni el baseline anterior. El paquete CHANGE es para inspección/comparación, **no** se extrae encima de una instalación sin comparación.

Desde la raíz de SOURCE_BASELINE:

```bash
npm ci
node --test scripts/test-timeline-interpolation-s04-g002.mjs scripts/test-timeline-hierarchy-dnd-s04-g001.mjs scripts/test-temporal-context-menu-s03-g001.mjs scripts/test-temporal-inspector-s02-g001.mjs
node --test scripts/test-timeline-interpolation-s04-g002-electron.mjs
npm run docs:check
npm run build
npm run electron
```

**Salida esperada si el entorno tiene dependencias:** 44/44 Node PASS, 37 o más comprobaciones Electron en fixture WebGL, `docs:check` sin errores, build Editor y Player completado. Esa salida **no está verificada en este entorno**.

## QA manual imprescindible en Electron embebido

1. Abre una cinemática heredada con pistas `node` sin `interpolation`. Haz scrub en varios tiempos antes y después de guardar/reabrir. Debe reproducir el suavizado por clave anterior (p. ej. inOut y `cut`). Confirma Deshacer/Rehacer sin pérdida de `byId`.
2. Selecciona una pista de Posición en Inspector, cambia `Interpolación` por **Lineal**, **Más cercana** y **Cúbica**. Prueba claves 0 → 10 en dos segundos (medio de lineal = 5; nearest cambia en 1 s); usa cuatro claves para comprobar continuidad de cúbica. Regresa a «Por clave (heredado)» y comprueba `ease` en clave.
3. Selecciona pista Rotación: deben aparecer **Lineal angular** y **Cúbica angular**. Prueba 350° → 10° y 170° → -170°; no debe girar 340° en dirección opuesta. Pasa el cabezal exactamente por una clave que cruza 360° y comprueba que no hay salto visual.
4. Cambia la propiedad a Posición y Visible. Posición no debe ofrecer modos angulares; Visible debe seguir siendo booleana y no ofrecer interpolación. La pista de física horneada permanece de solo lectura.
5. En una pista de Cámara con trayectoria Recta o Curva suave, prueba los suavizados `bezier`, `back`, `bounce` y `elastic`; edita los cuatro controles Bézier, guarda/reabre y comprueba el preview. Es una corrección conductual de cámara, no un cambio automático de su trayectoria.
6. Alterna documentos y cambia selección; verifica Inspector, historial y preview. Abre a 260 px y en panel acoplado/flotante. Comprueba que no haya pérdida horizontal de controles.
7. Repite los casos numéricos principales en Player exportado, incluyendo First Person/Jolt. No confundir compilación con QA real. Mantén separada la incidencia conocida de reproducción en plantilla sin controlador.

**Si falla:** indicar modo, pista, tiempos/valores de claves, reproducción mínima, captura o screencast y mensaje de consola si lo hubiera. **Si funciona:** basta tu declaración de aprobación local.

## Exclusiones contractuales

G003 de llamadas a scripts, G004 de UX integral, renombrado de «Animación» al final, instalación integrada de VS Code posterior, migraciones de referencias heredadas por nombre, nuevos administradores de animación y modificaciones a Jolt. No implementados por G002.

## Inventario contra SOURCE_BASELINE G001

**Modificados (4):** `src/core/timeline/model.js`, `src/engine/runtime/timeline/eval.js`, `src/components/TemporalResourceInspector.vue`, `docs/qa/LevelForge_DB_Ledger.xlsx`.

**Nuevos (9):** `docs/qa/LF-TIMELINE-HIERARCHY-DND-S04-G001_CLOSE.md`, `docs/qa/LF-TIMELINE-INTERPOLATION-S04-G002_QA.md`, `scripts/test-timeline-interpolation-s04-g002.mjs`, `scripts/test-timeline-interpolation-s04-g002-electron.mjs`, `scripts/fixtures/editor/timeline-interpolation-s04-g002.html` y cuatro registros de evidencia en `docs/qa/evidence/LF-TIMELINE-INTERPOLATION-S04-G002/`.

**Eliminados:** ninguno. **Cambios inesperados:** ninguno. Se excluyen dependencias, builds, cachés y temporales. El CHANGE contiene exclusivamente estos 13 archivos; SOURCE_BASELINE conserva los 1.938 archivos anteriores e incorpora los nueve nuevos. La aprobación y el cierre de G002 siguen pendientes de QA local.

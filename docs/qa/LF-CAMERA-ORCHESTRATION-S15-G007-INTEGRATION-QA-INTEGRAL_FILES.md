# Inventario S15-G007 · Integration QA integral

**Entrada:** `LF_CAMERA_ORCHESTRATION_S15_G006_TRANSITIONS_EXIT_POLICIES_INTEGRAL_SOURCE_BASELINE.zip`  
**Salida prevista:** CHANGE y SOURCE_BASELINE de `LF-CAMERA-ORCHESTRATION-S15-G007-INTEGRATION-QA-INTEGRAL`.

## Nuevos (6)

1. `docs/architecture/LF-CAMERA-ORCHESTRATION-S15-G007-INTEGRATION-QA-INTEGRAL_AUDIT.md` — auditoría observada/inferida, límites, veredicto.
2. `docs/qa/LF-CAMERA-ORCHESTRATION-S15-G007-INTEGRATION-QA-INTEGRAL_QA.md` — matriz de 24 escenarios; comandos y evidencia.
3. `docs/qa/LF-CAMERA-ORCHESTRATION-S15-G007-INTEGRATION-QA-INTEGRAL_FILES.md` — inventario y comparación.
4. `scripts/test-camera-orchestration-s15-g007.mjs` — 19 pruebas integradas de método productivo/eventos/Timeline.
5. `scripts/test-camera-orchestration-s15-g007-electron.mjs` — harness embebido existente de WebGL, no navegador externo.
6. `scripts/fixtures/player/camera-orchestration-s15-g007.html` — pruebas Three.js/WebGL nativas con salida efectiva y cámara real.

## Modificado (1)

- `docs/qa/LevelForge_DB_Ledger.xlsx` — actualizar la aprobación real de G006 y añadir evidencia/continuidad de G007 en ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE y TRACEABILITY; no borra historial.

## Eliminados y no esperados

**Eliminados: 0. Cambios inesperados: 0**, sujetos a comparación ZIP final. Sin cambios en `src`, `electron`, Player FPS, escenas ni proyectos. Excluir `dist*`, `node_modules`, temporales y cachés.

## Evidencia

G007 19/19 Node PASS; batería conjunta 188 PASS / 1 FAIL de entorno por `jszip` ausente; harness Electron creado pero no ejecutable aquí por ausencia de Vite/Electron. G006 aprobado por usuario con build Editor 849/Player 415. **No existe PASS de AppImage ni cierre S15** hasta evidencia del usuario.

# QA · LF-FILMMAKER-NLE-DIRECT-AUTHORING-S01-G001-INTEGRAL

**Gate:** AUTORIZADO E IMPLEMENTADO EN FUENTES. **QA LOCAL: PENDIENTE. CIERRE: NO.**

## Evidencia automática

Prueba nueva: `scripts/test-filmmaker-nle-direct-authoring-s01-g001-integral.mjs` — 15 PASS / 0 FAIL. Incluye plano sin grabación y sin take, evaluación real de cámara, redimensionado editable, límites de grabaciones anteriores, validaciones, dos cámaras, orden/cortes y Timeline exportable, claves de nodo por ID/Undo, activación directa, drag de nodos/cámaras, efectos temporales y guardado nativo por ID.

Regresión conjunta (12 suites de FilmMaker): **163 tests: 161 PASS, 2 SKIP, 0 FAIL**. Las suites anteriores que contenían dobles de `playMontage` o botones de modo antiguos se actualizaron exclusivamente para reconocer el Amendment aprobado; no se eliminaron pruebas ni aserciones funcionales.

Log: `docs/qa/evidence/LF-FILMMAKER-NLE-DIRECT-AUTHORING-S01-G001-INTEGRAL/node-regression-20261106.log`.

**Regresión Cinematics (5 suites adicionales):** 85 tests: **83 PASS, 1 SKIP, 1 FAIL**. El único FAIL es **preexistente en el SOURCE_BASELINE S09**: `scripts/test-cinematics-viewer-s05-g002.mjs` exige una expresión textual ya ausente en `src/components/ProjectPanel.vue`. Ambos archivos tienen SHA-256 idéntico al ZIP original del usuario; no fueron modificados por S01. Se registra la regresión como fallo histórico no corregido, nunca como PASS. No se refactorizó Assets/Cinematics para cambiar un test ajeno al Gate. Log: `docs/qa/evidence/LF-FILMMAKER-NLE-DIRECT-AUTHORING-S01-G001-INTEGRAL/cinematics-regression-20261106.log`.

**Compilación:** NO VERIFICADA. `npm ci --offline --ignore-scripts` no terminó: dependencia `zip-stream` no presente en caché. No se ejecutaron `npm run filmmaker -- --build` ni QA real Electron, vídeo/audio, Player o SQLite/IndexedDB con recursos Cinematic guardados.

## QA LOCAL — realizar en la raíz existente con package.json

1. Comparar archivos afectados con tus cambios locales; respaldar los que difieran. El CHANGE es incremental sobre la base S09 indicada, **no** sobre otra rama arbitraria.
2. Ejecutar `npm ci` solo si faltan dependencias, luego `node --test scripts/test-filmmaker-nle-direct-authoring-s01-g001-integral.mjs` y `npm run filmmaker -- --build`.
3. En LevelForge crear un recurso Cinematic nuevo desde Assets. Abrirlo en FilmMaker. Comprobar que no hay paso previo de grabación ni botón bloqueante «Animar».
4. Arrastrar un nodo compatible desde Jerarquía a la Timeline; añadir Posición; crear claves en 0 y 2 segundos; mover, editar y comprobar Undo/Redo. Auto-key debe empezar desactivado y ser opcional.
5. En panel Cámara, guardar el encuadre deseado, arrastrar una cámara a Timeline. Debe aparecer un plano de 5 s sin take. Repetir con otra cámara y reordenar los planos. Probar extensión a 8 s y recorte a 3 s sin cambiar IDs ni datos de tomas.
6. Insertar texto, un fundido, barras y un audio desde Assets. Mover el cabezal y comprobar overlay del visor; comprobar que no hay audio duplicado durante scrubbing. Reproducir desde la Timeline, verificar audio/cortes/cámara.
7. Guardar con botón Cinematic nativo, cerrar FilmMaker, reabrir **el mismo recurso**, comprobar cámara, duración, ID, claves de nodos, efectos y audio. Comprobar que el proyecto original no recibió modificaciones editoriales accidentales.
8. Probar una película con pases grabados preexistentes: debe mantener duración, visualización y función de grabar pase. Validar el panel Cámara móvil sin intentar iniciar otra implementación móvil.
9. Comprobar exportación/consulta desde Cinematics en LevelForge. Cinematics no debe crear ni editar pistas de película.

**Evidencia a devolver:** salida de Node, salida completa de `npm run filmmaker -- --build`, capturas o vídeo de arrastre de nodo/cámara, recorte/extensión, preview, reproducción y persistencia del recurso Cinematic.

## Estados

- IMPLEMENTADO EN FUENTES: Sí.
- TEST AUTOMATIZADO PASS: 161 PASS, 2 SKIP, 0 FAIL, en suites ejecutadas.
- COMPILADO: NO VERIFICADO.
- QA LOCAL PASS: PENDIENTE.
- APROBADO: PENDIENTE.
- CERRADO: NO.

## Inventario diferencial contra SOURCE_BASELINE S09

**Nuevos (6):**

- `docs/architecture/LF-FILMMAKER-NLE-DIRECT-AUTHORING-CA-001_RATIFICATION.md`
- `docs/architecture/LF-FILMMAKER-NLE-DIRECT-AUTHORING-S01-G001-INTEGRAL_IMPLEMENTATION.md`
- `docs/qa/LF-FILMMAKER-NLE-DIRECT-AUTHORING-S01-G001-INTEGRAL_QA.md`
- `docs/qa/evidence/LF-FILMMAKER-NLE-DIRECT-AUTHORING-S01-G001-INTEGRAL/cinematics-regression-20261106.log`
- `docs/qa/evidence/LF-FILMMAKER-NLE-DIRECT-AUTHORING-S01-G001-INTEGRAL/node-regression-20261106.log`
- `scripts/test-filmmaker-nle-direct-authoring-s01-g001-integral.mjs`

**Modificados (9):**

- `docs/qa/LevelForge_DB_Ledger.xlsx`
- `scripts/test-filmmaker-anim-s01-g002.mjs`
- `scripts/test-filmmaker-anim-s02-g002-corr001.mjs`
- `scripts/test-filmmaker-edit-workspace-s01-g002-integral.mjs`
- `src/filmmaker/FilmApp.vue`
- `src/filmmaker/NleTimeline.vue`
- `src/filmmaker/montage.js`
- `src/filmmaker/panels/CameraPanel.vue`
- `src/filmmaker/session.js`

**Eliminados:** ninguno. **Cambios inesperados:** ninguno. El test histórico fallido de Cinematics y `src/components/ProjectPanel.vue` están inalterados.

# LevelForge — S15-G007 · Auditoría de integración de Camera Orchestration

**Gate autorizado:** `LF-CAMERA-ORCHESTRATION-S15-G007-INTEGRATION-QA-INTEGRAL`  
**SOURCE_BASELINE de entrada:** `LF_CAMERA_ORCHESTRATION_S15_G006_TRANSITIONS_EXIT_POLICIES_INTEGRAL_SOURCE_BASELINE.zip`  
**Contratos vinculantes:** Parent CAM-01..16, CA pre-LTS active/visible y `LF-CAMERA-ORCHESTRATION-S15-G006-CA-001` ratificado.  
**Estado:** auditoría y medios de QA implementados; cierre de S15 **PENDIENTE**, sin afirmar QA GPU/Player.

## 1. Evidencia observada, inferencias y alcance

**OBSERVADO:** la autoridad vigente sigue en `src/engine/runtime/events/play-camera.js`, métodos `_cameraAcquire`, `_cameraEventControl`, `_cameraFrame`, `_cameraReset`; la salida de `_cameraFrame` alimenta consumidores posteriores en `play-controls.js`. Los eventos utilizan el host existente y el intérprete real (`cameraControl`). `TimelineRunner` produce poses; `_tlCameraExit` gestiona natural/stop/skip; FilmMaker conserva prioridad cuando existe su fuente de cámara. `src/engine/runtime/package/game.js` instancia el mismo `PlayMode` que usa el Editor. Preview mantiene su sesión de cámara editorial separada. No se identificó un motivo real de Runner que active la política `cameraExit.interrupted` entre propietarios; bajo el arbitraje actual una solicitud de otro propietario se rechaza.

**OBSERVADO, evidencia local aportada por usuario para G006:** 28/28 Node PASS; build de Editor 849 módulos y Player 415 módulos completados, `npm run electron` invocado; usuario declara **«Aprobado»**. No se aportó salida que acredite QA por escenario ni arranque independiente de AppImage.

**OBSERVADO en este entorno G007:** pruebas específicas nuevas ejecutadas 19/19 PASS. Regresión seleccionada de G002–G006, eventos, Cinematics, GameManager y active/visible ejecutada: 169 PASS, 1 FAIL de entorno `ERR_MODULE_NOT_FOUND` por `jszip`, requerido por prueba G006-25 de paquete real. En la máquina del usuario ese caso sí pasó en G006; aquí no se registra como PASS. El entorno no contiene Vite, Electron ni Jolt instalados. Nuevo harness Electron con WebGL/Three real añadido, pero ejecución bloqueada por Vite ausente. Batería G002–G007: 188 PASS, 1 FAIL de entorno (`jszip`).

**INFERENCIA:** no hay evidencia de defecto de integración que justifique modificar producción en este Gate. Las pruebas Node y la revisión estática no sustituyen render GPU ni export real. La posibilidad de que `cameraExit.interrupted` sea requerida como transición ejecutable sigue como límite sin mecanismo autorizado de preempción. No se crea ese emisor por inferencia.

**CAUSA RAÍZ de bloqueos de QA:** ausencia de dependencias gráficas y de ejecución independiente en este contenedor; no se ha demostrado bug de producción por este motivo. Para `interrupted`, ausencia de emisor del motivo en `TimelineRunner`, distinta de la interrupción de un blend del mismo lease que sí está implementada.

## 2. Medios de verificación introducidos

- `scripts/test-camera-orchestration-s15-g007.mjs`: 19 casos de integración que ejercitan métodos productivos sobre un host mínimo, incluidos intérprete de eventos, scripting, arbitraje FilmMaker/Timeline, fuentes, perfiles, consumidores finales, cancelación por escena y compatibilidad de datos.
- `scripts/test-camera-orchestration-s15-g007-electron.mjs`: integra el runner Electron embebido existente, sin proceso de navegador alternativo.
- `scripts/fixtures/player/camera-orchestration-s15-g007.html`: carga módulos productivos mediante Vite, utiliza Three.js y WebGL real, mide framebuffer, FOV vertical, transformaciones, continuidad de blend y consumo de pose única. **No** simula ni certifica el Player exportado ni el proyecto completo Jolt.
- Matriz de QA local: Editor, Sin jugador, FPS, Camera3D, eventos, scripting, Cinematics, Timeline, Preview, pérdida de fuente, fuentes vivas, políticas y AppImage independiente.

No se agregaron managers, adaptadores de producción, importaciones paralelas, cambios de Player FPS ni migraciones.

## 3. Hallazgos que impiden cerrar S15 automáticamente

1. **Player independiente no verificado.** El build `dist-player` pasa en el equipo del usuario, pero falta crear desde la ventana Build el AppImage de un proyecto real, ejecutarlo fuera de Electron Editor y comprobar equivalencia.
2. **Electron G007 no verificado.** El harness existe y su código Node supera `node --check`; debe ejecutarse con las dependencias locales y revisarse el resultado WebGL.
3. **QA visual por escenario no registrado.** El «Aprobado» de G006 no documenta individualmente Cut, blend con destino móvil, Stop/Skip, GameManager ni cambio de escena.
4. **`interrupted` sin emisor aceptado de preempción.** Disponible en los datos del recurso; no indicar PASS de consumo runtime. G007 no autoriza crear un sistema de prioridades ni modificar el contrato; si se exige ese comportamiento para el cierre, formalizar corrección contractual/técnica independiente.
5. **Rendimiento p50/p95 no medido.** El objetivo de G007 es QA; registrar FPS/frame time únicamente con ejecución representativa sobre hardware real. No comparar números de mocks Node con FPS.

## 4. Veredicto de auditoría

**Implementación de medios QA: REALIZADA.** **Tests Node nuevos: PASS.** **Regresión histórica parcial en este entorno: 169 PASS / 1 FAIL de dependencia.** **Compilación G007: NO VERIFICADA aquí** (G006 Editor/Player PASS en el registro del usuario). **Electron WebGL, AppImage independiente, QA visual local y cierre S15: PENDIENTES**.

**Siguiente acción real:** aplicar CHANGE a la base que contiene G006, ejecutar comandos de `docs/qa/LF-CAMERA-ORCHESTRATION-S15-G007-INTEGRATION-QA-INTEGRAL_QA.md`, devolver resultados y, si surge defecto reproducido, corregirlo dentro del contrato autorizado antes del cierre. No iniciar todavía Timeline ni G008.

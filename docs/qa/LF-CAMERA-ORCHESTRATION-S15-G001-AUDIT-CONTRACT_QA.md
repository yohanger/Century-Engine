# LevelForge — S15-G001 Camera Orchestration · QA documental y plan de integración

**Gate:** `LF-CAMERA-ORCHESTRATION-S15-G001-AUDIT-CONTRACT` · **Fecha:** 2026-11-09.  
**Estado:** AUDITORÍA DE FUENTE COMPLETADA; **NINGUNA PRUEBA FUNCIONAL S15 EJECUTADA**. Parent Contract 001 RECOMENDADO, pendiente de ratificación; G001 pendiente de aprobación del usuario.

## A. Control documental de G001

| Control | Criterio | Estado |
|---|---|---|
| DOC-01 | SOURCE_BASELINE 2.937 archivos, ZIP íntegro; no sobrescribir fuentes originales | VERIFICADO POR LECTURA/INTEGRIDAD ZIP |
| DOC-02 | Cinemachine referencia independiente, versión y licencia reconocidas | VERIFICADO DOCUMENTAL |
| DOC-03 | Rutas reales de escritura de cámara, FOV, perfil, efectos y visibilidad enumeradas | VERIFICADO DOCUMENTAL |
| DOC-04 | Preview, Play Mode y Player separados; misma clase PlayMode usada en Player | VERIFICADO DOCUMENTAL |
| DOC-05 | S11-G002 y S05/FilmMaker CA-001/CA-002 contrastados; no duplicar contratos/código | VERIFICADO DOCUMENTAL |
| DOC-06 | Hallazgos distinguen OBSERVADO / INFERENCIA / CAUSA RAÍZ ESTÁTICA / NO VERIFICADO | VERIFICADO DOCUMENTAL |
| DOC-07 | G001 no crea code/runtime/tests/plantillas, ni modifica formatos `.lfproj/.nfm` | VERIFICADO POR DIFF: 2.936 originales intactos y solo ledger modificado |
| DOC-08 | Seis hojas del ledger reciben solo entradas S15; se conserva el histórico | VERIFICADO: una entrada G001 en cada hoja y tres evidencias en EVIDENCE; histórico preservado |
| DOC-09 | Contrato no se etiqueta APROBADO/CERRADO antes de ratificación y QA usuario | PENDIENTE APROBACIÓN USUARIO |
| DOC-10 | Todos los requisitos G002-G007 se consideran futuros, sin autorización implícita | VERIFICADO DOCUMENTAL |

La revisión documental **no equivale** a ejecución Node ni a QA de cámara real. Las referencias de línea verifican la versión de SOURCE_BASELINE de entrada; si cambia el código en un Gate futuro, volver a auditar.

## B. Matriz obligatoria de pruebas futuras — NO VERIFICADAS

**Todas las filas QA-CXX tienen estado `NO EJECUTADO · FUTURO GATE`**. No crear fixtures ni runners bajo G001.

| ID | Contexto/escenario | Resultado observable requerido | Gate propuesto |
|---|---|---|---|
| QA-C01 | Preview, Camera3D por sceneId+ID | Pose/FOV del nodo, no vista editorial | G003 |
| QA-C02 | Preview, padre Camera3D animado | Pose mundial tras pistas de nodo/bake | G003 |
| QA-C03 | Preview, dos Camera3D homónimas | Vincula por ID, no por nombre | G003 |
| QA-C04 | Preview, vínculo faltante/cambiado de escena | Diagnóstico y fallback definido, sin relink silencioso | G003 |
| QA-C05 | Preview, clave legacy `node`/`free`/`player` | Compatibilidad preservada o Amendment ratificado | G003 |
| QA-C06 | Timeline, 2 pistas de cámara, una sin pose | Última muestra válida; `null` no suprime otra | G003 |
| QA-C07 | Runtime, dos Timelines concurrentes | Precedencia estable, retorno al previo activo | G002/G006 |
| QA-C08 | PlayMode, GameManager por ID y `main` | Base definida, cinemática adquiere y suelta | G002 |
| QA-C09 | PlayMode, sesión FilmMaker + Timeline | Handoff/conflicto explícito, sin última escritura no documentada | G002/G006 |
| QA-C10 | Plantilla FPS, `lock:true` | No gira/mueve jugador si se pacta bloquear ambos; la cámara sigue cinemática | G004 |
| QA-C11 | Plantilla FPS, `lock:false` | Input permitido según contrato; vista cinemática no compite | G004 |
| QA-C12 | FPS tras fin/stop/skip | Vuelta a pose actual gameplay, controles y FOV sin salto | G004/G006 |
| QA-C13 | Sin jugador, sin GameManager/cámara | Sin fuente válida sigue negro/aviso, sin cámara editorial inventada | G004 |
| QA-C14 | Sin jugador, Timeline con Camera3D válida | Render visible mientras dure la cinemática | G004 |
| QA-C15 | Mismo paquete en PlayMode y Player exportado | Misma escena, cámara, FOV, cortes y transiciones | G004/G007 |
| QA-C16 | Start → pause → resume → seek → loop | Autoridad y frame calculados de forma determinista | G006 |
| QA-C17 | Stop/skip/scene switch/nodo eliminado | Release correcto; no crash ni referencia huérfana activa | G006 |
| QA-C18 | Interpolación y Mix de dos clips | Pos/quaternion/FOV conservados; perfil con regla explícita | G006 |
| QA-C19 | Camera Shake y Camera Motion durante toma | Sin doble shake, pose base estable; política de efectos ratificada | G006 |
| QA-C20 | Underwater, DOF, audio espacial, LOD | Todos usan cámara efectiva conforme al contrato | G002/G007 |
| QA-C21 | Selección jerarquía, gizmos, Timeline abierto | TransformControls existentes funcionan y no destruyen selección temporal | G005 |
| QA-C22 | Save/load/duplicación/proyectos viejos | Identidades y formato preservados; no migración destructiva | G007 |
| QA-C23 | Import `.nfm` → Cinematics → Play/Player | Ownership y vista importada intactos | G004/G007 |
| QA-C24 | Rendimiento N5030 UHD605 4 GB | Frame time p50/p95, FPS, CPU/GPU, memoria; sin regresión grave | G007 |

## C. Pruebas ya existentes que deben evaluarse en Gates posteriores

No se han ejecutado en S15-G001. Los nombres identifican runners que se **reutilizarán si continúan vigentes**, en lugar de inventar un harness nuevo:

- `scripts/test-timeline-camera-node-binding-s11-g002.mjs`
- `scripts/test-timeline-camera-node-binding-s11-g002-electron.mjs`
- `scripts/test-timeline-unity-replacement-s10-g006-integral.mjs`
- `scripts/test-cinematics-player-integration-s05-g004.mjs`
- `scripts/test-camera-shake-s01-g004.mjs`
- `scripts/test-player-camera-motion-electron-s01-g001.mjs`

**Aviso:** ejecutar `npm run build` solo constata compilación; `npm run electron`/pruebas Electron requieren Linux y sesión gráfica; el Player exportado requiere abrir el paquete real. No declarar PASS anticipado.

## D. QA que debe devolver el usuario para cerrar G001

1. Confirmación de que la matriz de rutas y defectos está descrita con precisión para su proyecto.
2. Aprobación o correcciones expresas de D03, D04, D06, D09 y D12 en `LF-CAMERA-ORCHESTRATION-S15-PARENT-CONTRACT-001.md`.
3. Ratificación textual independiente del Parent Contract cuando esté conforme. **Autorizar G001 no equivale a ratificar automáticamente el Parent Contract.**
4. Aprobación explícita del documento y del alcance G001; solo entonces considerar su cierre administrativo en un Gate autorizado que incluya actualizar ledger. No se solicita prueba visual de una función no implementada.

## E. Riesgos contractuales activos

- **RC-01:** cambio de fallback legacy `node` afecta compatibilidad S11-G002; bloquear y exigir Contract Amendment antes de cambiar semántica.
- **RC-02:** cámaras de autoría `.nfm` no son nodos Camera3D; no duplicar FilmMaker ni alterar CA-001/CA-002.
- **RC-03:** transición de autoridad y composición de Camera Shake sin regla firmada; no implementar por intuición.
- **RC-04:** FOV/ejes, perfiles y black-screen Sin jugador tienen causas estructurales observadas, no QA de usuario; reproducir antes de afirmar FIXED.
- **RC-05:** QA Player exportado es separado del build y del PlayMode en Editor.
- **RC-06:** `BL-TL-CAMERA-AUTOBIND-PENDING` y `BL-TL-CAMERA-GIZMO-PENDING` se conservan hasta auditoría funcional; no convertir en una duplicación de S11-G002.

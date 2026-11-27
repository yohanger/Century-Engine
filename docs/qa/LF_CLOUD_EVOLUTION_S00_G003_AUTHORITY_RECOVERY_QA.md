# G003 — QA documental y matriz de integración

**Gate:** `LF-CLOUD-EVOLUTION-S00-G003-AUTHORITY-RECOVERY-AND-CONTRACT-RECONCILIATION`.
**Modalidad:** solo documentación, sin runners nuevos, GPU nueva ni código productivo. **Verificación de paquete:** ejecución final registrada en `source-integrity.json`; G002/G003 ratificación bloqueada por P07.

## Matriz de consumidores y evidencia requerida antes de implementación

| Área | Fuente | Restricción preservada | Runners / futura evidencia |
|---|---|---|---|
| World/Director | `world.js`, CA Lifecycle | Un estado meteorológico, transiciones/tiempo explícitos | G001 Node + fade/save A/B futuro |
| CloudField | `cloudfield.js`, G001/G002 | Identidad, consultas y semilla existentes | `test-clouds.mjs`, G001 caracterización |
| CloudVolume | `cloud-volume.js`, `cloud-volume-state.js` | Condensado residente, snapshot, recentrado | G001 Node y fixture de convección Electron |
| Sky/Renderer | `skylib.js`, `viewport-env.js` | Shader único, sin duplicación GPU | `cloud-convection.html`, compilación WebGL2, geometría/oclusiones futuro |
| Tornado/VFX | Weather/Tornado CA y VFX Decoupling CA | Nube madre, fases World; VFX genérico | Runners Weather/Tornado y QA visual Player futura |
| Lluvia/rayos/luz | `cloudfield-query.js`, World | Coherencia de consumidores | `test-atmosphere.mjs`, casos A/B GPU futuros |
| Editor | `scene-graph.js`, `scene/environment.js` | `liveFx` multi consumidor; no borrar preview FX | Edit/Play/Stop y validación de estado de escena futura |
| Script API | `world/api.js`, `game-api.d.ts` | Mantener `cloudModel` hasta ratificación | API Node, VSCode sync, Runtime futuro |
| Persistencia | `play-saves.js`, `CloudVolume.snapshot` | Proteger datos de usuario; sin migraciones ficticias | Save/load durante fade 25/50/75%, Player futuro |
| Perfilado | perf/render presets | Sin 60 FPS prometidos por tests unitarios | p50/p95, CPU/GPU, memoria en N5030 4 GB futuro |

## QA propio de G003

- [x] Índice y SHA-256 del SOURCE_BASELINE de G002 contrastado.
- [x] Documentos completos Weather/Tornado, Lifecycle y VFX Decoupling revisados.
- [x] Fuente P07 buscada: declarar solo los lugares inspeccionados; registrar Library materialization denegada.
- [x] Matriz de precedencia no presenta los borradores como ratificados.
- [x] G002 fuente preservada sin reescritura.
- [x] Módulos productivos y runners con SHA-256 idéntico al G002.
- [x] CHANGE aplicado al G002 reconstruye íntegramente el SOURCE_BASELINE G003.
- [x] Ledger conserva 6 hojas y los registros anteriores, añadiendo G003.
- [x] PDF (si se entrega) representa fielmente el informe y se inspecciona renderizado.

## Limitaciones explícitas

- G001 WebGL2 local PASS; **G003 no ejecutó GPU ni editor**.
- No hay QA local posterior a G002 aportado para este Gate.
- La recuperación del texto íntegro P07 está BLOQUEADA; una ausencia en el árbol actual no demuestra que no exista en otra ubicación.
- G002 y cualquier Amendment siguen pendientes de ratificación; ningún Gate de implementación está autorizado.

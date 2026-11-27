# LF-CLOUD-EVOLUTION-S01-G001 — Trazabilidad

| Cláusula | Código | Evidencia | Decisión QA |
|---|---|---|---|
| CA-002-01 World authority | `world.js` | S01-13, World lightning S11 | Node PASS |
| CA-002-02 Identidad CloudField | `cloudfield.js` | S01-03, S01-05 | Node PASS |
| CA-002-03 Condensado CloudVolume | `cloud-volume.js` | S01-04, S01-07, G001-05 | Node PASS |
| CA-002-04 Morfología sin intercambio | `cloudfield.js` | S01-03, S01-04, S01-06 | Node PASS; visual pendiente |
| CA-002-05 Único renderer | `sky-cloud-volume.js`, `viewport.js` | S01-08, fixture S01 Electron | Fuente PASS, GPU pendiente |
| CA-002-06 Edit/Play/Runtime | `scene-graph.js`, `viewport.js` | S01-12, fixture Electron | Node PASS; QA GUI pendiente |
| CA-002-07 Clima, luz y fenómenos | `world.js`, API existente | S01-14, lightning S11, tornado S02/S04 | Node PASS; Player pendiente |
| CA-002-08 Residencia/persistencia | `cloud-volume.js`, `world.js`, `play-saves.js` | S01-07, S01-09..11, G001 04..06 | Node PASS; GPU y guardado Player pendiente |
| CA-002-09 GPU base RG8 | `sky-cloud-volume.js`, `cloud-volume.js` | S01-08, fixture Electron | Node PASS; WebGL2 pendiente |
| CA-002-10 Trabajo protegido | `params.js`, `ScenePanel.vue`, `play-saves.js` | S01-01/02, hashes y ZIP | Verificación binaria y Node pendientes al empaquetar |

**Antecedentes:** G001 Validation conserva su evidencia histórica en fuente G003; el runner de caracterización actual se actualiza para verificar el estado nuevo sin reemplazar la evidencia anterior. G002/G003 aprobados y CA-002 ratificado por mensajes de usuario; su registro formal se incorpora al ledger de S01.

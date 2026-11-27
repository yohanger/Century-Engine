# LF-CLOUD-EVOLUTION-S01-G001-CORR-001 — Trazabilidad

| Contrato | Código / interfaz | QA | Evidencia / límite |
|---|---|---|---|
| CA-002-01 autoridad World | Sin cambios de World; `CloudField.update()` recibe forzado existente | S01-13 / Weather | 132 PASS; Editor/Player local pendientes |
| CA-002-02 identidad del campo | `cloudfield.js:evaluate`, `primitives`; 6 lóbulos por celda | M3D-06/07 | Mismos seeds y referencias; MORPH no altera la geometría |
| CA-002-03 condensado único | `cloud-volume.js:_stamp`, `advance`, `data` | M3D-08/09/11 | Bit-exacto en muestra de referencia |
| CA-002-04 evolución y morfología continua | `cloudBody`, `evaluate`, `primitives` | M3D-01..06, S01 | A/B geométrico, falta conformidad visual |
| CA-002-05 Sky único | `cloudfield-bake` / `sky-cloud-volume`; `skylib.js` intacto | M3D-10 / Electron 17 | RG8 204800 B; QA GPU pendiente |
| CA-002-06 Edit/Play/Runtime | Ninguna modificación fuera de CloudField/CloudVolume | S01-12 + inspección local | Test Node PASS; QA Editor/Player pendiente |
| CA-002-07 Consumers | API CloudField, Weather, relámpagos, tornado y luz no renombrada | Weather/Tornado/Atmosphere 132 | Runners PASS, visión de efectos pendiente |
| CA-002-08 continuidad espacial | `CloudVolume` mantiene recenter y estado | S01-07; M3D-11 | Teletransporte y snapshot no alterados en este Gate |
| CA-002-09 mínimo recurso GPU | 16 niveles, RG8, raymarch sin cambios | M3D-10 | 204800 B; perf GPU pendiente |
| CA-002-10 preservar proyecto | Sin cambios de schema, escenas, assets ni proyecto usuario | Comparación SHA del SOURCE_BASELINE | CHANGE sin eliminaciones, QA integridad ZIP |
| Gate CORR-001 morfología 3D | Dos módulos productivos, fixture reutilizada | M3D-01..11, Electron 17 previstos | Vídeo usuario: aplanamiento; nuevo QA local pendiente |

## Distinciones de certeza

- **OBSERVADO:** el viejo campo daba 180,1 m de envolvente mediana parcialmente nublada con seed42, sizeMul2; el nuevo 702,9 m. Volumen de 5 a 9 capas activas; CPU QA 132 PASS.
- **INFERENCIA:** más cuerpo vertical debería reducir discos aparentes, sin demostración de fotorealismo hasta observar Electron.
- **HIPÓTESIS ABIERTA:** la cuantización de 16 capas y el patrón de raymarch pueden limitar irregularidades perceptuales más finas.
- **DECISIÓN PENDIENTE:** aceptar CORR-001 tras QA local; no autorizado aumentar recursos GPU o sustituir shaders sin pruebas adicionales.

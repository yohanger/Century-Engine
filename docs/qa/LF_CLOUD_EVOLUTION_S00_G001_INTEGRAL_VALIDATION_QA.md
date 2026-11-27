# LF-CLOUD-EVOLUTION-S00-G001-INTEGRAL-VALIDATION — Auditoría y QA

**Fecha:** 2026-11-17. **Estado:** RUNNERS IMPLEMENTADOS · NODE TEST PASS · GPU/COMPILADO/QA LOCAL NO VERIFICADO · NO APROBADO · NO CERRADO.

**Baseline de entrada:** `LF_VOLUMETRIC_CLOUDS_S01_G001_CORR003_NATURAL_SCALE_CALIBRATION_SOURCE_BASELINE.zip` (SHA-256 `3cad7c78c0b9ec9d0df55f7fa4b1ee79f991f5852684966646e6473076dd9df3`). No se modificaron los módulos de producción, ni `package.json`, ni se publicó en GitHub.

## 1. Hallazgos demostrados / límites

| ID | Método | Dato reproducido | Interpretación y límite |
|---|---|---|---|
| G001-01 | CloudVolume + shader fuente | 32×32×16 = 16.384 voxels; 32.768 B, dos canales temporales R/G | Datos de densidad; sin atributo morfológico explícito en la textura 3D |
| G001-02 | Fuentes con igual forma/fuerza, etiquetas de estrato 0 y cumulonimbo 1 | Arreglos de densidad 3D idénticos | `type` de la fuente no lo consume CloudVolume. **No** prueba que diferentes formaciones completas se vean idénticas: su geometría sí puede variar |
| G001-03 | Mismo volumen, recentrado 200 m | Densidad núcleo 1 → 1 | Caso de solapamiento cercano, no valida cualquier velocidad o dirección |
| G001-04 | Salto espacial 20.000 m | Densidad 1 → 0 al publicar, 0 a 0,5 s y ~0,20 a 1 s | Discontinuidad del condensado residente; no certifica cómo aparece en cámara |
| G001-05 | Save/restore CloudVolume a mitad del paso | Muestra periférica 0,390678 → 0,390557 (diferencia ~0,000120); `blend=0,5`, `pending=0,25`; 5896 caracteres RLE base64 | Recuperación volumétrica del caso, no de toda la climatología |
| G001-06 | Transición `partly` → `storm`, 20 s | A 5 s hay `_fade`; guardado Player almacena campo + volumen, no `_fade` | No garantiza reanudar exactamente la transición; `load` llama `setWeather(..., 0)` |
| G001-07 | `world.update(0.5,{clock:false})` | Hora 13 → 13; evolución de CloudField 0 → 0,5; versión de volumen 1 | El Editor puede avanzar el condensado si `liveFx` está activo |
| G001-08 | Inspección de consumidores `liveFx` | Tiempo visual de Sky, precipitación y naturaleza comparten la bandera | No suprimir `liveFx` globalmente como atajo para hacer Edit Mode estático |
| G001-09 | Inspección fixture Electron | `Viewport`, textura 3D, imágenes de cámara suelo/aire y lectura GL preservadas | Integración GPU visual pendiente de ejecutarse |

**Clasificación:** OBSERVADO (código y Node) para valores anteriores. INFERENCIA: cambios de aspecto tras teletransporte o falta de diversidad visible. HIPÓTESIS PENDIENTE: el coste/beneficio de transportar atributos adicionales en GPU. DECISIÓN PENDIENTE: formato GPU, política de residencia y reconciliación de Edit Mode.

## 2. Ejecución de pruebas

| Comando | Resultado | Evidencia |
|---|---|---|
| `node --test scripts/test-cloud-evolution-integral-validation-g001.mjs` | **9 PASS / 0 FAIL** | `g001-node.log` |
| `node scripts/test-clouds.mjs` | **103 OK / 0 FAIL** | `clouds.log` |
| `node scripts/test-atmosphere.mjs` | **31 OK / 0 FAIL** | `atmosphere.log` |
| `node --test scripts/test-cloud-altitude-horizon-corr002.mjs scripts/test-cloud-natural-scale-corr003.mjs` | **16 PASS / 0 FAIL** | `focal.log` |
| `node --test scripts/test-weather-tornado-natural-s01-g001.mjs` | **12 PASS / 6 FAIL** | `tornado-compat.log` |
| Mismo runner sobre árbol CORR-003 original, sin G001 | **12 PASS / 6 FAIL** exactamente los mismos IDs | `corr003-original-tornado.log` |
| `node --check` nuevos runners y JavaScript inline de la fixture existente | **PASS sintaxis** | `fixture-syntax.log` |
| `node --test scripts/test-cloud-evolution-electron-g001.mjs` | **BLOQUEADO: falta Vite** | `gpu-qa-attempt.log` |

Los seis fallos de compatibilidad preexistentes son `TN1-08`, `TN1-09`, `TN1-10`, `TN1-11`, `TN1-14` y `TN1-16`. No se corrigieron ni se atribuyen a este Gate. La batería no sustituye QA visual en Electron.

## 3. Fixture GPU existente extendida

`scripts/fixtures/weather/cloud-convection.html` pasó de 9 a **12 verificaciones** sin cambiar `Viewport`, `SKY_FRAG` ni `CloudVolume` de producción. Los tres nuevos checks observan tamaño/formato temporal de la textura remitida, equivalencia de condensado con distinta etiqueta de tipo y reconstrucción después de recentrado distante. El runner específico `test-cloud-evolution-electron-g001.mjs` exige las 12 comprobaciones en un Electron real y usa `qa-electron-webgl-runner.mjs` existente.

**No verificado:** compilación/enlace del shader en GPU, capturas automáticas, observación de discontinuidades de imagen, efectos de oclusión con geometría, Player exportado y FPS/VRAM en el hardware objetivo. `npm run build` no se declara PASS en ausencia de Vite. El runner GPU informa explícitamente el prerrequisito fallido.

## 4. QA local requerido para decisión técnica

1. En la misma base, disponer de dependencias del proyecto, ejecutar `node --test scripts/test-cloud-evolution-electron-g001.mjs` y guardar TAP completo.
2. Abrir `npm run electron` y comprobar la convección y la persistencia de formaciones durante cambios de clima. Capturar secuencias, no solo una imagen.
3. Repetir con cámara desde suelo y aire, desplazamiento normal y teletransporte > amplitud del dominio residente; registrar el instante previo, la primera imagen posterior y un segundo después.
4. Inspeccionar composiciones con Terrain, geometría opaca, niebla y lluvia. Comparar lo visual con el mismo volumen del World.
5. Registrar FPS, memoria residente, tiempo CPU/GPU y transferencias de textura si el backend las expone, para Compatibility/Mobile/Forward+; hardware objetivo N5030/4 GB cuando esté disponible.
6. Determinar el alcance del cambio contractual de Edit Mode respecto a opciones editoriales de efectos existentes antes de modificar `liveFx`.

## 5. Cierre condicionado

El objetivo de instrumentación y Node quedó implementado y documentado. El Gate **no está aprobado ni cerrado**: falta QA WebGL2/Editor/Player y el usuario debe aceptar la evidencia. No ratificar formato GPU, política de memoria o estrategia de evolución completa sin las pruebas restantes.

## 6. Adenda de QA local posterior a la entrega (17-11-2026)

El apartado 5 refleja el estado **en el momento de entrega de G001**. Con posterioridad, el usuario aportó el terminal completo de ejecución y declaró «Aprobado. No vi errores al arrancar el motor». La evidencia se conserva sin modificar en `docs/qa/evidence/lf-cloud-evolution-s00-g002/g001-local-user-2026-11-17.log`: **9/9 Node PASS**, **12/12 verificaciones Electron WebGL2 PASS**, **0 errores GLSL/WebGL en la fixture**, `npm run electron` compiló con Vite **933 módulos**. Resultado: **G001 APROBADO POR USUARIO**, no cerrado formalmente por la ausencia de QA Player exportado, benchmarking sostenido y secuencias de la futura evolución. No se atribuyen estos resultados a G002 ni se borran los bloqueos históricos del runner inicial.

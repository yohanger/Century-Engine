# LF-CLOUD-EVOLUTION-S01-G001-CORR-001 — Morfología tridimensional natural

**Estado:** IMPLEMENTADO EN FUENTES · NODE 132/132 PASS · QA GPU LOCAL NO VERIFICADO · APROBACIÓN DE LA CORRECCIÓN PENDIENTE.

## 1. Autoridad y límites

Unidad autorizada literalmente: `LF-CLOUD-EVOLUTION-S01-G001-CORR-001-NATURAL-3D-CLOUD-MORPHOLOGY`. Fuente inicial: SOURCE_BASELINE aprobado `LF_CLOUD_EVOLUTION_S01_G001_INTEGRAL_CONTINUOUS_ATMOSPHERIC_EVOLUTION_SOURCE_BASELINE.zip`; no se presume paridad con modificaciones locales desconocidas. Contrato G002 aprobado, G003 aprobado, CA-002 ratificado, S01-G001 aprobado por usuario; evidencia local del usuario: 14 Node, 14 WebGL2 y Vite 933 módulos PASS. No modificar el propietario World, no simular otro cielo, no reintroducir morfologías discretas, no aumentar canales RG8, resolución vertical o pasos de raymarch sin evidencia.

**Incidencia observada:** vídeo de usuario `Screencast from 2026-11-17 22-08-02.webm` en PlayMode: masas predominantemente ovaladas y muy planas. Defecto perceptual de espesor aparente; no constituye fallo automático de shader, temporalidad ni meteorología.

## 2. Diagnóstico diferencial

**OBSERVADO EN CÓDIGO:** la ruta S01-G001 aplicaba `cloudSize` principalmente al radio horizontal; la extensión vertical de lóbulos poco convectivos usaba una base de aproximadamente `0.24 × thick`. Los cúmulos con `cloudSize=2` tenían una envolvente vertical mediana de 180,1 m frente a radios horizontales del orden de 1.250 m; el horneado producía cinco niveles verticales activos (configuración de referencia). CloudVolume representa 16 niveles y un máximo de 80×80 texeles de planta. El shader conservaba las mismas muestras y presupuesto de raymarch.

**INFERENCIA SUSTENTADA:** geometría inicial, más que etiqueta MORPH, causaba el aplanamiento relativo. La voxelización de 16 niveles puede limitar el relieve fino, pero no se demuestra como causa única. No existe una comparación visual A/B aprobada después de la modificación.

## 3. Modificaciones implementadas

### CloudField — misma autoridad y seis lóbulos estables

En `src/engine/runtime/world/cloudfield.js`, la función continua interna `cloudBody(sheet, wispy, condensate)` combina la estructura estratiforme, filamentosidad y condensado; no consulta `MORPH`. `evaluate()` guarda el factor de tamaño `this.sizeMul`, mantiene el espesor anterior como base y añade desarrollo proporcional al cuerpo nuboso, al tamaño y al estado convectivo. La contribución se atenúa para estratos secos/cirros y convección ya intensa.

`primitives()` conserva seis lóbulos por celda, índices, semilla, identidad y reutilización de objetos, pero añade desplazamiento vertical graduado (`loft`), espesor del cuerpo y ajuste horizontal leve. Cambiar exclusivamente la etiqueta `MORPH` ya no modifica ni una primitiva. No se crean meshes ni controladores adicionales.

### CloudVolume — menos recorrido de vóxeles vacíos, mismos valores

En `src/engine/runtime/world/cloud-volume.js`, `_stamp` limita el bucle horizontal a la intersección de cada fila con la envolvente elipsoidal `r²<2`. **Conserva íntegros los límites anteriores de `_sourceRanges`**, ya que acortarlos habría modificado los valores de advección en pasos posteriores. Se incluyó una comparación bit a bit de `_core`, `_lift` y diez estados consecutivos de `data` frente a una implementación rectangular de referencia dentro del runner: PASS. No cambian formato RG8, profundidad, fuentes, transporte, snapshots ni API pública.

### Integración y shader

La ruta preexistente `CloudField → cloudfield-bake → CloudVolume → Sky` continúa siendo única. La altura de la losa y del volumen se obtiene del campo de primitivas, por lo que crece automáticamente hasta incluir las nuevas cimas. No se cambió `SKY_FRAG`, presupuesto de raymarch ni número de canales o texturas. World, clima, guardado, Player, Inspector, relámpagos, lluvia y tornados permanecen inalterados en código productivo; las regresiones relevantes se repitieron.

## 4. A/B geométrico reproducible

Medición con `seed=42`, `cloudSize=2`, mismas funciones `PRESETS`, mismo origen. `medianVisibleSpanM` mide la **extensión vertical de las envolventes de primitivas**, NO altura de una nube reconstruida por render o percepción fotográfica. Las capas verticales activas se cuentan con densidad del canal de volumen superior a 60 y más de cinco vóxeles activos por capa.

| Clima | Mediana S01 (m) | Mediana CORR-001 (m) | Capas S01 → CORR-001 | Dominio volumétrico anterior → nuevo (m) |
|---|---:|---:|---:|---:|
| `partly` | 180,1 | 702,9 | 5 → 9 | 800 → 1.500 |
| `cloudy` | 214,7 | 596,8 | 6 → 9 | 800 → 1.300 |
| `overcast` | 253,8 | 445,8 | 8 → 10 | 800 → 1.000 |
| `storm` | 2.997,8 | 3.209,1 | 15 → 15 | 4.200 → 4.500 |

Cada caso conserva el número de formaciones activas; la textura 3D continúa con 16 niveles verticales y 204.800 bytes en la muestra. Un dominio vertical más alto **reduce la resolución métrica por nivel**, por lo que filamentos finos no quedan certificados. El objetivo geométrico es volumen natural diverso, no aumentar indiscriminadamente todos los espesores.

Comandos comparativos, aplicados por separado a S01-G001 y al presente SOURCE_BASELINE:

```bash
node scripts/measure-cloud-morphology-corr001.mjs
node scripts/bench-cloud-morphology-corr001.mjs
```

Para comparar contra S01-G001, el script de medición puede ejecutarse desde esa base usando su API existente; no agregarlo al directorio anterior salvo en una copia de ensayo. Las capturas JSON emparejadas están en `docs/qa/evidence/LF_CLOUD_EVOLUTION_S01_G001_CORR001/`.

## 5. Riesgos, costes y decisiones conservadas

- El horneado CPU recorre fuentes más altas en ciertos climas. Los microbenchmarks aislados fueron variables en el contenedor (orden de 2–7 ms). **No se acredita optimización de FPS, GPU ni rendimiento en N5030/4 GB**.
- La optimización de `_stamp` es de recorrido, sin cambio numérico en la muestra de diez pasos; no se ha probado bit-equivalencia para toda escena imaginable.
- La representación volumétrica RG8 y 16 capas puede ocultar relieve fino pese a los volúmenes más altos. Solo QA visual puede validar calidad.
- La altura de capas atmosféricas convectivas puede variar según `sizeMul` y presets; se conservan límites actuales y pruebas de horizonte/escala natural.
- Se mantienen la ruta `classic` almacenada para escenas existentes y la autoridad de `cells` para escenas nuevas; no se retiran datos de proyectos.

## 6. Evidencia y salida del Gate

Cambios de producción limitados a `cloudfield.js` y `cloud-volume.js`. Runners incorporados: `test-cloud-natural-3d-morphology-corr001.mjs`, `measure-cloud-morphology-corr001.mjs`, `bench-cloud-morphology-corr001.mjs`. Se amplían `scripts/fixtures/weather/cloud-convection.html` y `scripts/test-cloud-evolution-electron-s01-g001.mjs` de 14 a 17 comprobaciones gráficas, sin crear otro laboratorio de rendering. Ver documentos QA y TRACEABILITY de este mismo Gate.

**Estado al entregar:** IMPLEMENTADO · NODE TEST PASS · BUILD NO VERIFICADO · QA ELECTRON/PLAYER NO VERIFICADO · USUARIO AÚN NO APRUEBA CORR-001 · NO CERRADO.

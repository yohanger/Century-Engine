# QA LevelForge · S13-G008-G002 · Geometría temporal

## Evidencia instrumentada

| Prueba | Estado | Archivo |
|---|---|---|
| Node focal | **24 PASS / 0 FAIL** | `docs/qa/evidence/LF_S13_G008_G002_NODE_FOCAL.log` |
| Node compatible (41 scripts) | **543 PASS / 16 SKIP / 0 FAIL** | `docs/qa/evidence/LF_S13_G008_G002_NODE_COMPATIBLE.log` |
| Node ampliado (51 scripts) | **601 PASS / 18 SKIP / 10 FAIL preexistentes** | `docs/qa/evidence/LF_S13_G008_G002_NODE_EXPANDED.log` |
| Misma batería sobre CORR-003 | **577 PASS / 18 SKIP / los mismos 10 FAIL** | `docs/qa/evidence/LF_S13_G008_G002_BASELINE_NODE_EXPANDED.log` |
| Electron embebido (43 comprobaciones) | **NO VERIFICADO**: Electron/Vite no presentes | `docs/qa/evidence/LF_S13_G008_G002_ELECTRON_ENV.log` |
| Compilación Editor+Player | **NO VERIFICADO**: `vite: not found` | `docs/qa/evidence/LF_S13_G008_G002_BUILD_ENV.log` |
| QA usuario | **PENDIENTE** | Evidencia local requerida |

Los SKIP no son PASS. Los diez fallos ampliados son preexistentes; no se ha eliminado ninguna prueba, ni reescrito contrato externo para silenciarlos. El nuevo Gate añade 24 pruebas de proyección y una fixture Electron que monta el TimelinePanel real.

## Comandos desde la raíz del proyecto activo

```bash
node --test scripts/test-timeline-temporal-geometry-s13-g008-g002.mjs
node --test scripts/test-timeline-temporal-geometry-s13-g008-g002-electron.mjs
node --test scripts/test-timeline-audio-trim-duration-s12-g002-electron.mjs
node --test scripts/test-timeline-zoom-waveform-s12-g003-electron.mjs
npm run build
npm run electron
```

**Esperado:** GEO-01..24 PASS; Electron 1 PASS con **43/43 checks**; regresión de audio y zoom 1 PASS cada una; build Editor+Player exitoso. En Electron verificar primero las 43 comprobaciones sin relajar ni desactivar fallidas.

## QA visual y funcional del usuario

1. En tiempo cero existe un espacio de 24px entre el área de pistas y el primer instante; no se modifica el valor persistido `t=0`.
2. Clips Cámara/Nodo con duración 1/2/4 segundos muestran anchos relativos 1:2:4, sin límite visual de 144px para clips de duración.
3. Audio ocupa duración efectiva sin convertir `duration=0` a un valor persistido; waveform, asa derecha, offset/pitch y fundidos continúan alineados.
4. La física horneada usa ancho temporal exacto y no crece por padding.
5. Reglas, marcadores, cabezal blanco, Snap, grips, rangos y curvas siguen alineados en zoom bajo, normal y alto.
6. Ctrl+rueda ancla el mismo segundo bajo el cursor; al desplazar la pista horizontalmente, el cabezal y los clips no se separan de la regla.
7. Arrastrar claves, clips, marcador y duración global; doble clic en pista y selección por región no desplazan el tiempo lógico.
8. Probar panel acoplado y estrecho, cabeceras fijadas, corchete global y barra horizontal; controles sin solapes nuevos.
9. Guardar, cerrar y reabrir: mismas duraciones, claves, offsets y marcas; no se agrega propiedad `timeOrigin` al proyecto.
10. Preview/Player conservan sonido y temporización; no asumir PASS visual del Player solo porque compila.

**Devolver:** salida Node focal, Electron 43 checks, Electron audio/zoom, build, captura(s) antes/después y evaluación explícita de QA. **Estado: implementado, NO APROBADO / NO CERRADO** hasta QA y aceptación.

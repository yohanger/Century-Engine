# QA — S12-G006-G002-INTEGRAL

**Estado:** implementado, **Node focal PASS**, Electron/compilación NO VERIFICADOS, QA LOCAL pendiente, NO APROBADO/NO CERRADO.

## Contrato de aceptación

| ID | Evidencia exigida |
|---|---|
| FX-UX-01 | Clave Audio sin `fx`: cero sección/editor FX privado |
| FX-UX-02 | Clave con `fx: []`: cero sección/editor FX privado |
| FX-UX-03 | Clave con FX: resumen visible de solo lectura con cantidad, tipos, orden y activación |
| FX-UX-04 | Seleccionar, reabrir y cambiar de clave no modifica `key.fx` |
| FX-UX-05 | Serialización guarda IDs, parámetros, orden, `on` y grupo |
| FX-UX-06 | `AudioMixerInspector.vue` sigue editando FX de bus, no FX de voz |
| FX-UX-07 | Dos voces en el mismo bus conservan DSP privado aislado (G005) |
| FX-UX-08 | Preview, Player ordinario/avanzado y export mantienen FX y audio |
| FX-UX-09 | Fundidos, automatización, transporte y PCM sin regresiones |
| FX-UX-10 | Node, Electron integrado, Editor/Player build y QA auditivo del usuario aprobados antes de cerrar |

## Pruebas ejecutadas durante preparación

| Prueba | Resultado |
|---|---|
| Node focal G005 + G005 CORR001 + G006 + G002 | 62 PASS, 2 SKIP, 0 FAIL |
| Node compatible de audio, FX, Mixer, Timeline (16 archivos) | 226 PASS, 3 SKIP, 0 FAIL |
| Sintaxis JS de componente y fixture | PASS (`node --check`, no compilación Vue) |
| Electron integrado nuevo S12-G006-G002 | NO VERIFICADO: falta `node_modules/vite/bin/vite.js` |
| `npm run build` Editor/Player | NO VERIFICADO: `vite: not found` |
| QA visual y auditivo local | PENDIENTE |

Los 3 SKIP de Node compatible corresponden a dependencias que faltan en el entorno. **Advertencia de regresión preexistente:** una prueba amplia adicional obtuvo AMI-15 FAIL, AMI-17 FAIL y waveform G003 FAIL por falta `@vue/compiler-sfc`; se ejecutaron las mismas pruebas en el SOURCE_BASELINE anterior y se reprodujeron los tres fallos. Ver `docs/qa/evidence/LF_S12_G006_G002_BASELINE_PREEXISTING_FAIL.log`. No se modificaron para ocultarlos.

## Comandos requeridos desde la raíz de LevelForge (`package.json`)

```bash
node --test scripts/test-timeline-audio-clip-fx-ux-s12-g006-g002.mjs scripts/test-timeline-audio-clip-effects-s11-g005.mjs scripts/test-timeline-audio-clip-effects-s11-g005-corr001.mjs scripts/test-timeline-audio-integration-persistence-s11-g006.mjs
node --test scripts/test-timeline-audio-clip-fx-ux-s12-g006-g002-electron.mjs
node --test scripts/test-timeline-audio-clip-effects-s11-g005-electron.mjs
npm run build
npm run electron
```

Esperado focal 62 PASS / 2 SKIP donde falten `jszip` y dependencias Player; con dependencias instaladas esas dos deben ejecutarse y pasar. Fixture nueva exige **30 checks** y el runner histórico G005 conserva 40 checks mínimo. No equivale a QA visual local si los logs son PASS: usuario debe seleccionar Audio sin FX, `fx:[]`, Audio con FX, escuchar en Preview y Player y editar FX del bus en Mixer. Conservar mensajes de fallo completos con `stage` y `checks`. No atribuir PASS a ningún paso no ejecutado.

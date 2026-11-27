# QA — S14-G001 CORR-001

## Resultados observados

| Medio | Resultado | Evidencia |
|---|---|---|
| Node focal G001 + CORR001 | 26 PASS / 0 FAIL | `evidence/LF_S14_G001_CORR001_NODE_FOCAL.log` |
| Chromium CDP aislado | Antes `[-1]`; después `[-27,-59,-1]` | `evidence/LF_S14_G001_CORR001_CHROMIUM_CDP.log` |
| Regresión histórica sobre baseline S14-G001 | 80 PASS / 8 SKIP / 2 FAIL | `evidence/LF_S14_G001_CORR001_BASELINE_REGRESSION.log` |
| Regresión histórica sobre CORR001 | 80 PASS / 8 SKIP / 2 FAIL | `evidence/LF_S14_G001_CORR001_NODE_REGRESSION.log` |
| Electron completo | NO VERIFICADO; Vite ausente | `evidence/LF_S14_G001_CORR001_ELECTRON_ENV.log` |
| Build Editor y Player | NO VERIFICADO; Vite ausente | `evidence/LF_S14_G001_CORR001_BUILD_ENV.log` |
| QA visual y sonoro | PENDIENTE USUARIO | — |

## Procedimiento local desde la raíz (package.json)

1. Ejecutar focal: `node --test scripts/test-audio-mixer-fader-gain-s14-g001.mjs scripts/test-audio-mixer-fader-gain-s14-g001-corr001.mjs` (26 PASS esperados).
2. Ejecutar Electron: `node --test scripts/test-audio-mixer-fader-gain-s14-g001-electron.mjs` (1 PASS esperado; todas sus verificaciones internas, sin ocultar fallos).
3. Regresiones de Inspector y routing: `node --test scripts/test-audio-mixer-inspector-electron-s02-g001.mjs` y `node --test scripts/test-timeline-audio-mixer-routing-s11-g004-electron.mjs`.
4. Compilación: `npm run build` (Editor y Player); abrir `npm run electron`.
5. En Audio Mixer, arrastrar Master, Música, SFX, Voz, Ambiente, UI y un grupo personalizado. Comprobar valores intermedios, ambos sentidos, −∞ solo en silencio, texto, Inspector, ganancias reales, Mute/Solo/Bypass y snapshots.
6. Devolver salida completa y evaluación visual/sonora. No inferir PASS por Node.

## Interpretación de fallos

Las dos pruebas Node históricas AMI-15/17 permanecen en FAIL sobre baseline S14-G001 y CORR001; no pertenecen a los pasos CDP de este Gate ni fueron modificadas. No se desactivaron pruebas.

Si Electron falla de nuevo, usar la primera aserción y su `actual` para distinguir fixture vs comportamiento de producción antes de cualquier modificación.

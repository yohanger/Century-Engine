# QA — Inventario de activación meteorológica (Electron)

Estado: **PENDIENTE DE QA ELECTRON LOCAL**.

## Prerrequisitos

Ejecutar sobre el SOURCE_BASELINE de S04 con el CHANGE diagnóstico aplicado, o sobre el nuevo SOURCE_BASELINE diagnóstico aislado. Electron y Vite deben estar instalados vía `npm ci`. No hace falta Chromium ni Brave externo.

## Comandos (desde la raíz de LevelForge)

1. `node --test scripts/test-weather-storm-activation-contract-g001.mjs`
2. `node --test scripts/test-weather-storm-activation-electron-g001.mjs`
3. Opcional: `LF_QA_CAPTURE_DIR=./qa-weather-captures node --test scripts/test-weather-storm-activation-electron-g001.mjs`

Los tests Node comprueban el contrato de activación. El segundo comando arranca **Electron real** y debe mostrar `LF_WEATHER_ACTIVATION_AUDIT:` con los once estados. Si falla, devolver salida íntegra, especialmente `gpuError` y stack.

Las capturas se guardan en `qa-weather-captures/storm-audit-result.png` cuando se configura la variable. Esa carpeta es evidencia local temporal: no incorporarla a Assets del proyecto, a ningún ZIP o al ledger como PASS automático.

## Procedimiento visual en el proyecto real

Mantener cámara, escena, render Compatibility y posición iguales. Deshabilitar tornados y rayos. Anotar el primer preset que muestra el rectángulo: Despejado → Nublado → Cubierto → Llovizna → Lluvia → Tormenta → Despejado. Capturar cada cambio. Hacer una segunda pasada en Play.

Comparar el mosaico del harness con las capturas del proyecto. Si el problema surge desde Llovizna, priorizar lluvia y bruma; si aparece sin lluvia, revisar cielo/niebla/postprocesado o materiales de objetos. Solo una reproducción causal autoriza corregir el responsable.

## Evidencia que debe devolver el usuario

Salida Node, salida Electron estructurada, PNG del mosaico cuando sea posible, capturas de Llovizna y Tormenta en el Editor real y errores de consola. **No declarar FIXED, QA LOCAL PASS ni CERRADO sin esa evidencia.**

# QA CORR-001 — Inspector de puntos de volumen S12-G007-G001

## Motivo y evidencia anterior

Gate original: `LF-INSPECTOR-AUDIO-VOLUME-POINTS-S12-G007-G001-INTEGRAL`.

El usuario ejecutó Electron real sobre su Linux/LevelForge y aportó el registro completo en `docs/qa/evidence/LF_S12_G007_G001_CORR001_USER_ELECTRON_G001_FAIL.log`.

- **82/82 PASS Node** originales, según el registro aportado.
- **40 comprobaciones Electron ejecutadas; todas con `pass: true`**, incluida la última, «Collapsar no cambia interpolación».
- Suite Electron **FAIL**, pues `checks.length===36` evaluaba `false` con cuarenta comprobaciones; el runner exigía mínimo 36.
- WebGL `gl: true`. El fallo **no demuestra defecto funcional del Inspector**, y no hay permiso para modificar producción en CORR-001.

## Corrección de contrato QA

1. Mantener íntegros los nombres y lógica de las 40 comprobaciones existentes.
2. Fixture G001: reemplazar el valor obsoleto `checks.length===36` por `checks.length===40` sin reducir la condición `checks.every(c=>c.pass)`.
3. Runner Electron G001: `minChecks:40`, conservando el puerto, el identificador, el timeout y las rutas previas.
4. Añadir seis pruebas Node CORR-001 que validan las 40 etiquetas originales, la coherencia de ambos contadores, el colector con 40/40 PASS, con 39/40 FAIL y con un fallo verdadero FAIL, además del diagnóstico parcial y el watchdog.
5. **No cambiar** `src/`, modelo, Inspector, Vite, AudioEngine, Player, scene data, persistencia ni las pruebas históricas originales.

## Resultados ejecutados en preparación

| Prueba | Evidencia | Estado |
|---|---|---|
| Focal Node G001+G002+CORR-001 | 88 PASS / 0 FAIL / 0 SKIP | PASS NODE |
| Compatible ampliado | 288 PASS / 3 SKIP / 0 FAIL (291 tests, 22 archivos) | PASS NODE CON SKIP |
| Regresión adicional incluyendo waveform G003 | 288 PASS / 3 SKIP / 1 FAIL (292 tests) | FALLÓ POR INFRAESTRUCTURA |
| Test waveform G003 contra SOURCE_BASELINE previo | `ERR_MODULE_NOT_FOUND: @vue/compiler-sfc` | FALLÓ IGUAL EN BASE ANTERIOR |
| Electron CORR-001 | Falló antes de montar por faltar Vite | **NO VERIFICADO** |
| `npm run build` | `vite: not found` | **NO VERIFICADO** |
| QA local final del usuario | Aún no ejecutado sobre CORR-001 | PENDIENTE |

Los tres SKIP no se contabilizan como PASS. El test waveform excluido de la suite compatible depende de una dependencia ausente de forma idéntica en la base anterior; no se suprime ni altera.

## QA local requerido (raíz LevelForge con `package.json`)

```bash
node --test scripts/test-inspector-audio-volume-points-s12-g007-g001.mjs scripts/test-inspector-audio-volume-points-s12-g007-g001-corr001.mjs scripts/test-timeline-audio-volume-automation-s11-g007-g002.mjs scripts/test-timeline-audio-volume-automation-s11-g007-g002-corr001.mjs
node --test scripts/test-inspector-audio-volume-points-s12-g007-g001-electron.mjs
npm run build
npm run electron
```

Esperado: **88 PASS Node**; **1 PASS Electron con 40 comprobaciones completas**. Build debe completar Editor y Player. El usuario verifica visualmente nombres, collapse, scroll a 5, persistencia, restauración y reproducción. Sin ejecución no se declara PASS Electron ni QA visual.

Estado: **IMPLEMENTADO · NODE PASS · ELECTRON/BUILD NO VERIFICADOS · QA LOCAL PENDIENTE · NO APROBADO NI CERRADO**.

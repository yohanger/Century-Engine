# LF-TIMELINE-AUDIO-TRIM-BOTH-ENDS-S13-G008-G003-INTEGRAL_CORR-002 — QA

| Etapa | Resultado |
|---|---|
| Implementación fixtures/Node | IMPLEMENTADO |
| Node focal G003 + CORR001 + CORR002 | 38 PASS / 0 FAIL |
| Node dirigida de 12 scripts | 176 PASS / 0 FAIL |
| Sintaxis bloques JS de ambas fixtures | PASS |
| Electron S11-G003 corregida | NO VERIFICADO; runner no puede arrancar sin Vite |
| Electron S11-G007 corregida | NO VERIFICADO; runner no puede arrancar sin Vite |
| Electron G008-G003 principal | 46/46 PASS en 2 ejecuciones **previas** del usuario; conservar evidencia |
| Build actual Editor/Player | NO VERIFICADO: vite: not found |
| QA visual y sonoro | PENDIENTE |
| Aprobación y cierre | PENDIENTE / NO CERRADO |

## Ejecutar en raíz del proyecto con package.json

```bash
node --test scripts/test-timeline-audio-trim-both-ends-s13-g008-g003.mjs scripts/test-timeline-audio-trim-both-ends-s13-g008-g003-corr001.mjs scripts/test-timeline-audio-trim-both-ends-s13-g008-g003-corr002.mjs
node --test scripts/test-timeline-audio-waveform-inspector-s11-g003-electron.mjs
node --test scripts/test-timeline-audio-volume-automation-s11-g007-g002-electron.mjs
node --test scripts/test-timeline-audio-trim-both-ends-s13-g008-g003-electron.mjs
npm run build
npm run electron
```

## Aserciones críticas

1. Waveform: la señal débil mantiene la escala y el trazado corresponde al PCM analizado en cada ventana visible, al cambiar zoom y scroll.
2. Automatización: clip y waveform comparten origen relativo a tick cero; los puntos conservan arrastre, cancelación y persistencia.
3. Trim principal: recorte de ambos extremos, offset, duración, waveform y puntos siguen en 46/46 verificaciones.
4. QA manual: escuchar Preview/Player, contrastar onda con recorte y reproducción; guardar/reabrir; zoom y scroll.

El usuario ejecuta QA local y aprueba; `npm run build` no equivale a QA visual.

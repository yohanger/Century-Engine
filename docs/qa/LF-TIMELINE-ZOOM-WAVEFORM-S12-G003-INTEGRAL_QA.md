# QA · LF-TIMELINE-ZOOM-WAVEFORM-S12-G003-INTEGRAL

## Estado inicial y fuente

SOURCE_BASELINE `S12-G002 CORR-002`; usuario comunica funcionamiento del recorte en Electron y permite continuar. Suite automatizada de G002 mantenida como **FAIL histórico** en «duración legacy según offset/pitch» por fixture que escribe un objeto no reactivo. No confundir QA funcional del usuario con Electron automatizado PASS.

## Evidencia de ejecución del asistente

| Prueba | Estado |
|---|---|
| S12-G003 Node focal más G002/CORR | **37 PASS / 0 FAIL** |
| Regresión ampliada seleccionada | **162 PASS / 4 SKIP / 0 FAIL** |
| Sintaxis JS (dos componentes, módulo, fixture) | PASS (solo sintaxis, no compilación Vue) |
| Electron embebido de G003 | **NO VERIFICADO**. El runner no alcanza la fixture: falta `node_modules/vite` |
| `npm run build` | **NO VERIFICADO**. `vite: not found` |
| UI Electron real | **QA LOCAL PENDIENTE** |
| QA de Player | **PENDIENTE** |

**Importante:** no se reclama PASS de Electron, compilación, gestos touchpad físicos, FPS ni QA visual. Las pruebas Node no sustituyen montaje Vue ni gestos reales.

## QA obligatorio en raíz del proyecto local

```bash
node --test scripts/test-timeline-zoom-waveform-s12-g003.mjs scripts/test-timeline-audio-trim-duration-s12-g002.mjs scripts/test-timeline-audio-trim-duration-s12-g002-corr001.mjs scripts/test-timeline-audio-trim-duration-s12-g002-corr002.mjs
node --test scripts/test-timeline-zoom-waveform-s12-g003-electron.mjs
npm run build
npm run electron
```

Resultado Node esperado: 37 PASS. Electron: 1 test PASS con al menos 20 comprobaciones reportadas; la fixture conserva los resultados individuales incluso si alguno falla. Si falla, devolver JSON de comprobaciones completas, no solo primera excepción.

## QA visual y de integración

1. Abrir Timeline con audio real y verificar forma de onda de picos, no solo línea recta.
2. Sobre área temporal: Ctrl+rueda arriba/abajo amplía/reduce y conserva bajo cursor el mismo instante mientras haya scroll disponible. En laptop probar pinch real del touchpad; verificar el gesto propio del dispositivo.
3. Rueda normal desplaza el Timeline y no cambia zoom. Columna de pistas permanece fija y scroll vertical se mantiene.
4. El slider, botones +/- y Fit siguen funcionando; Zoom extremo respeta límites existentes.
5. El clip amplía detalle horizontal (más muestras del resumen PCM), sin cambiar los picos relativos ni la escala vertical al arrastrar el scroll.
6. Probar un audio de duración mayor que el viewport, silencio, picos intensos, pitch/offset/loop y varias pistas. Verificar que la geometría no desaparece al desplazarse.
7. Comprobar el Inspector: duración, pico y RMS no se modifican por zoom.
8. Confirmar que el recorte derecho, asa, Snap, bloqueo de pista, selección, playhead y transporte siguen funcionando.
9. Preview y Player mantienen la reproducción, detención y efectos aprobados.
10. En hardware N5030/4 GB verificar fluidez; registrar si hay bloqueos, memoria excesiva o caídas observables.

## Cierre

G003 **IMPLEMENTADO**, Node PASS. **ELECTRON, BUILD y QA LOCAL NO VERIFICADOS/PENDIENTES**. No APROBADO ni CERRADO sin evidencia y decisión explícita del usuario. No adelantar G004/G005/G007.

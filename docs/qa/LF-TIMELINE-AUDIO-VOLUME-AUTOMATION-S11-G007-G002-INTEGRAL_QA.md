# S11-G007-G002 — Contrato y QA

## Estado y ejecución

- Node focal: 36 PASS / 0 FAIL; regresión completa compatible de Timeline/audio: 221 PASS / 3 SKIP / 0 FAIL (224 pruebas).
- Sintaxis JS de módulos, componentes Vue extraídos y fixture: PASS (`node --check`); esta comprobación **no es compilación Vue real**.
- Electron G002: runner no inicia al faltar Vite; NO VERIFICADO, no PASS.
- `npm run build`: no inicia por `vite: not found`; Editor y Player NO COMPILADOS en preparación.
- Usuario debe ejecutar QA local en Electron, observar Editor y escuchar Preview/Player. G002 NO APROBADO/CERRADO.

## Contrato de aceptación

1. Añadir, mover, cambiar valor y eliminar puntos sobre Audio existente sin pistas nuevas.
2. Interpolación lineal, factor de 0–1 multiplicando volumen base.
3. Fade In, Fade Out y Stop independientes; no cancelar rampas de base.
4. Audio sin puntos idéntico a anteriores; duración cero no migra y no acepta puntos.
5. Sincronización de valores Inspector, curva y serialización; Snap, bloqueo, Undo/Redo y cancelación.
6. Recortar no elimina automáticamente puntos fuera del nuevo rango.
7. Preview y Player conservan pausa/reanudación/Seek/Stop/loop, offset y pitch.
8. No alterar Mixer/FX, buses, assets originales, Cinematics o timeline de FilmMaker.
9. Ejecutar Electron con fixture completa y diagnosticar parciales; no adjudicar PASS sin reporte.
10. Compilar Editor/Player y confirmar QA auditivo local.

## Comandos en raíz del proyecto existente

```bash
node --test scripts/test-timeline-audio-volume-automation-s11-g007-g002.mjs
node --test scripts/test-timeline-audio-volume-automation-s11-g007-g002-electron.mjs
npm run build
npm run electron
```

Esperado Node 36 PASS; Electron 1 PASS con **36 checks**; build de ambos targets; evaluación local requerida. Si hay discrepancia, conservar log, mostrar stage/checks y mantener Gate abierto.

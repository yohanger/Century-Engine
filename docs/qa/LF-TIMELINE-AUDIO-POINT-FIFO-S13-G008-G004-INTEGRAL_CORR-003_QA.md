# QA — S13-G008-G004 FIFO CORR-003

## Estado de verificaciones

| Etapa | Resultado |
|---|---|
| Node focal: 9 scripts / 13 pruebas CORR-003 nuevas | 170 PASS / 0 FAIL |
| Node ampliada CORR-003 | 832 PASS · 19 SKIP · 12 FAIL históricos |
| Node ampliada SOURCE_BASELINE CORR-002 | 819 PASS · 19 SKIP · los mismos 12 FAIL |
| Chromium DOM aislado | PASS; el ID conserva identidad en orden FIFO e invertido |
| Electron real Inspector CORR-003 | **NO VERIFICADO** por Vite ausente |
| Build Editor y Player | **NO VERIFICADO**, Vite ausente |
| QA usuario de CORR-002 | FIFO 25 PASS, Trim 46 PASS, Automatización 37 PASS, Inspector 38/40 con 2 FAIL |
| QA visual y aprobación de CORR-003 | PENDIENTES |

## Comandos desde la raíz activa del proyecto (carpeta con `package.json`)

**Focal:**

```bash
node --test \
  scripts/test-timeline-audio-point-lifo-s13-g008-g004.mjs \
  scripts/test-timeline-audio-point-lifo-s13-g008-g004-corr001.mjs \
  scripts/test-inspector-audio-volume-points-s12-g007-g001.mjs \
  scripts/test-inspector-audio-volume-points-s12-g007-g001-corr003.mjs \
  scripts/test-timeline-audio-volume-automation-s11-g007-g002.mjs \
  scripts/test-timeline-audio-volume-automation-s11-g007-g002-corr001.mjs \
  scripts/test-timeline-audio-trim-both-ends-s13-g008-g003.mjs \
  scripts/test-timeline-audio-trim-both-ends-s13-g008-g003-corr001.mjs \
  scripts/test-timeline-audio-trim-both-ends-s13-g008-g003-corr002.mjs
```

Esperado: 170 PASS, 0 FAIL.

**Electron histórico corregido:**

```bash
node --test scripts/test-inspector-audio-volume-points-s12-g007-g001-electron.mjs
```

Esperado, aún no confirmado: **1 PASS / 40 comprobaciones internas**. Se conservan todas, incluidas «Puntos pueden abrirse independientemente» y «Cerrar un punto no cierra otro».

**Regresiones Electron que ya pasaron en el QA anterior del usuario:**

```bash
node --test scripts/test-timeline-audio-point-lifo-s13-g008-g004-electron.mjs
node --test scripts/test-timeline-audio-trim-both-ends-s13-g008-g003-electron.mjs
node --test scripts/test-timeline-audio-volume-automation-s11-g007-g002-electron.mjs
```

Esperado: FIFO 25, Audio Trim 46 y automatización 37 comprobaciones internas.

**Compilación y Editor:**

```bash
npm run build
npm run electron
```

La compilación no equivale a QA visual. No inferir build de Player si solo se compila el Editor.

## QA visual y funcional

1. Crear al menos seis puntos; FIFO (Punto-1 arriba, último abajo), scroll a partir de cinco, encabezados independientes.
2. Abrir Punto-2 manteniendo Punto-1 abierto; cerrar Punto-1 y confirmar Punto-2 abierto. Repetir tras mover los puntos en el tiempo.
3. Renombrar un punto, contraer y expandir varios, eliminar exclusivamente uno mediante papelera Bootstrap.
4. Guardar/reabrir, Undo/Redo y duplicar clave; confirmar nombres, IDs, factores y ordinales.
5. Escuchar Preview/Player, comprobar que la curva de automatización, recorte y PCM continúan correctamente.
6. Si hay fallos, enviar log completo de la primera aserción fallida antes de modificar código adicional.

## Evidencia incluida

- `docs/qa/evidence/LF_S13_G008_G004_CORR003_USER_FAILURE.md`
- `docs/qa/evidence/LF_S13_G008_G004_CORR003_NODE_FOCAL.log`
- `docs/qa/evidence/LF_S13_G008_G004_CORR003_NODE_EXPANDED.log`
- `docs/qa/evidence/LF_S13_G008_G004_CORR003_BASELINE_EXPANDED.log`
- `docs/qa/evidence/LF_S13_G008_G004_CORR003_CHROMIUM_DOM.log`
- `docs/qa/evidence/LF_S13_G008_G004_CORR003_ELECTRON_ENV.log`
- `docs/qa/evidence/LF_S13_G008_G004_CORR003_BUILD_ENV.log`

**Estado final del Gate:** IMPLEMENTADO · NODE PASS · ELECTRON/BUILD NO VERIFICADOS · QA LOCAL PENDIENTE · NO APROBADO NI CERRADO.

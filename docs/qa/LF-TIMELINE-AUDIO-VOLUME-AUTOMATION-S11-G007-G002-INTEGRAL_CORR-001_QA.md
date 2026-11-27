# QA — Automatización G002 CORR-001 · Ctrl y cursor normal

## Resultados respaldados por ejecución

| Área | Resultado | Estado |
|---|---|---|
| Node del G002 original + CORR-001 | **50 PASS / 0 FAIL / 0 SKIP** | TEST AUTOMATIZADO PASS (FOCAL) |
| Regresión compatible de 19 archivos Timeline/audio | **235 PASS / 3 SKIP / 0 FAIL** | TEST NODE PASS CON SKIP |
| Sintaxis JS de fixtures y TimelinePanel | PASS mediante `node --check` | VERIFICADO ESTÁTICO, no compilación Vue |
| Nueva fixture Electron de cursor (32 comprobaciones) | Sin ejecución renderer; falta Vite | NO VERIFICADO |
| Fixture Electron G002 original adaptada (36 comprobaciones) | Sin ejecución renderer; falta Vite | NO VERIFICADO |
| `npm run build` (Editor y Player) | `vite: not found` | NO VERIFICADO |
| QA local visual/funcional | No recibido para esta corrección | PENDIENTE |
| G002 y CORR-001 | Pendientes de aceptación/cierre por el usuario | NO APROBADOS / NO CERRADOS |

Tres pruebas Node se omiten en el entorno generador por ausencia del compilador de Vue. No se cuentan como PASS. El fallo de ejecución de Electron ocurre **antes de ejecutar las fixtures**, no demuestra un fallo de las interacciones.

## Comandos locales — ejecutar en raíz de LevelForge (`package.json`)

```bash
node --test scripts/test-timeline-audio-volume-automation-s11-g007-g002.mjs scripts/test-timeline-audio-volume-automation-s11-g007-g002-corr001.mjs
node --test scripts/test-timeline-audio-volume-automation-s11-g007-g002-corr001-electron.mjs
node --test scripts/test-timeline-audio-volume-automation-s11-g007-g002-electron.mjs
npm run build
npm run electron
```

**Resultados requeridos:** focal Node 50 PASS; Electron CORR-001 1 PASS y **32/32 comprobaciones**; Electron G002 original 1 PASS y **36/36**; Editor y Player compilados.

## QA manual obligatorio

1. En cualquier clave/clip de Audio, Cámara, Nodo, Comandos y Métodos, mantener Ctrl: cursor de flecha normal **inmediatamente**, incluso sin hacer clic.
2. Soltar Ctrl: recuperar `grab`, `ew-resize` u otro cursor correspondiente; comprobar con clips temporales de Cámara/Nodo y asas superpuestas.
3. Entrar o salir del dock con Ctrl ya presionado; cambiar a otra pista y comprobar la flecha. Cambiar de pestaña, perder foco y regresar: el cursor no debe quedarse bloqueado.
4. Doble clic normal sobre Audio: no crear puntos. Ctrl + doble clic sobre Audio con duración positiva: crear exactamente un punto en tiempo y valor correctos.
5. Ctrl + doble clic sobre Cámara/Nodo/Comandos/Métodos, Audio Stop y duración cero: **no** crear puntos ni modificar datos.
6. Verificar creación sobre la onda, duplicado del mismo tiempo, Snap, pista bloqueada y Undo/Redo.
7. Arrastre habitual de clips, selección múltiple Ctrl, `Ctrl+D`, recorte, fundidos, Inspector, transporte y reproducción Preview/Player sin cambios.
8. Guardar/reabrir y reproducir audio con automatización; ninguna alteración a FX, buses, Mixer, Cinematics o recursos existentes.

Devolver el resultado íntegro de ambos Electron, compilación y evidencia visual si hay una incidencia. Compilar no equivale a QA visual. Un PASS sintético de Node no sustituye los gestos reales en Electron.

## Evidencias incluidas

- `docs/qa/evidence/LF_S11_G007_G002_CORR001_NODE_FOCAL.log`
- `docs/qa/evidence/LF_S11_G007_G002_CORR001_NODE_REGRESSION.log`
- `docs/qa/evidence/LF_S11_G007_G002_CORR001_ELECTRON_ENV.log`
- `docs/qa/evidence/LF_S11_G007_G002_CORR001_ORIGINAL_ELECTRON_ENV.log`
- `docs/qa/evidence/LF_S11_G007_G002_CORR001_BUILD_ENV.log`

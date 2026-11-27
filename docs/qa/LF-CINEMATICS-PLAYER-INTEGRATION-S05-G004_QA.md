# LF-CINEMATICS-PLAYER-INTEGRATION-S05-G004 · QA

**Estado:** IMPLEMENTADO · **130/130 Node PASS** · Electron/Build/Player **NO VERIFICADOS** · QA LOCAL **PENDIENTE**. No cerrar.

## Base

`LevelForge_CINEMATICS_LEGACY_CLEANUP_S05_G003_SOURCE_BASELINE.zip` APROBADO por usuario; G003 se registra como QA LOCAL PASS declarado en la entrega G004. CA-003 preservado.

## Instalación sin pisar cambios locales

Extraer únicamente el ZIP SOURCE_BASELINE G004, completo, en `~/Desktop/LevelForge_CINEMATICS_PLAYER_INTEGRATION_S05_G004_SOURCE_BASELINE/`. Mantener G003 como respaldo aprobado. CHANGE es diferencial de revisión; no superponerlo a cambios locales sin comparación. No modificar los proyectos `.lfproj` personales ni reemplazar escenas/datos.

Desde la raíz del nuevo SOURCE_BASELINE:

```bash
npm ci
node --test scripts/test-cinematics-player-integration-s05-g004.mjs scripts/test-cinematics-legacy-cleanup-s05-g003.mjs scripts/test-cinematics-viewer-s05-g002.mjs scripts/test-timeline-ux-integration-s04-g004.mjs scripts/test-timeline-node-method-track-s04-g003.mjs scripts/test-timeline-interpolation-s04-g002.mjs scripts/test-timeline-hierarchy-dnd-s04-g001.mjs scripts/test-temporal-context-menu-s03-g001.mjs scripts/test-temporal-inspector-s02-g001.mjs
node --test scripts/test-cinematics-player-integration-s05-g004-electron.mjs
npm run docs:check
npm run build
npm run electron
```

Esperado para el conjunto Node: **130 PASS / 0 FAIL**. El fixture Electron debe superar **28 comprobaciones**; los builds y `docs:check` requieren ejecución local. No se afirma que estos últimos ya hayan pasado.

## QA de integración obligatoria (usuario)

1. En Nether Film Maker exportar una película `.nfm` válida con **mínimo dos tomas, un montaje, audio y capas/comandos**. No crear una cinemática desde Cinematics.
2. Importar `.nfm` en LevelForge. Comprobar que el montaje y pases muestran origen FilmMaker en `Assets/Cinematics` y que un Timeline manual queda fuera. No deben aparecer herramientas de grabación/edición allí.
3. Abrir el montaje, revisar cámara y transformaciones en la vista previa segura y verificar que el scrub **no** activa scripts, comandos ni audio. Inspeccionar panel a 260 px.
4. En Play invocar `game.timeline.play(id)` mediante evento o script ya existente. Comprobar cámara (varias tomas), acciones del actor, sonido, métodos de nodo y comandos/efectos ordenados por sus tiempos de clave.
5. Usar pausa/reanudación, `seek`, `stop`, `skip` y finalización natural. Verificar que un comando bloqueante final no libera el control antes de completarse.
6. Intentar reproducir una película FilmMaker de otra escena: debe informar qué escena activar sin cambiarla ni tomar el control. Activar la escena de origen y repetir; el montaje debe reproducirse correctamente.
7. Guardar/reabrir `.lfproj`, comprobar IDs, clips de captura y procedencia. Exportar juego, ejecutar Player de LevelForge con plantilla First Person/Jolt y verificar la misma secuencia.
8. Probar eliminación de un recurso Cinematics desde Assets, confirmación, Deshacer/Rehacer y ausencia de borrados en cascada.
9. Mantener fuera de este Gate la incidencia histórica de plantilla sin controlador; si se reproduce, documentar como incidencia separada, no atribuir PASS.

## Evidencia a devolver

La aprobación local del usuario basta como QA LOCAL PASS declarado; no volver a solicitar logs de Gates ya aprobados. Para fallos nuevos, indicar paso exacto, resultado observado/esperado, escena, montaje, y captura o vídeo; registrar versiones de Node/Electron y artefacto si la causa requiere investigación.

## Registro verificable

- `docs/qa/evidence/LF-CINEMATICS-PLAYER-INTEGRATION-S05-G004/node-130-pass.log`: ejecución real Node.
- `.../electron-no-verificado.log`: el runner no arrancó por ausencia de Vite.
- `.../build-no-verificado.log`: Vite ausente.
- `.../docs-no-verificado.log`: `marked` ausente.

No existe evidencia de compilación AppImage ni de Jolt WASM real ejecutado en este entorno.

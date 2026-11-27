# LevelForge — LF-AUDIO-S02-G001_CORR-001 · Gizmo de fuente de audio

## Autorización, entrada y objetivo

- **Autorización exacta recibida:** `Listo. LF-AUDIO-S02-G001_CORR-001 autoriza comenzar` (2026-10-25).
- **Baseline de entrada:** `LevelForge_AUDIO_S02_G001_SOURCE_BASELINE.zip` (687 archivos; verificación ZIP OK). AUDIO S01 y S02 aprobados por el usuario.
- **Problema reportado:** no se identifica el gizmo de audio en Edit Mode y se ve indebidamente en Play Mode y en el juego exportado.
- **Objetivo vinculante:** mostrar las ayudas editoriales de fuentes de audio en edición, ocultarlas por completo durante el juego y conservar el procesamiento de sonido y la oclusión S02.

## Diagnóstico reproducible desde el código

1. `nodes/audio.js` colocaba el icono en `root.userData.visual`, pero los anillos de alcance como hijos directos del nodo raíz. Ocultar solo `visual` no podía ocultar los anillos.
2. `events/play.js::_setupScene()` ocultaba ayudas de luces, cámaras y eventos, pero no las fuentes de audio.
3. `package/game.js` construye `GameGraph` con el mismo `SceneGraph` y `PlayMode`. En el Player hay un intervalo de carga anterior a `start()`, de modo que el control de ayudas también debe funcionar cuando `runtime === true` y el modo Jugar aún no está activo.
4. La causa exacta de la falta de visibilidad reportada **en Edit Mode** no se reprodujo visualmente aquí: el código de origen sí creaba el icono. La corrección fuerza explícitamente su visibilidad editorial y permite que se dibuje por delante de paredes opacas, pero necesita QA visual del usuario.

## Contrato implementado

- `src/engine/runtime/nodes/audio.js`: icono, flecha y anillos dentro de `visual`, marcado como `editorOnlyVisual`. Los materiales de esa ayuda no hacen depth-test ni escriben profundidad; se dibujan con `renderOrder=1000` **solo cuando el grupo está visible**. `near/far` siguen visibles solo en modo 3D, con sus distancias de origen; audio UI solo conserva el icono.
- `src/engine/runtime/scene/environment.js`: `_applyViewToNode` controla **una sola regla** de visibilidad del grupo: únicamente edición (`!isPlaying && !player?.runtime`). Se aplica en la sincronización de nodos y al regresar al editor. En el juego exportado se oculta desde la carga, antes de iniciar la partida.
- `src/engine/runtime/events/play.js`: al configurar la escena en modo Jugar se reaplica `_applyViewToNode` a las fuentes de audio después de activar el estado de juego, también tras cambiar de escena.
- Se mantiene la visibilidad y transformación del **nodo raíz**; ocultar sus ayudas no debe impedir que la fuente pueda sonar, usar su posición ni responder a scripts. No se cambian `AudioEngine`, `AudioScene`, mezcla, HRTF, DSP, oclusión ni datos persistidos.
- No se añaden dependencias, configuración ni lógica paralela. Sin Steam Audio.

## QA ejecutado en entorno de elaboración

- `node --test scripts/test-audio-s02-corr001.mjs scripts/test-audio-s02.mjs scripts/test-audio-s01.mjs scripts/test-db-contract.mjs scripts/test-three-s01.mjs`: **440 PASS, 0 FAIL, 9 SKIP** (449 pruebas): 4 SKIP nuevos por ausencia de Three.js y 5 SKIP previos dependientes de Three.js. Los casos estáticos CORR-001 (3) pasan. Los casos que requieren escenas Three.js reales no se marcan PASS.
- `node --check` para los tres archivos JS modificados y el nuevo test: **PASS**.
- `npm run build`: **NO VERIFICADO** (`vite: not found`, salida 127).
- Electron, QA visual, oclusión acústica real y juego exportado: **PENDIENTES DE USUARIO**.

## QA requerido en instalación del usuario

1. Ejecutar `node --test scripts/test-audio-s02-corr001.mjs` con dependencias instaladas. Se esperan **7 PASS, 0 FAIL, 0 SKIP** en este nuevo archivo.
2. Repetir todas las suites anteriores y `npm run build` (Editor y Player); informar fallos y warnings por separado.
3. Abrir el editor mediante `npm run electron`. Crear fuentes `Audio 3D` y `Audio UI`; comprobar que ambas se identifican y seleccionan mediante su icono, y la 3D muestra los dos anillos con las distancias configuradas.
4. Colocar una pared entre la cámara de edición y la fuente para comprobar que el icono de edición permanece localizable. Activar/desactivar visibilidad del objeto: `visible:false` debe continuar ocultando el objeto.
5. Entrar en Play Mode: no debe verse icono, flecha ni anillos. La fuente debe reproducir sonido y, cuando está habilitada, su oclusión debe continuar funcionando.
6. Salir de Play Mode: icono y anillos 3D deben reaparecer, y la fuente UI no debe ganar anillos.
7. Cambiar de escena durante Play Mode y comprobar que ninguna ayuda aparece; volver al editor y comprobar restauración.
8. Exportar un juego y comprobar que no se ve el gizmo **ni antes ni después de comenzar la partida**; comprobar que el sonido y la posición espacial siguen correctos.
9. Guardar/reabrir un proyecto antiguo y otro con oclusión Audio S02; confirmar que no hay migración de datos ni cambios acústicos.

## Alcance excluido / cierre

No se cambian controles de volumen, reproducción en Edit Mode, canales del mezclador, audio 3D, geolocalización, transformaciones, ni otros gizmos. No se declara la incidencia cerrada hasta recibir y aceptar evidencia local. Entrega: exactamente `LF-AUDIO-S02-G001_CORR-001_CHANGE.zip` y `LevelForge_AUDIO_S02_G001_CORR-001_SOURCE_BASELINE.zip`, sin SHA separado ni scripts de instalación nuevos.

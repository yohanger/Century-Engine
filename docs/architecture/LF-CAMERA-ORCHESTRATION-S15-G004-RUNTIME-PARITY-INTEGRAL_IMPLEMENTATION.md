# LevelForge — S15-G004 · Paridad de Camera Orchestration en runtime exportado

**Gate:** `LF-CAMERA-ORCHESTRATION-S15-G004-RUNTIME-PARITY-INTEGRAL`  
**SOURCE_BASELINE de entrada:** `LF_CAMERA_ORCHESTRATION_S15_G003_CORR002_INTEGRAL_CONT001_SOURCE_BASELINE.zip`  
**Estado:** implementado en fuentes y prueba Node aislada; compilación, Electron real y AppImage independiente NO VERIFICADOS.

## 1. Auditoría: observado, inferencia y causa

**OBSERVADO:** `src/engine/runtime/package/game.js` instancia `new PlayMode(graph)`. El paquete y el Editor comparten `src/engine/runtime/events/play-camera.js`, `PlayMode`, API `game.camera`, Timeline y los comandos de eventos. No es necesario otro CameraManager o renderizador.

**OBSERVADO — defecto reproducido:** `writePackage()` en `src/engine/runtime/package/format.js` reconstruía `game.scenes` conservando ID, nombre y transiciones, pero descartaba `gameManagerId`. El runtime exportado invoca `sceneGameConfig(project)` desde la lista de escenas empaquetadas; por tanto, un GameManager asignado a una escena se perdía en la exportación. Afectaba a selección Camera3D, perfil y tipo de jugador configurado en ese recurso. Una prueba de lectura real del ZIP reprodujo la pérdida antes del cambio.

**CORRECCIÓN EN FUENTES:** `writePackage()` conserva ahora `gameManagerId` en los metadatos de cada escena incluida. No añade campos al proyecto ni cambia los datos de Camera3D, Timeline, Films o Database.

**OBSERVADO — defecto adicional:** `exportChecks()` en `src/core/state/game.js` confundía una Camera3D invisible con una inactiva al prevalidar la cámara inicial. Además, afirmaba que el juego necesariamente quedaría negro aunque un evento, script o Timeline pudiera activar otra cámara.

**CORRECCIÓN EN FUENTES:** prevalidación por `nodeEffectiveActive`, incluyendo padres inactivos. La ausencia de cámara base pasa a ser advertencia condicional: la vista queda sin fuente hasta una activación explícita. No se reinterpreta la visibilidad ni se cambian comportamientos runtime.

**TEST HISTÓRICO AJUSTADO:** `scripts/test-game-manager-g001.mjs` buscaba un valor exacto de `SCENE_KEYS` anterior a la incorporación de `signalConnections`. Se actualizó exclusivamente su expectativa a la estructura actualmente vigente.

**INFERENCIA / NO VERIFICADO:** la corrección documental y la serialización no prueban por sí solas FOV, imagen, render, Jolt o FPS de un AppImage real. La verificación de esos puntos depende de build y QA local.

## 2. Límites de implementación

- Se reutilizan `writePackage`, `readPackage`, `createPackageHost`, `PlayMode` y `sceneGameConfig` originales.
- Se conserva la autoridad G002, los comandos de eventos G003, los ID por escena y las reglas `active` / `visible` de CORR-002.
- La plantilla FPS y Database no se modifican. En G004 solo se transporta correctamente la referencia existente a GameManager.
- Sin migradores legacy, gestores paralelos, cambios de prioridad, nuevas transiciones o persistencia especulativa.
- La fila `Visible` del Inspector permanece pendiente del Sprint S13 y NO forma parte de G004.

## 3. Contrato de empaquetado necesario

Al ejecutar `writePackage({ data, scenes, files })`:

1. `game.scenes[i]` conserva ID, nombre, transiciones y, si existe, `gameManagerId` de `data.scenes`.
2. La primera escena incluida en Build es `game.game.startScene`, sin cambiar su identidad.
3. `GameManager` continúa como recurso `gameManagers[]` único y se selecciona por la referencia de escena.
4. Los datos de Camera3D, eventos visuales, scripts y Timeline permanecen en los recursos y escenas originales, sin conversión a una segunda cámara.
5. Una cámara `active=true, visible=false` sigue siendo elegible; una inactiva, o descendiente de padre inactivo, no lo es.
6. Cambiar de escena en el paquete debe reevaluar `sceneGameConfig` sobre los metadatos empaquetados.

## 4. Evidencia técnica de esta entrega

- Pruebas G004: **9/9 PASS** con `writePackage/readPackage` reales de JSZip 3.10.1 y `createPackageHost` real, pero `SceneGraph` simulado y reactividad temporal de prueba en este entorno. Este sustituto no pertenece a los ZIP.
- Regresión seleccionada: **126/126 PASS**, incluyendo Camera Orchestration G002/G003, Active/Visible, GameManager, Cinematics y VFX Player.
- `node --check` de los módulos modificados: **PASS**.
- `npm run build`: **NO VERIFICADO** (`vite: not found` por instalación incompleta en el entorno de entrega).
- Electron real, Jolt WASM, AppImage independiente y QA visual/auditivo: **PENDIENTES**.

## 5. Dependencias posteriores

G005 (selección y gizmos), G006 (transiciones y políticas declarativas) y G007 (QA integral) siguen sin autorización. Modernizar el personaje de la plantilla FPS después de Camera Orchestration sigue siendo una unidad de trabajo separada.

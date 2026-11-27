# LF-PLAYER-CAMERA-MOTION-S01-G001_CORR-001 — Integración FPS de pasos

**Gate autorizado:** `Listo. LF-PLAYER-CAMERA-MOTION-S01-G001_CORR-001 autoriza comenzar`

**SOURCE_BASELINE vinculante:** `LevelForge_TERRAIN_NODE_S01_G001_SOURCE_BASELINE.zip`.

## Error original / evidencia del usuario

En Play, la consola informa `Uncaught TypeError: this.footstep is not a function` en `FpsPlayer.late()` al producirse un paso/aterrizaje. La incidencia de `setPointerCapture` reportada en la misma captura está **fuera de este Gate** y necesita diagnóstico separado. Los avisos CSP, PCFSoftShadowMap y CSS tampoco están incluidos.

## Causa raíz comprobada

`src/engine/runtime/player/fps/index.js` importa `stepsMethods` e invoca `stepsMethods.late.call(this, dt)`, pero la copia de descriptores de `FpsPlayer.prototype` omite `footstep()` y `jumpSound()`. Se reprodujo la ausencia con un test ejecutable de la declaración real de la clase y de `stepsMethods` real mediante `node:vm`. La suite falla sobre el código previo y pasa tras la reparación.

## Corrección acotada

Se incorporan al prototipo los descriptores de `stepsMethods`, **excepto** su método `late`. Se conserva deliberadamente `FpsPlayer.late()`, que combina `stepsMethods.late` y `_cameraMotionTick`. Copiar `stepsMethods.late` al prototipo sin excluirlo causaría una regresión silenciosa del movimiento visual del jugador.

No se modifica `steps.js`, Camera Shake Base, World, Jolt, la interfaz, las escenas, Terrain ni el sistema de audio.

## Pruebas ejecutadas

- Regresión correctiva `scripts/test-player-camera-motion-s01-corr001.mjs`: **7/7 Node PASS**; cubre métodos del prototipo, caminar, salto, aterrizaje, audio desactivado, ausencia de reproductor y cambio de escena.
- Regresión focal de 10 suites: **175/175 Node PASS**; incluye Player Camera Motion, Camera Shake S01 G001–G004, Terrain S01, Scene Fade y navegación continua del editor.
- `node --check` de producción y prueba: **PASS**.

**NO VERIFICADO:** build Editor/Player, Electron, ejecución real Play/Jolt y Player exportado. No declarar QA local PASS ni cierre del Gate antes de que el usuario los ejecute.

## QA local del usuario (Linux)

Desde la raíz del SOURCE_BASELINE correctivo, con dependencias instaladas:

```bash
node --test scripts/test-player-camera-motion-s01-corr001.mjs
node --test scripts/test-player-camera-motion-s01-g001.mjs
node --test scripts/test-player-camera-motion-electron-s01-g001.mjs
npm run build
npm run electron
```

En un proyecto de prueba, entrar en Play con FPS; caminar al menos varios pasos, correr, saltar, aterrizar (suave y fuerte), comprobar pasos con y sin audio, usar el Camera Shake Base de caminata y aterrizaje configurado, detener Play y ejecutar Player exportado. La consola **no debe emitir** `this.footstep is not a function`, `this.jumpSound is not a function` u otras excepciones de `FpsPlayer.late`.

Devolver log de Node, Electron y build, evidencia de pasos/saltos en Play, Player independiente y observaciones. La prueba de interacción visual no es sustituida por el build.

## Restricción de entrega y continuidad

Entregar exactamente dos ZIP: CHANGE con solo archivos afectados, y SOURCE_BASELINE acumulado. Conservar proyectos locales, Terrain y demás Gates. No avanzar a Terrain S02 hasta evaluar por separado el error `setPointerCapture` y tener un runtime estable.

**Estado:** IMPLEMENTADO · NODE PASS · BUILD/ELECTRON/QA LOCAL NO VERIFICADOS · NO CERRADO.

# LevelForge — S16-G005 · Camera3D nativa y Camera Orchestration

**Gate autorizado:** `LF-FPS-NATIVE-PLAYER-S16-G005-CAMERA3D-ORCHESTRATION-G001` (2026-11-12).

## Autoridad y mecanismo

La vista final sigue siendo propiedad de `PlayMode._cameraFrame()` y Camera Orchestration S15. La `Camera3D` es un nodo ordinario, hijo de `CharacterBody3D`; su posición y orientación mundial se resuelven a partir de `matrixWorld`. El script del personaje controla exclusivamente la orientación de esos dos nodos. No adquiere un lease global ni reemplaza `_cameraFrame`, FilmMaker o Timeline.

El Input Map existente ya soporta teclas, botones y mandos; para mirar con ratón faltaba exponer el **desplazamiento relativo capturado**. Se extiende `InputState` con acumulador de movimientos recibidos por el listener `_look` de PlayMode, instantánea por frame en `step()` y limpieza en `clear()`. Se expone el valor de solo lectura `game.input.pointerDelta` como copia `{x,y}`. Sin captura de ratón, la ruta de Play no acumula desplazamientos; pausado, modalidad `frozen` o `face` tampoco. El listener sigue enviando ratón al controlador heredado durante la transición y respeta sus restricciones. No hay otro DOM listener, bucle ni gestor.

El script `scripts/fixtures/fps/s16-g005-native-camera-node.js` se adjunta al `CharacterBody3D` y busca su hija `VistaFPS` mediante `node.get_node('VistaFPS')`. Aplica yaw al cuerpo y pitch local limitado a la cámara durante `_process()`, una vez por frame; no llama a métodos de movimiento físico. Consulta `game.camera.active`: cuando otra cámara o toma posee la salida no modifica la orientación; cuando la vista vuelve a la Camera3D del personaje, reanuda. La cámara de la escena debe definirse principal (`main=true`) o seleccionarse por GameManager, sin modificar las prioridades S15. Si falta la hija, la validación `_ready` falla explícitamente.

El ejemplo es una referencia de autoría normal; **no se convierte automáticamente en jugador activo** ni resuelve la identidad de `game.player` (G007). Para probar locomoción junto con cámara, adjuntar además el script G004 al mismo CharacterBody3D. No se cambia `FpsPlayer`, ni el sistema Jolt, ni Camera Orchestration. La cámara sigue siendo funcional en otras jerarquías y contextos.

## Contratos y límites

- S16 G001/G002: composición de nodos normales y única fuente física; se conserva el controlador heredado hasta demostrar paridad.
- S15 Camera Orchestration: FilmMaker, solicitudes y Timeline conservan autoridad; no se impone prioridad por jerarquía ni selección del Editor.
- Timeline CA-005: reproducción independiente de selección y foco editorial; el script no cambia ese contrato.
- La API `pointerDelta` es dato relativo del **ratón capturado**, no un eje reasignable de Input Map; teclas/mando siguen por sus APIs existentes. Control de cámara con stick derecho para el personaje nativo no se implementa en G005 y requiere una decisión posterior si fuera necesario.
- El Editor y NGM Runtime siguen necesitando QA real; el fixture y las pruebas Node simulan los handles, no sustituyen rendering GPU ni Jolt WASM.
- La distribución VSIX sube a 0.1.7 para declarar la API pública; el empaquetado offline actualiza el paquete incluido pero no sustituye la verificación oficial con `npm run vscode:prepare`.

## Archivos y comprobación

- `src/engine/runtime/input/inputmap.js` — acumulación y congelación de deltas.
- `src/engine/runtime/events/play-controls.js` — único listener de ratón.
- `src/engine/runtime/events/play-input.js` — `game.input.pointerDelta`.
- `src/core/events/game-api.d.ts`, `vscode-extension/media/game-api.d.ts` — tipos sincronizados.
- `scripts/fixtures/fps/s16-g005-native-camera-{node.js,scene.json}` — script y escena de QA.
- `scripts/test-fps-native-player-s16-g005-camera3d-orchestration.mjs` — regresión específica.
- `scripts/test-fps-native-player-s16-g003-corr001-node-owner-types.mjs` — prueba de versión VSIX adaptable (ya no fija 0.1.6).

**Estado:** implementación realizada; pruebas automatizadas seleccionadas PASS. Build `vite` NO VERIFICADO; Electron/NGM Runtime/Jolt WASM reales NO VERIFICADOS; aprobación y cierre del Gate PENDIENTES.

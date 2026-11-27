# LevelForge — S15-G003 · Contrato de QA local

**Gate autorizado:** `LF-CAMERA-ORCHESTRATION-S15-G003-EVENT-CAMERA-CONSUMER`.  
**Estado antes del QA usuario:** IMPLEMENTADO, NO APROBADO, NO CERRADO.

## 1. Evidencia automatizada obtenida

- `node --test scripts/test-camera-orchestration-s15-g003.mjs` → **18 PASS / 0 FAIL**.
- Suite integrada de cámaras G003+G002, orden y Match de eventos, Cinematics, PostVolume, VS Code → **139 PASS / 0 FAIL**.
- `node --check` de los módulos afectados → **PASS**.
- `npm run build` en el entorno del asistente → **NO EJECUTABLE**: `sh: 1: vite: not found`. No equivale a fallo del código ni a compilación PASS.
- Electron embebido y ejecución independiente de un juego exportado → **NO VERIFICADOS**.

## 2. Comandos desde la raíz del proyecto local (donde existe package.json)

```bash
node --test scripts/test-camera-orchestration-s15-g003.mjs
node --test scripts/test-camera-orchestration-s15-g003.mjs scripts/test-camera-orchestration-s15-g002.mjs scripts/test-event-order.mjs scripts/test-event-match.mjs scripts/test-cinematics-player-integration-s05-g004.mjs scripts/test-post-s01-g002.mjs scripts/test-vscode-default-script-editor-s02-g001.mjs
npm run build
npm run electron
```

**Resultados esperados:** 18/18 PASS; 139/139 PASS; compilación Editor/Player sin errores y apertura de Electron. Las advertencias antiguas de Vite no demuestran una regresión por sí solas.

## 3. QA manual en Electron embebido

1. Crear un proyecto de prueba **Sin jugador**, añadir dos Camera3D con FOV y posiciones claramente distintos, y un nodo Evento. Confirmar que su comando «Controlar cámara» aparece en **Mundo** y el campo de selección presenta Camera3D, no otro tipo de nodo.
2. Crear tres comandos consecutivos en el mismo evento: **Activar Camera3D A** → **Cambiar Camera3D B** → **Liberar · mantener Camera3D**. Ejecutar en Play Mode y verificar B como vista final (viva, no congelada). Cambiar la transformación de B cuando corresponda y comprobar que la salida sigue a B.
3. En otra ejecución: **Activar A** → **Liberar · volver a base**. Verificar que se aplica la fuente base del proyecto; en una escena sin cámara base ni jugador, debe resultar la vista segura «sin cámara» en lugar de inventar una cámara editorial.
4. Dos eventos distintos: mientras el evento 1 tenga lease activo, intentar cambiar/liberar desde el evento 2. Esperado: rechazo informado y cámara de evento 1 conservada.
5. Con Timeline en control, intentar activar una cámara desde evento. Esperado: rechazo de adquisición, sin quitar la cámara cinematográfica. Repetir con FilmMaker si está disponible en el entorno correspondiente.
6. Eliminar/ocultar una Camera3D activa, cambiar de escena, terminar Play Mode y volver a entrar. Esperado: no reutilizar fuentes o tokens de escenas anteriores; sin excepción y sin cámara fantasma.
7. Verificar que eventos antiguos, scripts `game.camera`, señales, Timeline y la plantilla FPS heredada siguen funcionando y no se han modificado sus datos de Database.
8. Guardar, cerrar y reabrir el proyecto. Los nuevos comandos de evento deben conservar acciones e IDs Camera3D. Comprobar mensajes de errores para referencias inválidas.

## 4. Runtime exportable — evidencia pendiente

Exportar o ejecutar un juego de prueba con un evento que active Camera3D desde la plantilla Sin jugador. Comprobar activación, liberación `keep`, cambio de escena y ausencia de referencias obsoletas. **`npm run build` solo compila; no sustituye esta ejecución.**

## 5. Evidencia que debe aportar el usuario

- Salida de Node y `npm run build`.
- Resultado textual o capturas de los casos de QA manual, indicando proyecto, plantilla y escenarios.
- Salida de consola si hay errores de referencia o bloqueo de autoridad.
- Resultado independiente del runtime exportado, si se realizó.

No declarar QA LOCAL PASS ni cerrar el Gate sin esa evidencia y aprobación del usuario.

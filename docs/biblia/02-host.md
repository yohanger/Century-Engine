# Hosts, arranque y ciclo de vida

## Autoridad del host

<pre>core/store.js → EDITOR_HOST ───┐
                              ├→ RuntimeHost → SceneGraph / PlayMode
.rtpkg → createPackageHost ───┘</pre>

`src/engine/runtime/host.js` define servicios externos; `src/core/editor/editor-host.js` proporciona el adaptador editorial y `src/engine/runtime/package/host.js` el adaptador empaquetado. El host resuelve recursos, almacenamiento y datos necesarios sin obligar al runtime a importar el store editorial.

## Arranque y recuperación

`index.html` → `src/main.js` → `App.vue` → `Editor` → `SceneGraph` + `Viewport` + `PlayMode`. `src/core/editor/project-loading.js` participa en la carga; `src/core/editor/play-session.js` delimita preparación/restauración de la sesión editorial.

`runtime.html` → `src/runtime-app/main.js` → `RuntimeApp.vue` → `src/engine/runtime/package/game.js` → `readPackage` → `GameGraph` + `PlayMode`. `src/runtime-app/storage.js` pertenece a la aplicación distribuida.

**Impacto:** revisar ambos proveedores si cambia un servicio. No interpretar montaje DOM como carga completa. Verificar cancelación, cambio de escena, errores, limpieza y paridad Editor/Player.


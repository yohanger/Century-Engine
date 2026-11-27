# Exportación, Electron y distribución

`src/core/state/game.js` construye el paquete con `src/engine/runtime/package/format.js`. `electron/appimage.cjs` empaqueta el runtime y los recursos; `electron/runtime/main.cjs`, `preload.cjs` y `saves.cjs` son el shell autónomo. `electron/stream-package.cjs` y `src/engine/runtime/streaming/` poseen rutas de streaming que requieren verificación por formato y host.

<pre>Proyecto → writePackage → .rtpkg → dist-runtime + shell → AppImage</pre>

`package.json` declara paquetes de Editor Linux y Windows; los objetivos de exportación de juegos deben contrastarse con `src/core/buildList.js`, configuración de juego y exportador efectivo. `src/core/godot/` mantiene un exportador histórico obsoleto: no confundir con distribución nativa. `electron/preload.cjs` delimita las capacidades del renderer; el bridge de VS Code y el Git integrado (`electron/vcs.cjs`, `vcs-remote.cjs`, `vcs-credentials.cjs`) pertenecen al escritorio. No divulgar secretos ni ampliar privilegios para resolver problemas de UI.

**Impacto:** revisar manifiestos, paths, almacenamiento, IPC, WASM, decoders, políticas de contenido y ejecución empaquetada. Compilar Editor/Runtime no acredita AppImage ni instalación en otra plataforma.


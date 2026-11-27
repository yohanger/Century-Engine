// Superficie pública del Runtime: lo que una aplicación (el editor, el juego exportado, las pruebas) necesita para montar una escena y jugarla.
// El Runtime no importa nada de fuera de esta carpeta (salvo terceros: three, vue…); lo que necesita del exterior lo recibe por `host` (host.js).
export { SceneGraph } from './scene-graph.js'
export { PlayMode } from './events/play.js'
export { createPlayState, freshPlay } from './play-state.js'
export { loadNavCache } from './nav-cache.js'
export { SaveManager, SAVE_VERSION, MemoryStorage, KeyedStorageBackend } from './events/saves.js'
export { registerUiComponents } from './ui/components.js'
export { default as UiRoot } from './ui/UiRoot.vue'
export { FORMAT_VERSION, formatOf, upgradeFormat, renameMarks, hasLegacyMarks } from './format.js'
export { createPlayer, playerTypes, PlayerController, PLAYER_TYPES, DEFAULT_PLAYER } from './player/index.js'
export { writePackage, readPackage, PACKAGE_FORMAT } from './package/format.js'
export { createPackageHost } from './package/host.js'
export { openGame } from './package/game.js'

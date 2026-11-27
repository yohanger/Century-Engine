# Evidencia local suministrada por el usuario

Registro de CORR-001: 17/17 Node y 1/1 TOML PASS. Electron: 67/78 comprobaciones superadas antes de una excepción. Los cinco eventos de teclado nativo, incluidas las operaciones de deshacer y rehacer, conservaron sesión, Edit Mesh, Modo Local, aristas, selección, cámara y vértices. Se deshizo la conversión en Object Mode; al rehacerla falló `mesh.js:91`, desde `refreshMaterials()` / `applyRender()` / watcher de `keys.js`. La causa reproducida aisladamente es la publicación prematura de render, antes de `syncAll()`.

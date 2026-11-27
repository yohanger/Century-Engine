# LF-VCS-S03-G001 — QA de rama y recuperación

## Automatización real Linux

`npm run vcs:test`: pruebas S01, S02 y S03 con Git incluido en `vendor/git/linux-x64/bin/git`; incluyen creación de ramas, bloqueo sobre árbol sucio, restauración de archivos y proyecto, respaldo verificable, recuperación, rutas inválidas, tokens de un solo uso y flujo de confirmación visual comprobado estáticamente.

`node scripts/verify-editor-distribution.mjs source`: estructura de distribución y binarios presentes.

`npm run build`: no verificado en el contenedor (Vite no instalado).

## QA obligatorio pendiente en Electron (no marcar PASS sin ejecución)

- Abrir un proyecto `.lfproj` de varias escenas. Crear un commit completo (incluida `.gitignore`). Crear una rama desde «Ramas»; comprobar que crear no cambia rama automáticamente.
- Cambiar entre dos ramas que alteren diferentes nodos y scripts. Comprobar coherencia entre disco, IndexedDB, jerarquía, materiales y scripts después del cambio, y al reiniciar Electron.
- Con cambios locales modificados, nuevos y/o staged, confirmar que bloquea el cambio sin crear respaldo ni alterar los datos.
- Preparar una restauración, cancelar y comprobar que todo sigue intacto. Confirmar una restauración y comprobar archivos cambiados, manifiesto en `.git/levelforge-backups` y recarga sin guardar la versión anterior.
- Restaurar un archivo individual y comprobar sincronización desde Assets/Scripts; recuperar una versión completa y comprobar proyectos con muchas escenas, Undo/Redo independiente, editor y Player.
- Simular un fallo de recarga: asegurar que se usa el respaldo y no se borran cambios posteriores. Comprobar límite de 128 MiB y bloqueos por symlinks.
- Validar ventanas a 1440×900, 1280×720 y 1024×768, navegación de teclado y mensajes de error.
- Comprobar Git embebido en AppImage y Windows sin Git en PATH, empaquetado Editor y Player, licencia y distribución.

**Estado contractual:** implementado en código, QA Electron/Windows y aprobación del usuario pendientes.

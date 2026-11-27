# LF-VCS-S04-G001 — Remotos Git con sincronización protegida

Fecha: 2026-10-29 · **Implementado, pendiente de QA Electron, AppImage y Windows**

## Baseline y principio

Se extiende el SOURCE_BASELINE `LevelForge_VCS_S03_G001_SOURCE_BASELINE.zip` sin tocar nodos, Event Order Flow, `.lfproj` ni Undo/Redo general. `electron/vcs-remote.cjs` añade operaciones al catálogo cerrado de `electron/vcs.cjs`: `remoteStatus`, `setRemote`, `fetchRemote`, `pushRemote`, `preparePull`, `applyPull`, `cloneRemote`, `credentialStatus`, `saveCredential` y `forgetCredential`. La pestaña **Remoto** vive en `VersionControlPanel.vue` y conserva el panel de commits, diferencias, ramas y restauraciones.

## Transporte independiente

En Linux, `vendor/git/linux-x64/libexec/git-core/git-remote-http` y `git-remote-https` complementan el Git embebido que ya llevaba LevelForge. `GIT_EXEC_PATH` apunta a esos auxiliares dentro de `resources/git` al empaquetar; el `PATH` del subproceso coloca primero el `git` incluido porque Git puede reinvocarse internamente con ese nombre. Se verifica con un servidor local HTTPS y con la ruta al Git del sistema eliminada del PATH. **Importante:** el auxiliar Linux tiene dependencias dinámicas (curl, GNUTLS y bibliotecas ABI); que funcione sin Git instalado no significa que sea totalmente estático o compatible con todas las distribuciones. Es obligatorio comprobar AppImage/DEB en una instalación limpia antes de anunciar compatibilidad universal.

Windows prepara MinGit oficial desde `scripts/prepare-vcs-git.mjs`, con versión y hash SHA-256 fijos; ahora exige además `mingw64/libexec/git-core/git-remote-https.exe`. El proceso `dist:win:package` incorpora el directorio MinGit completo fuera de `app.asar`. El paquete Windows, sus certificados CA y Schannel requieren QA en Windows limpio; no se consideran probados por la ejecución Linux. La redistribución de binarios Git exige mantener avisos y disponibilizar su código fuente correspondiente conforme a GPLv2 y demás licencias aplicables.

## Seguridad de transporte y secretos

- Solo se aceptan URLs `https://` sin `user:password`, query ni fragmento; no se exponen `file://`, SSH ni comandos arbitrarios en la versión de producción. El protocolo `file://` se habilita **únicamente por inyección interna del test**, nunca mediante IPC desde el renderer.
- Git se ejecuta con `spawn` sin shell, `GIT_TERMINAL_PROMPT=0`, límites de tiempo/salida, redirecciones HTTP deshabilitadas y `credential.helper` vacío. Se restringe el protocolo a HTTPS y se deshabilitan hooks de Git desde este proceso. No hay `push --force`, `git clean` ni `reset --hard`.
- Un token temporal se entrega al subproceso mediante configuración Git **de entorno**, acotada a la URL del remoto; jamás se escribe en `.git/config`, `.lfproj`, logs ni argv. La ejecución redacciona el token y el encabezado codificado en diagnósticos. **Riesgo residual:** procesos del mismo usuario con acceso al entorno del subproceso podrían inspeccionarlo; considerar un helper askpass por IPC de un solo uso antes de distribución general si el modelo de amenaza lo requiere.
- El guardado de tokens utiliza `electron.safeStorage` y un archivo cifrado con permisos de propietario en `userData` (fuera del repositorio). Nunca se habilita si el backend seleccionado es `basic_text` o el cifrado no está disponible. El usuario puede olvidar la credencial; con almacén no seguro, utiliza solo token efímero.
- La configuración de `origin`, los límites de ruta y las confirmaciones se validan en Electron main, no solamente en Vue.

## Seguridad de datos del proyecto

**Fetch** actualiza solo referencias remotas y no cambia archivos; **Push** envía commits de la rama actual y nunca fuerza el servidor. Los conteos ahead/behind son del último Fetch.

**Pull** consta de dos acciones separadas: `preparePull` verifica que Git esté limpio, hace Fetch, rechaza divergencias y presenta el listado de archivos afectables con un token de un solo uso y caducidad de 120 s. `applyPull` vuelve a verificar HEAD y el tracking, crea respaldo en `.git/levelforge-backups/`, y ejecuta `git merge --ff-only`. En Vue se suspende el sincronizador de scripts, se recarga `.lfproj` desde disco y se actualiza IndexedDB. Si la recarga falla, se intenta `recoverChange`; el backend devuelve HEAD e índice al estado anterior sin `reset --hard` y restaura archivos desde el respaldo solo si el estado aún coincide con el manifiesto. La recuperación está limitada por las restricciones heredadas de 1.000 archivos / 128 MiB.

**Clone** solo escribe en una carpeta previamente autorizada mediante el selector nativo y vacía. Clona dentro de una subcarpeta temporal, verifica `project.lfproj`, rechaza symlinks y repositorios con más de 10.000 entradas y mueve el resultado al destino; al fallar descarta el temporal. No abre ni ejecuta automáticamente scripts del repositorio remoto. El usuario abre el proyecto desde el menú Archivo.

## Restricciones conocidas

- No se implementan fusiones de conflictos, rebase, Git LFS, autenticación SSH, OAuth en navegador ni comparación semántica de `.lfproj`.
- La UI no muestra progreso por bytes ni expone cancelación de un subproceso iniciado. El runner impone timeout de 120 s a operaciones remotas. Para repositorios grandes debe diseñarse un sistema de cancelación/progreso por IPC en una futura corrección.
- La sincronización HTTPS probada aquí utiliza servidor de QA local con certificado TLS; GitHub/GitLab reales, permisos, rate limits y errores de red deben probarse en los sistemas de destino.
- El certificado CA de prueba se transmite por variable de entorno **solo en tests**; no se modifica la verificación TLS de producción.
- La distribución completa de bibliotecas compartidas Linux y los requisitos de licencia deben auditarse antes de publicar instaladores para terceros.

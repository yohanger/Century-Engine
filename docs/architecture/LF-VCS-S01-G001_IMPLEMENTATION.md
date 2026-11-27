# LF-VCS-S01-G001 — Git nativo y panel de control de versiones

**Estado:** código implementado, pruebas de Linux local PASS; Electron visual, distribución Windows/MinGit y QA en AppImage aún por verificar. No cerrar el Gate sin QA de usuario.

## Arquitectura

* Panel **Versiones** en el dock inferior (`VersionControlPanel.vue`), con pestañas **Cambios** e **Historial**, selección de archivos y formulario de commit.
* `electron/preload.cjs` expone exclusivamente `lf.vcs.execute(action, root, payload)`, sin ejecutar comandos arbitrarios.
* `electron/vcs.cjs` implementa una lista cerrada de acciones: `health`, `init`, `status`, `commit`, `log`. Cada acción valida la carpeta autorizada, exige `project.lfproj`, comprueba que `.git` pertenezca exactamente a ese proyecto, ejecuta `spawn` sin shell, con Git embebido, límites de salida y tiempo, mensajes descriptivos de error y hooks deshabilitados.
* `saveAll()` guarda el proyecto explícitamente antes de **Inicializar** y **Crear commit**. IndexedDB mantiene su copia de trabajo; no se modifica el esquema `.lfproj`.
* El repositorio es exclusivamente local. No se incluye rama, reset, checkout, diff, remotos ni push: corresponden a Gates posteriores. No se muestra ninguna acción falsa.
* Los archivos grandes / binarios `.lfproj` se registran como binarios. No se ofrece diff semántico de escenas en este Gate.

## Git embebido / reproducibilidad

* **Linux x64:** `vendor/git/linux-x64/bin/git`, versión 2.47.3 de Debian 13. Incluido físicamente en la fuente y configurado bajo `build.linux.extraResources`. Se llama por ruta absoluta desde `process.resourcesPath` en la app empaquetada; no se usa el Git del PATH.
* **Windows x64:** `npm run vcs:prepare` descarga la distribución **MinGit 2.56.0.4** desde el lanzamiento oficial `v2.56.0.windows.4` y comprueba SHA-256 antes de extraer bajo `vendor/git/win-x64`. `build.win.extraResources` lo incorpora fuera del ASAR. Cuando no hay red, se puede proporcionar un ZIP oficial previamente descargado mediante `LEVELFORGE_MINGIT_ZIP`. **No se pudo descargar ni ejecutar MinGit Windows en este entorno de QA**; por tanto, el empaquetado en Windows está pendiente.
* `dist:linux:package` y `dist:win:package` exigen `vcs:prepare`, que falla si el binario correspondiente está ausente. No existe fallback al Git del sistema. En el equipo de usuario final no se requiere Git ni red para commits locales (tras producirse correctamente el instalador).
* La compatibilidad de la copia Linux con distribuciones y glibc más antiguos no se ha certificado; requiere prueba real del AppImage/DEB en una máquina destino sin Git.

## Licencias del Git embebido

Git se distribuye bajo **GPL-2.0**, no es parte del código propio de LevelForge. Se incluyen el texto GPL-2 y los avisos del paquete Debian. La distribución pública exige revisar obligaciones de código fuente correspondiente para el binario de Debian 2.47.3 y la compilación Git for Windows MinGit 2.56.0.4. Fuentes de referencia: `https://sources.debian.org/src/git/1:2.47.3-0+deb13u1/` y `https://github.com/git-for-windows/git/releases/tag/v2.56.0.windows.4`. No considerar cerrado el cumplimiento legal sin revisar el paquete final y sus fuentes correspondientes.

## Seguridad / limitaciones

* Solo directorios elegidos y autorizados por el usuario en Electron. Nunca se permite usar una carpeta de repositorio padre como si fuese el proyecto.
* Nunca se exponen flags Git arbitrarios, comandos del shell ni acceso a la terminal.
* `core.hooksPath=/dev/null` evita hooks de commit. Se desactivan configuraciones globales/sistema para aislar el flujo.
* La interfaz no almacena contraseñas ni tokens. Autor y email se guardan como preferencia **local**, sin transmisión externa.
* Como regla operativa, no importar proyectos `.git` no confiables hasta completar una auditoría adicional de filtros Git personalizados / configuración del repositorio.

## QA requerido para cierre

1. Compilar Editor/Player con `npm run build` (Vite no instalado en contenedor).
2. Crear carpeta de proyecto, inicializar y hacer commit; verificar contenido de `project.lfproj` y `Assets/Scripts`.
3. Reabrir proyecto y comprobar estado/historial, cambios múltiples y restauración del autor.
4. Empaquetar AppImage/DEB y ejecutar en Linux sin Git en PATH.
5. Descargar MinGit (hash verificado), empaquetar Setup/Portable Windows, verificar ejecución **sin Git del sistema**.
6. Verificar que el panel es legible en 1440×900, 1280×720 y 1024×768; la pestaña no se recorta, botones funcionales.
7. Validar requisitos GPLv2 antes de publicar los binarios.

Fuera de S01: restauración y cambio de rama; sincronización remota; autenticación; interfaz de diff semántico.

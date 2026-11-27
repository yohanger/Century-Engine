# LF-VCS-S02-G001 — Historial, diferencias y commit selectivo

**Contrato implementado (2026-10-29).** Base: `LevelForge_VCS_S01_G001_SOURCE_BASELINE.zip`. Implementación sujeta a validación visual y build Electron/Windows; no declarar cierre técnico antes del QA local.

## Reutilización de arquitectura

`electron/vcs.cjs` extiende el catálogo cerrado de IPC `lf:vcs` con tres operaciones de **solo lectura**: `detail`, `compare` y `diff`. `log` admite paginación (`offset`, `limit`) y retorna SHA completo; las operaciones de escritura existentes siguen siendo `init` y `commit`. El renderer invoca `window.lf.vcs.execute()` desde `VersionControlPanel.vue`. No se agrega otro servidor Git, no se usa el `PATH` de Git del usuario, ni se modifica `project.lfproj`, IndexedDB, los nodos o los eventos.

La pestaña **Historial** del dock inferior muestra commits navegables con paginación, inspección de archivos del commit y elección de revisiones **A (base)** / **B (destino)**. El destino puede ser la carpeta actual. La columna de archivos permite abrir diferencias de texto con resaltado por líneas, y muestra avisos expresos para binarios o diffs demasiado grandes. Los cambios sin commit se distinguen y pueden visualizarse si son archivos de texto. Esta vista no incorpora checkout, reset, restauración ni push/pull.

## Git, validaciones y límites

- Solo se aceptan revisiones SHA hexadecimales validadas contra objetos commit; el literal `WORKTREE` se admite únicamente como destino de comparación. No se aceptan refs arbitrarias provenientes del renderer.
- Las rutas de archivo se validan mediante `safeFile` y deben pertenecer a la lista real de diferencias. Los archivos nuevos se leen solo después de verificar que su ruta real permanece en la carpeta autorizada y que no son directorios. Se rechazan enlaces que salgan de la carpeta.
- `--no-ext-diff`, `--no-textconv` y `--no-color` protegen el visor frente a herramientas externas de diff y filtros de texto. El proceso Git se ejecuta con `spawn`, sin shell, con directorio autorizado, hooks deshabilitados y 20 segundos de timeout.
- Salida conjunta máxima de Git: 1 MiB; visor textual máximo 96 KiB; hasta 350 archivos modificados por comparación; vista de hasta 1600 líneas; historial paginado en bloques de 40 (offset máximo 5000). Exceder estos límites produce una notificación, no una lectura ilimitada.
- `project.lfproj` se trata como binario salvo contenido que Git considere textualmente diferenciable. No hay diff semántico de escenas o animaciones en este Gate.

## Corrección de staging de S01

`git commit --only ... -- <paths>` obliga a crear un commit con los archivos seleccionados desde el árbol de trabajo, sin incorporar otros archivos ya preparados. Para archivos nuevos se hace `git add -N` **solo de esos archivos** antes del commit; ante un fallo se intenta limpiar únicamente las marcas introducidas. Se valida posteriormente la lista real de archivos del nuevo commit. La selección exige que los archivos sigan apareciendo en `status` después de `saveAll()`.

Esto evita el defecto reproducido en S01: un archivo `other.txt` preparado por otra herramienta podía colarse en un commit del editor aunque no estuviera seleccionado.

## Límites

- Comparación visual de texto línea a línea, **no** merge interactivo ni diff semántico de los miembros del ZIP `.lfproj`.
- La vista de carpeta actual usa el disco, no una instantánea de datos en memoria; para obtener un estado consistente hay que guardar previamente. La vista es solo lectura y no llama `saveAll()` en el momento de comparar.
- MinGit Windows se aprovisiona durante empaquetado como en S01; falta QA real en Windows. Git Linux embebido probado con PATH vacío. Licencia GPLv2 y obligaciones de distribución permanecen documentadas en S01.

## QA

`npm run vcs:test` realiza tests S01 + S02 con Git Linux realmente embebido. La batería de regresión focalizada de 86 casos incluye distribución, pintura de carreteras y Shift+A.

**Pendientes:** compilación Vite Editor/Player (`vite: not found`), Electron visual a 1440×900, 1280×720 y 1024×768, instaladores Linux/Windows, Git Windows sin instalación, límites bajo archivos reales y pruebas con proyectos extensos.

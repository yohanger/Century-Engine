# LF-VCS-S03-G001 — Ramas y recuperación segura (2026-10-29)

## Alcance

Extiende la integración Git local existente con `branches`, `createBranch`, `prepareChange`, `applyChange` y `recoverChange`. La interfaz «Versiones» incorpora «Ramas» con previsualización, confirmación y visualización de los archivos afectados. Las operaciones se limitan al repositorio autorizado por Electron y al Git incluido; no se habilita un terminal ni argumentos arbitrarios enviados desde Vue.

## Flujo de protección

1. El usuario crea antes un commit de todas las modificaciones relevantes: se rechaza estado Git con cambios `unstaged`, `staged` o `untracked`, y se rechazan cambios de memoria sin guardar.
2. `prepareChange` valida que la revisión o la rama existe, calcula los archivos afectados y entrega un token efímero que caduca; no escribe el árbol del proyecto.
3. La interfaz exige confirmación y detiene la sincronización de scripts antes de la operación. `applyChange` verifica otra vez la limpieza Git y que HEAD no cambió.
4. Se guardan copias de los archivos afectados en `.git/levelforge-backups/<UUID>` con manifiesto; se limita a 1000 archivos y 128 MiB por operación. Es un respaldo local no asociado a commits. Nunca se ejecutan `git reset --hard` ni `git clean`.
5. Se ejecuta `git switch -- <rama>` para una rama existente; `git restore --source=<SHA> --worktree -- <archivo>` para un archivo; o `git restore --source=<SHA> --worktree -- .` para recuperar los archivos controlados del proyecto. Git no altera HEAD en los dos últimos casos. No se restaura automáticamente `staging` ni se borran archivos no controlados.
6. Se verifica `project.lfproj`, se detienen escrituras externas, se parsea desde disco y se comprueba ID de proyecto y recursos presentes. `openLfproj(..., skipActiveSave:true)` evita volver a guardar el estado viejo durante la recarga. La copia de IndexedDB se actualiza desde disco, sin alterar la arquitectura de nodos ni el formato `.lfproj`.
7. Si la recarga falla, se intenta `recoverChange` con el UUID del respaldo; la recuperación solo procede si HEAD y las huellas de los archivos afectados siguen como tras la operación. Nunca pisa cambios posteriores. Las copias permanecen en `.git` para diagnóstico y recuperación asistida.

## Límites y riesgos

- Operaciones limitadas a un máximo de 1000 archivos cambiados y 128 MiB de respaldo. Los proyectos mayores requieren una estrategia de respaldos ampliada en un Gate posterior.
- `git restore` del proyecto recupera **archivos seguidos por Git**, no limpia los no seguidos ni mueve HEAD. Deja cambios pendientes que el usuario debe confirmar mediante un commit.
- La integración de IndexedDB debe validarse en Electron y con proyectos complejos reales; las pruebas de Git con binario embebido y las pruebas estáticas no sustituyen esa validación.
- La restauración de scripts también interactúa con el sincronizador de `Assets/Scripts`. Verificar en Electron que la sincronización no revierta el archivo elegido.
- Las ramas remotas y la autenticación permanecen fuera de S03.
- Windows MinGit, AppImage, Editor/Player y recarga de proyectos con recursos reales requieren QA en el sistema destino.

## Continuidad

Fuente de partida: `LevelForge_VCS_S02_G001_SOURCE_BASELINE.zip`. No se modifica el modelo de nodo, Event Order Flow ni el sistema Undo/Redo del editor. `LF-VCS-S04-G001` sigue sin autorización.

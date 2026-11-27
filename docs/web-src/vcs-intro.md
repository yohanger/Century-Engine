# Control de versiones Git en Century Engine

El panel **Control de versiones** conserva el historial de un proyecto en una carpeta local y, si se configura un servidor, permite intercambiar commits por HTTPS. El proyecto sigue siendo un proyecto Century Engine: Git no sustituye el archivo `project.lfproj`, el guardado del editor ni los respaldos de trabajo.

## Antes de empezar

- Utiliza **Century Engine de escritorio (Electron)**. La versión abierta en un navegador no puede iniciar el Git integrado.
- Guarda el proyecto **en una carpeta del disco**: Git no opera directamente sobre una copia que solo existe en memoria o IndexedDB.
- Abre **Control de versiones** en el dock inferior, pestaña **Cambios**. Si no hay repositorio, verás **Inicializar repositorio**.
- Si el editor de escritorio incluye Git, no necesitas instalarlo por separado. Si el panel no está disponible, comprueba la instalación de Century.

## Conceptos esenciales

| Término | Qué significa en Century Engine |
|---|---|
| **Carpeta de trabajo** | Archivos reales del proyecto: `project.lfproj`, Assets y scripts. |
| **Repositorio local** | Directorio oculto `.git` con el historial de commits en el propio equipo. |
| **Commit** | Instantánea de los archivos elegidos, con autor y descripción. No se envía por Internet automáticamente. |
| **Rama** | Línea local de trabajo que puede conservar cambios distintos. Crear una rama **no equivale a cambiarte a ella**. |
| **Remoto `origin`** | Dirección HTTPS opcional de un repositorio en un servidor compatible con Git, por ejemplo GitHub o GitLab. |
| **Fetch / Push / Pull** | Consultar cambios remotos / publicar commits / recibirlos y actualizar el proyecto, respectivamente. |

## Primer flujo recomendado

1. Guarda tu proyecto en una carpeta del disco con **Ctrl+S**.
2. Abre **Control de versiones → Cambios** y pulsa **Inicializar repositorio**.
3. Selecciona los archivos que quieres registrar; escribe **Resumen de los cambios**, **Autor** y **Correo**.
4. Pulsa **Crear commit** y comprueba el resultado en **Historial**.
5. Crea una nueva rama antes de ensayar cambios importantes. Para trabajar en ella, prepara y confirma el cambio desde **Ramas**.
6. Configura **Remoto** solo cuando realmente necesites compartir los commits o clonar un proyecto existente.

## Capítulos de esta guía

- [Cambios y commits](#/vcs-commits): preparación, guardado, selección y autor.
- [Historial y diferencias](#/vcs-historial): comparar revisiones y leer cambios.
- [Ramas y restauración](#/vcs-ramas): cambios seguros, confirmación y respaldos.
- [Repositorios remotos](#/vcs-remotos): HTTPS, Clone, Fetch, Push y Pull.
- [Seguridad y límites](#/vcs-seguridad): credenciales, recuperación y distribución.
- [Problemas frecuentes](#/vcs-problemas): errores y pasos de diagnóstico.

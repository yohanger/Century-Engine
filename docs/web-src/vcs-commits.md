# Cambios y commits Git

Un commit registra un conjunto **explícito de archivos** en el historial local. Guardar una escena con Ctrl+S y crear un commit son acciones distintas: el primer paso actualiza archivos; el segundo registra una versión de esos archivos.

## Inicializar un repositorio

1. Abre un proyecto Century Engine guardado en una carpeta real. Si el panel indica **SIN CARPETA**, primero abre o guarda un proyecto en disco.
2. En el dock inferior, abre **Control de versiones**. Cuando aparezca **Este proyecto aún no utiliza control de versiones**, pulsa **Inicializar repositorio**.
3. El editor guarda el proyecto antes de inicializar. Si no puede guardarlo, detiene la operación.
4. Se crea `.git` en la misma carpeta de `project.lfproj`. No se inicia un repositorio en una carpeta superior ni se eliminan archivos del proyecto.

## Crear un commit selectivo

1. En **Cambios**, pulsa **Actualizar** para consultar el estado del disco.
2. Marca cada archivo que deseas incluir o utiliza **Seleccionar todo**. `M` indica modificado, `A` añadido, `D` eliminado y `U` no seguido por Git.
3. Escribe un **Resumen de los cambios** que explique qué cambió, no solo que «se guardó».
4. Completa **Autor** y **Correo**. Son metadatos de autoría Git: no crean una cuenta en un servidor ni autentican una conexión remota. Century Engine conserva estos datos como preferencia local.
5. Pulsa **Crear commit**. El editor ejecuta el guardado y vuelve a validar la lista antes de registrar la revisión.
6. Abre **Historial** para verificar la nueva revisión.

## Qué se guarda y qué no

Un commit contiene solamente los archivos seleccionados, aunque otras herramientas Git hayan preparado archivos distintos. El proyecto `.lfproj` puede contener datos binarios y no dispone de un comparador semántico de escenas. Los Assets y scripts modificados deben incluirse si quieres reproducir la revisión completa.

**No** se envían cambios a GitHub o GitLab al crear un commit. Para ello necesitas configurar `origin` y ejecutar **Push** en [Repositorios remotos](#/vcs-remotos).

## Recomendaciones antes de cambiar ramas

- Incluye el `.lfproj`, escenas y scripts relacionados en commits coherentes.
- Comprueba que **Cambios** indique **LIMPIO** y que no existan archivos nuevos sin registrar.
- Guarda también cualquier modificación aún abierta en el editor; la restauración exige que el proyecto y el repositorio estén limpios.
- No edites directamente `.git` ni lo agregues a los archivos seleccionados.

Continúa con [Historial y diferencias](#/vcs-historial) o [Ramas y restauración](#/vcs-ramas).

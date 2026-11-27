# Problemas frecuentes del control de versiones

## El panel indica «SIN CARPETA»

El proyecto no está asociado a una carpeta real autorizada. Abre o guarda primero un proyecto en disco. Git no se ejecuta directamente sobre la copia interna de IndexedDB. En el navegador web, la integración Git no está disponible: utiliza Electron.

## No se habilita «Crear commit»

Selecciona al menos un archivo, introduce el resumen, autor y correo y verifica que el proyecto se puede guardar. Si los cambios desaparecieron después de guardar, actualiza el estado y vuelve a seleccionar los archivos reales.

## El cambio de rama o la restauración están bloqueados

Revisa **Cambios**: debe estar **LIMPIO**, sin archivos nuevos no seguidos, preparados o modificados. Guarda las modificaciones de la sesión y crea un commit antes de intentarlo. Los botones de preparación también se deshabilitan mientras una operación está en curso.

## Preparé una restauración, pero ya no puedo aplicarla

El token de confirmación es temporal y solo se usa una vez. Si caducó, cambió HEAD o se modificaron los archivos, vuelve a **Preparar cambio** o **Preparar archivo** y revisa de nuevo el listado. No fuerces el sistema de respaldos.

## Fetch funciona, pero Pull se rechaza

**Fetch** no modifica el trabajo local. **Pull** solo acepta actualizaciones por avance rápido y necesita un árbol limpio y rama con seguimiento remoto válido. Si el historial local diverge del remoto, el panel no realiza merge. Conserva tus commits y resuelve la divergencia mediante un flujo Git compatible fuera del panel, sin borrar ramas ni forzar Push.

## Fallan Clone, Fetch o Push por autenticación

Comprueba que la URL sea HTTPS, que el repositorio exista y que el token tenga permisos adecuados y no haya expirado. No añadas el token en la URL. Si el servidor informa de un certificado inválido, no desactives la verificación TLS: revisa el servidor, su certificado y la configuración del sistema.

## Clone rechaza la carpeta

Selecciona una carpeta **vacía**. El repositorio debe contener un `project.lfproj` válido; Century Engine rechaza proyectos con enlaces simbólicos o tamaños y cantidades de archivos incompatibles con sus límites de seguridad. Después del clon, abre el proyecto desde Archivo, no desde un botón de ejecución automática.

## No se ven cambios en una comparación

La pestaña **Historial** muestra diferencias textuales y metadatos de archivos; algunos archivos binarios —incluido `.lfproj`— no tienen una comparación legible. Guarda los archivos al disco si deseas comparar con **Carpeta actual**. Un historial muy grande requiere **Cargar más revisiones**.

## Dónde buscar más información

Consulta [Introducción a Git](#/vcs-intro), [Ramas y restauración](#/vcs-ramas), [Repositorios remotos](#/vcs-remotos) y [Seguridad y límites](#/vcs-seguridad).

# Ramas y restauración segura

La pestaña **Ramas** permite crear una rama local, cambiar a otra y recuperar archivos o contenido de un commit anterior. Son operaciones que pueden reemplazar archivos en el disco; Century Engine exige una preparación y una confirmación antes de aplicarlas.

## Crear una rama

1. Abre **Control de versiones → Ramas**.
2. Escribe un nombre como `feature/acera-redondeada` en **Nueva rama** y pulsa **Crear**.
3. Revisa la lista **RAMAS LOCALES**. La rama activa aparece con la indicación **ACTUAL**.

**Crear una rama no cambia a ella automáticamente.** Para comenzar a trabajar en la nueva rama, utiliza el procedimiento siguiente.

## Cambiar de rama sin perder trabajo

1. En **Cambios**, confirma y guarda todo lo pendiente. Los archivos nuevos no seguidos y los ya preparados para commit también bloquean el cambio.
2. Regresa a **Ramas**, selecciona una rama existente y pulsa **Preparar cambio**.
3. Revisa la lista de archivos afectados y la revisión de destino. Esta preparación no modifica aún el proyecto.
4. Marca **He revisado los archivos y acepto aplicar la revisión**.
5. Pulsa **Aplicar y recargar proyecto**. Se ejecuta el cambio y se vuelve a cargar el `.lfproj` desde disco, sincronizando el estado local del editor.

La confirmación está asociada a un token temporal de un solo uso; si la carpeta cambia o el token caduca, prepara de nuevo la operación.

## Restaurar un archivo o una revisión

**Archivo individual:** selecciona primero un commit desde **Historial**, regresa a **Ramas**, elige uno de sus archivos y pulsa **Preparar archivo**. Revisa y confirma.

**Archivos del proyecto:** elige un commit en **Recuperar una revisión del historial** y pulsa **Restaurar proyecto**. Revisa la lista afectada y confirma.

Esta restauración recupera los archivos **seguidos por Git** desde el commit elegido. No cambia necesariamente la rama ni mueve HEAD, no borra automáticamente archivos no seguidos y no es un restablecimiento destructivo del repositorio. Después puede haber cambios pendientes por confirmar.

## Respaldos y recuperación

Antes de aplicar una operación que modifica el proyecto, Century Engine guarda los archivos afectados en `.git/levelforge-backups/<identificador>`, con manifiesto. El límite es **1.000 archivos y 128 MiB por operación**; si se supera, la operación se rechaza. La recuperación automática se intenta cuando falla la recarga, pero solo si las huellas de los archivos siguen siendo compatibles con la operación: **no se sobrescriben cambios posteriores**.

Un respaldo dentro de `.git` no sustituye una copia externa del proyecto. Conservar una copia adicional es recomendable antes de cambiar ramas que contienen escenas o recursos importantes.

## Qué no incluye

No hay resolución visual de conflictos, merge interactivo, rebase, cherry-pick ni un flujo de `reset --hard`. En caso de ramas divergentes, conserva las dos versiones y resuelve el trabajo fuera de este panel antes de sincronizar.

Lee [Seguridad y límites](#/vcs-seguridad) y [Problemas frecuentes](#/vcs-problemas).

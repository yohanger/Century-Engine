# Historial y comparación de revisiones

**Historial** permite inspeccionar commits y comparar contenidos sin modificar archivos. Separa lo que está guardado en Git de los cambios actuales de la carpeta de trabajo.

## Explorar el historial

1. Abre **Control de versiones → Historial**.
2. Selecciona un commit para ver su autor, fecha y archivos afectados.
3. Utiliza **Cargar más revisiones** cuando haya más entradas. El historial se presenta por páginas.
4. Cada commit tiene dos controles: **A** lo asigna como revisión base y **B** como revisión de destino.
5. Elige otra revisión para el destino o **Carpeta actual** y ejecuta la comparación. Selecciona un archivo de los resultados para abrir sus diferencias textuales.

## Interpretar las diferencias

| Elemento | Interpretación |
|---|---|
| **A: base** | Revisión desde la cual comparas. |
| **B: destino** | Revisión comparada con A; admite la carpeta actual. |
| **Líneas añadidas / eliminadas** | Diferencias de texto mostradas por el visor. |
| **Archivo binario** | El contenido no tiene una diferencia textual útil; puede mostrarse una advertencia. |
| **Archivo renombrado** | Puede identificarse como un cambio de ruta según la información de Git. |

La comparación es **solo lectura**. Seleccionar A o B **no cambia de rama**, no restaura la escena y no realiza merge. Para modificar archivos debes usar el flujo explícito de [Ramas y restauración](#/vcs-ramas).

## Límites del visor

El backend limita el tamaño de las diferencias y la cantidad de archivos procesados. Un archivo demasiado grande o binario puede no mostrar líneas de texto. `project.lfproj` no se interpreta como una secuencia de cambios de nodos, materiales o eventos: no existe un *diff* semántico de ese archivo.

La comparación con **Carpeta actual** lee los archivos del disco, no los cambios aún presentes solo en memoria. Guarda primero si necesitas comparar el contenido más reciente.

## Ejemplo de uso

Has registrado `Acera inicial` y después `Acera con bisel`. Abre Historial, marca el primero como **A**, el segundo como **B** y revisa los archivos afectados. Si el cambio no te convence, **no edites un commit desde Historial**: consulta [Restaurar un archivo o una revisión](#/vcs-ramas).

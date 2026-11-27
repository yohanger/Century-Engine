# CENTURY-EDITOR-INSPECTOR-S01-G001-PROFESSIONAL-NODE-INSPECTOR-UX

Estado: ratificado y autorizado literalmente por el usuario; aprobación de resultado pendiente.

## Alcance
- Presentación compacta y coherente de nodos, selección múltiple, encabezados, propiedades, scripts y materiales del Inspector.
- Unificar los colores de los ejes XYZ con Edit Mesh: X rojo, Y verde, Z azul. Mantener etiquetas, campos, unidades, restricciones, commits, llaves de propiedad y acciones existentes.
- Retirar presentación redundante sin retirar propiedades ni acciones: icono genérico, tarjeta duplicada del material y botón que abre el mismo selector de scripts. Usar la miniatura, selector y menú de materiales existentes.
- Conservar semántica del Inspector, selección, transformación, persistencia, Undo/Redo, tipos y recursos. Mantener los controles y la infraestructura de plegado/búsqueda existentes.
- Responsividad: preservar controles, etiquetas y legibilidad en el ancho disponible.

## Límites
No modificar runtime, lógica de transformación, persistencia, selección, dependencias ni el Gate de estabilidad. No crear otro sistema de materiales, scripts o Inspector. No aprobar Gates anteriores por inferencia.

## Baseline
Último SOURCE_BASELINE acumulativo disponible: CENTURY_EDITOR_SCENE_S01_G001_CORR001_SOURCE_BASELINE.zip. Coincidencia de 3958 archivos con la copia de trabajo original, sin cambios locales observados en esa copia. No hay acceso al árbol local del usuario. La corrección de diagnóstico de Escena sigue pendiente de QA local; utilizarla como base acumulativa no implica aprobación ni cierre.

## Aceptación
Pruebas focales, comparación de regresiones, sintaxis, compilación y runner Electron específico. La revisión visual, colores computados, responsividad y operaciones reales requieren evidencia Electron. Sin esa evidencia: no verificado. Mantener estado pendiente de aprobación y cierre.

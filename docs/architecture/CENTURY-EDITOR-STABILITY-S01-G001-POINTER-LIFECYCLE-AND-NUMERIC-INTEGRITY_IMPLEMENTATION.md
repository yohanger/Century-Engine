# Implementación

- Captura editorial compartida: validar puntero y elemento antes de iniciar gestos, rechazar excepciones DOM esperadas con contexto y propagar las inesperadas. Cancelación y limpieza en pérdida de captura/foco en rutas auditadas. El docking conserva su alternativa de escucha global. No se altera FilmMaker ni código de terceros.
- Validación de dimensiones del viewport y coordenadas antes de construir rayos; evitar colocación sin punto válido. Validaciones de cámara y transformaciones en rutas existentes. Gizmos conservan la última pose válida ante resultados inválidos detectados.
- Edit Mesh: validar resultados antes de consolidar transformaciones, operaciones y atributos; rechazar desbordamiento UV sin modificar los valores originales. Evitar dibujo SVG inválido y mostrar advertencia. Se conservan los algoritmos de modelado y los controles existentes.
- Campos numéricos: rechazo de entradas y resultados no finitos. Ancho de etiquetas del Inspector limitado al rango 72–240 del contrato de preferencias.
- Serialización estricta en rutas de guardado de proyecto, escena, archivo e historial: NaN/Infinity generan error contextual en lugar de convertirse silenciosamente a null. No equivale a reparar archivos previamente corruptos ni a certificar todas las rutas de copia.
- QA: suite focal, runner Electron y fixture; dos harnesses históricos inyectan las nuevas funciones importadas sin modificar assertions.

## Límites de la entrega
El origen exacto del primer NaN y la llamada minificada de captura de la sesión reportada no están identificados. Se acreditan mecanismos reproducibles y protecciones de rutas concretas, no la resolución del crash ni la cobertura de todas las operaciones extremas. Falta evaluar rendimiento, interacción nativa, guardado real y compilación. No se aprueba ni cierra el Gate.

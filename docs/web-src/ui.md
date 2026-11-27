# Interfaces y localización

Century Engine ofrece nodos Canvas y recursos de interfaces `.ui`, además de un sistema de localización de textos.

## Canvas

El nodo Canvas aloja contenido de interfaz de escena. Los controles de UI se configuran en herramientas especializadas en lugar de asumir que son mallas 3D.

## Editor visual de interfaces
En la ventana del recurso `.ui`, selecciona **Plantilla → Diseño**. El editor presenta simultáneamente **Herramientas + Jerarquía**, **Canvas** e **Inspector**; ya no es necesario alternar entre tres paneles para seleccionar y editar un control.

- **Crear**: selecciona un tipo en Herramientas y dibuja sobre el Canvas, o haz doble clic en la herramienta para crear un control de tamaño predeterminado.
- **Seleccionar y organizar**: utiliza el Canvas o la Jerarquía; filtra por nombre, cambia el orden Z, duplica o elimina desde sus controles.
- **Anidar**: arrastra un elemento de la Jerarquía hasta un Panel compatible, o cambia **Contenedor** desde el Inspector. Puedes devolverlo al Formulario. No se permiten ciclos de anidamiento.
- **Editar**: propiedades geométricas, estilo, anclajes, eventos y recursos aparecen en el Inspector. Los slots compatibles admiten arrastrar recursos desde Assets Browser.
- **Redimensionar paneles**: usa los separadores laterales; también admiten las flechas del teclado cuando reciben el foco. La ventana compacta organiza las zonas verticalmente.
- **Previsualizar**: cambia resolución/zoom sobre el Canvas y abre **Simulación de juego** para mostrar diálogos y otros estados de prueba sin guardarlos en el proyecto.
- **Editar código**: las pestañas Plantilla → HTML, Script y Estilo conservan la edición manual. Si el HTML ha sido alterado respecto al diseño, se solicita una decisión explícita antes de regenerarlo.

El código generado y el estado del diseño se conservan en el `.ui` existente.

## Recursos .ui

Los archivos `.ui` pueden representar interfaces como inventarios, diálogos y menús. El sistema de slots permite conectar acciones específicas del juego.

## Textos y localización

El Editor de Localización administra claves y traducciones. Los comandos de diálogo pueden apuntar a claves, y JavaScript puede interactuar con la API de idioma y textos disponibles.

## Seguridad

Utiliza únicamente código y recursos de confianza. Las interfaces del juego deben utilizar los mecanismos de recursos propios de Century Engine.

# Tutorial: tu primer evento

Este ejercicio crea un evento que muestra un mensaje y guarda un interruptor. Los nombres pueden adaptarse al proyecto.

## Preparar la escena

1. Crea una escena y agrega un nodo **Evento**.
2. Abre el editor de eventos del nodo.
3. Selecciona su primera página y añade un comando **Mostrar texto**.
4. Escribe una línea de diálogo y confirma.
5. Añade un comando **Cambiar interruptor** para registrar que el diálogo ya se vio.

## Probar

Inicia PlayMode, interactúa con el evento y verifica en el flujo que el mensaje aparece antes de modificar el interruptor.

## Extender el ejemplo

Agrega una segunda página con una condición basada en ese interruptor y un texto diferente. Las páginas y sus condiciones siguen siendo las responsables de decidir qué contenido se ejecuta.

## Aprender la API

Consulta los comandos `text` y `switch` en el índice y su equivalente de `game.say()` y `game.setSwitch()` en la referencia API.

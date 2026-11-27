# Eventos y Event Order Flow

Los nodos **Evento** contienen páginas y comandos. La ejecución visual de eventos es distinta del scripting asociado a nodos.

## Páginas y condiciones

Cada página define condiciones para estar activa y una lista ordenada de comandos. Los comandos se ejecutan secuencialmente; algunos esperan diálogo, señal, cinemática o entrada del jugador antes de continuar.

## Orden y reentrada

Event Order Flow controla la selección y ejecución de las páginas. El orden de las páginas es independiente de los callbacks de actualización y física de los scripts.

## Comandos

La [referencia de comandos](#/comandos-intro) reúne los comandos disponibles. Incluye identificador, descripción, parámetros, valores por defecto y equivalente de script cuando existe.

## Señales y comandos avanzados

Los comandos permiten emitir o esperar señales, ejecutar otro evento y construir bloques de control. Consulta [Comandos de evento](#/comandos-intro) y busca `signal`, `waitSignal`, `match` o `runEvent`.

## Comandos y API JavaScript

No todos los comandos tienen equivalente directo en script. Cuando existe, la referencia indica la llamada ilustrativa correspondiente y enlaza a la API.

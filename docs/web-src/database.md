# Database y gameplay

La Database contiene definiciones de objetos, habilidades, estados, equipos y otras reglas de juego. El editor ofrece una ventana especializada para estos registros.

## Definiciones frente a instancias

Un registro de Database describe un tipo de objeto o regla. Un nodo de escena representa una instancia espacial o interactuable. La arquitectura no requiere que cada registro sea un nodo independiente.

## Gameplay Object

El nodo Objeto interactuable conecta acciones de juego con una representación concreta, sin sustituir al sistema de páginas de eventos. El comportamiento puede extenderse por script y por las interfaces existentes.

## Variables e interruptores

Los eventos usan interruptores, variables y auto-interruptores para sus condiciones. Desde JavaScript se consultan mediante `game.switch`, `game.variable` y sus métodos asociados.

## Consumo, estados y equipo

Los sistemas de Database calculan sus propias operaciones y pueden interactuar con inventario y estadísticas. Para las firmas disponibles, consulta `Party` y las interfaces relacionadas en [API](#/api-intro).

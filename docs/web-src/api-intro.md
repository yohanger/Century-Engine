# Referencia de la API JavaScript

Consulta las clases, métodos y propiedades disponibles en los scripts del juego.

## Objetos de contexto

| Objeto | Dónde está disponible |
|---|---|
| `game` | Scripts globales, scripts de nodo y otros contextos soportados |
| `node` | Scripts de ejecución Nodo |
| `event` | Contextos de ejecución del nodo Evento, cuando corresponda |
| `args` | Llamadas que reciben argumentos |

## Estructura de la referencia

Cada interfaz documenta propiedades, tipos, métodos, argumentos, firmas y descripciones disponibles en la declaración real. La referencia está organizada por interfaz; por ejemplo: **Game**, **NodeHandle**, **NodeScriptHandle**, **Player** y **PhysicsApi**.

## Disponibilidad

`game.player` requiere un jugador nativo activo. Las operaciones históricas del FPS anterior, como `jumpNow()` y los estados de natación, no están disponibles en el jugador actual. Para controlar el personaje utiliza su nodo CharacterBody3D. `game.water` no está disponible en el intérprete actual.

## Ejemplo

```js
const puerta = game.node('Puerta')
if (puerta) {
  puerta.visible = true
}
```

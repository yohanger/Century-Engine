# Timeline y FilmMaker

Timeline permite autoría de secuencias mediante pistas y claves; las propiedades animables, audio y cámaras se configuran en sus herramientas correspondientes. FilmMaker es el editor de capturas y secuencias cinematográficas; no es una segunda autoridad de reproducción para los mismos recursos. Consulta el Inspector de cada recurso para sus parámetros.

Desde un script Global o un comando Script de evento, puedes iniciar una Timeline guardada:

```js
const resultado = await game.timeline.play('Introducción')
console.log(resultado)
```

El nombre debe existir en el proyecto. `pause`, `resume`, `stop`, `skip`, `seek`, `speed`, `isPlaying`, `info` y `list` se describen en [TimelineApi](#/api-timelineapi). Desde un script Nodo usa una función `async` interna si necesitas esperar. La autoridad de la cámara depende de la secuencia y sus políticas de salida; no asumas que todas devuelven el control al jugador de forma implícita.

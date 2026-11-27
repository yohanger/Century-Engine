# Century Fluids voxelizado

Biblioteca experimental de agua para JavaScript y TypeScript. Incluye el solver voxelizado, el adaptador de Jolt, la superficie incremental y los eventos de ondas y salpicaduras. El solver conserva el volumen en un único mundo.

## Compilar y probar

Requiere Node.js 20 o posterior.

```sh
npm ci
npm test
```

## Contactos con la superficie

Importa `WaterDisturbances` desde `@century/fluids/water`. Crea una instancia por escena. Tras cada paso fijo del motor, llama a `observe(world, contacts, dt)` con la posición del pie o la base del colisionador, su velocidad y su radio en metros. Usa un identificador estable por contacto.

```js
import { Vec3 } from '@century/fluids'
import { WaterDisturbances } from '@century/fluids/water'

const disturbances = new WaterDisturbances()
const events = disturbances.observe(world, [{
  id: 'player',
  kind: 'character',
  position: Vec3.of(1, 0.05, 2),
  velocity: Vec3.of(1.4, 0, 0),
  radiusMeters: 0.32,
}], 1 / 60)
```

Los eventos describen el punto de contacto, la dirección, el tamaño, la intensidad, la velocidad y duración de la onda, y la cantidad relativa de gotas. Century Engine usa estos datos para animar el material y las gotas mientras conserva el reloj fijo de Jolt. Llama a `clear()` al cerrar la escena.

## Terreno

Cuando las muestras fijas de una cara están cerradas, el solver comprueba la altura del agua para detectar caminos cuesta abajo. La prueba conserva las colisiones contra muros y el balance de volumen.

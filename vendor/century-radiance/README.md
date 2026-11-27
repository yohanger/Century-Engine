# Century Radiance

Fundación independiente de la autoridad de iluminación de Century. Esta entrega implementa exclusivamente `CENTURY-RADIANCE-S00-G001-UNREAL-INSPIRED-LIGHTING-FOUNDATION`.

## Estado

- Implementación S00 completa y verificada localmente
- Aprobación y cierre del Gate pendientes del titular
- Sin integración con Century Engine
- Sin dependencia activa de Century Radiance Generation I
- Sin código, shaders ni activos de Unreal Engine
- S01 y posteriores no iniciados

## Autoridades de la fundación

TypeScript gobierna CPU y ciclo de vida. GLSL ES 3.00 queda como autoridad GPU. WebGL 2 es el backend obligatorio inicial. Three.js conserva rasterización y PBR base y se declara como `peerDependency` exacta para evitar una segunda instancia. El contexto WebGL 2 lo crea el consumidor. Radiance crea, diagnostica, reinicia y libera sus propios recursos.

La referencia UE 4.1 se usa para fronteras y flujos: registro de luces, separación Editor/Lightmass/Runtime, datos precalculados residentes, Sky Light, Reflection Environment y composición por vista. La implementación es propia para TypeScript, GLSL, Three.js y WebGL 2.

## API pública de S00

```ts
import { CenturyRadiance, WebGL2Backend } from '@century/radiance'

const gl = canvas.getContext('webgl2')
if (!gl) throw new Error('WebGL 2 required')

const radiance = new CenturyRadiance(new WebGL2Backend(gl), {
  workerFactory: () => new Worker(workerUrl, { type: 'module' })
})

await radiance.initialize()
console.log(radiance.getDiagnostics())
await radiance.reset()
radiance.dispose()
```

S00 publica ciclo de vida, errores, capacidades, diagnóstico y un canal Worker verificable. No publica stubs de iluminación directa, Lightmass, lightmaps, SH, capturas o composición.

## Comandos

```text
npm ci
npm run verify:imports
npm run typecheck
npm test
npm run qa:webgl
npm run qa
npm run dev
```

`npm run qa:webgl` ejecuta Edge headless con SwiftShader y registra renderer, GLSL, FBO, transferencia, cancelación, pérdida/restauración y liberación. Esa prueba no acredita una GPU física.

## Estructura

- `src/api/` superficie pública, opciones y diagnóstico
- `src/core/` capacidades, lifecycle y errores
- `src/graphics/` contratos gráficos y backend WebGL 2
- `src/workers/` protocolo, cliente, host y entradas de Worker
- `examples/playground/` consumidor de validación con Three.js PBR
- `tests/` pruebas Node y navegador
- `tools/` build, QA, límites y manifiestos
- `docs/` contratos, arquitectura, Gate y roadmap
- `ledger/` manifiesto verificable de la entrega

Century Engine, Generation I y Unreal Engine 4.1 son fuentes externas de auditoría y no forman parte de este paquete.

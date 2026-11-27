# IntelliSense y VS Code

`src/core/events/game-api.d.ts` es la declaración pública compartida. El editor integrado utiliza CodeMirror y su analizador de tipos; VS Code utiliza el servicio TypeScript con el plugin de propietarios de Century. No son el mismo servicio de lenguaje: la paridad se refiere a los símbolos públicos y a los contextos soportados, no a todas las funciones de TypeScript.

## Contexto

- Global: `game`, `event` (si existe contexto) y `args`.
- Nodo: `game`, `node`, callbacks síncronos de ciclo de vida; funciones `async` internas son posibles.
- UI: contexto propio de la pantalla, descrito en [UI](#/ui).

Escribe `game.` o `node.` para sugerencias. La información de firma y JSDoc procede de las declaraciones. Los nombres de recursos se generan a partir de escenas, Database, audio, localización, Timeline y Prefabs. No todos los nombres sugeridos están disponibles en la escena activa durante Play: comprueba la existencia del handle.

## Propietario de un script Nodo

El tipo especializado se obtiene solo cuando todas las asociaciones conocidas en escenas y Prefabs corresponden a `CharacterBody3D`. Con propietarios mixtos, ausentes o escenas no leídas, se conserva el tipo general. Las referencias obtenidas por búsqueda no se convierten automáticamente en handles especializados.

## Proyectos guardados en disco

Desde el editor utiliza la integración VS Code existente. Guarda el proyecto para regenerar `.levelforge/api.d.ts`, `.levelforge/project.d.ts` y `.levelforge/script-owners.json`. La ruta y los identificadores históricos se conservan por compatibilidad. No edites los archivos generados: conserva tu código en Assets. Si las sugerencias se quedan antiguas, vuelve a abrir el proyecto o ejecuta **TypeScript: Restart TS Server**. La extensión debe corresponder a la versión de declaraciones distribuida. La nueva versión de fuentes requiere preparar el VSIX antes de distribuirla.

Consulta [Propiedades editables](#/propiedades-editables) y [Referencia API](#/api-intro).

# Architecture Bible · Century Radiance Generation II

## 1. Principio rector

Una contribución óptica tendrá una sola autoridad activa. La arquitectura futura no sumará proveedores antiguos y nuevos sobre la misma energía. La sustitución se acreditará por Gate y conservará reversión hasta validar paridad. S00 construye la frontera y no transfiere aún ninguna autoridad desde Century Engine.

## 2. Capas y dependencias

```text
Consumer host
  owns WebGL2 context and scene data
        │
        ▼ public typed API
Century Radiance Core
  lifecycle · errors · capabilities · diagnostics
        │
        ├── WebGL2 backend
        │     owns only Radiance-created GPU resources
        │
        └── Worker client ── typed protocol ── Worker host
              transfer · progress · cancel · dispose · limits

Playground only
  Three.js rasterization and PBR base
```

Las dependencias apuntan hacia contratos internos. `src/` no importa Century Engine, Generation I, Vue, Electron, stores ni herramientas editoriales. Three.js es `peerDependency` y solo participa en el consumidor de validación durante S00.

## 3. Autoridad y propiedad

| Dominio | Autoridad | Regla |
|---|---|---|
| Escena, nodos, jerarquía, identidad, transforms, serialización | Century Engine | Radiance consumirá descriptores futuros sin apropiarse de la escena. |
| Física, scripting, eventos, recursos, reloj, clima, viento y simulación atmosférica | Century Engine / World | Radiance consumirá snapshots y no duplicará simulación. |
| Rasterización y PBR base | Three.js | Una sola instancia resuelta por el consumidor. |
| Política y transporte óptico | Century Radiance | Directa, sombras, lightmaps, indirecta, Sky Light, Reflection Environment y composición según Gates futuros. |
| Contexto WebGL 2 | Consumidor | Radiance nunca lo crea ni lo destruye. |
| Recursos GPU/Worker creados por Radiance | Century Radiance | Reset y dispose deben liberarlos. |
| Construcción/horneado | Editor por solicitud explícita | Runtime solo consume resultados publicados. |

## 4. Ciclo de vida S00

`idle → initializing → ready → context-lost → ready` admite recuperación automática cuando el host restaura el contexto. `reset()` libera recursos y vuelve a `idle`. `dispose()` es terminal e idempotente. Inicializaciones repetidas en `ready` devuelven las mismas capacidades. Los errores tienen código estable y mensaje de diagnóstico.

El backend prueba recursos reales RGBA8 y, cuando `EXT_color_buffer_float` está disponible, RGBA16F. Restaura los bindings que toca. La pérdida de contexto invalida referencias sin intentar borrar objetos inválidos. La restauración reconstruye recursos si el módulo estaba activo.

## 5. Worker S00

Cada petición tiene identificador. El cliente transfiere la propiedad del `ArrayBuffer`, correlaciona progreso y resultado, propaga cancelación mediante `AbortSignal`, limpia listeners y termina el Worker en `dispose`. El host limita el tamaño de chunk entre 1 byte y 4 MiB, cede el event loop entre chunks y devuelve el buffer mediante una nueva transferencia de propiedad.

OffscreenCanvas no se usa. Su presencia se diagnostica, pero su adopción requiere soporte comprobado y beneficio medido.

## 6. Política futura ya decidida

Hybrid será el modo predeterminado. Static, Stationary y Movable tendrán una contabilidad explícita de energía. Cambiar cámara, puerta u objeto móvil no solicitará bake. El bake será editorial, explícito, cancelable y publicará resultados completos y versionados. Estas reglas son criterios de diseño y todavía no constituyen APIs S01–S08.

## 7. Referencia Unreal Engine 4.1

UE 4.1.1 fija la referencia técnica de separación, no una implementación para traducir. Se adoptan como patrones:

- Scene/World registra estado de luces y el Renderer consume proxies
- Editor exporta el trabajo estático y un proceso separado lo construye
- Runtime registra datos precalculados residentes y los objetos móviles consultan iluminación sin rehornear
- Sky Light y Reflection Captures se capturan, filtran y componen mediante una política central
- Post Process se evalúa por vista, prioridad, distancia y peso

La correspondencia de archivos y la adaptación a WebGL 2 están en `docs/architecture/UnrealEngine41Reference.md`.

## 8. Century Runtime

Century Runtime es el nombre oficial futuro. Runtime podrá depender de Core y módulos de ejecución, nunca de herramientas exclusivas del Editor. Editor y Runtime compartirán contratos puros en Core, no implementaciones duplicadas. S00 solo documenta esta dirección. Ningún paquete, ejecutable, directorio, configuración, interfaz o prueba se renombra en este Gate.

## 9. Gates y publicación

Cada Sprint requiere autorización independiente, implementación, QA reproducible, revisión y aprobación explícita. Un Gate implementado no está cerrado hasta la aprobación del titular. La integración comienza únicamente en S09. Retirar implementaciones anteriores exige sustitución acreditada y un Gate que lo autorice.

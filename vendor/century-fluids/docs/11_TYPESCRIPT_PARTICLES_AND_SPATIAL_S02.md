# CF-S02-TS-001 — Partículas y consultas espaciales 3D

**Gate autorizado:** `CENTURY-FLUIDS-S02-G001-INTEGRAL-PARTICLES-AND-SPATIAL-QUERIES`, 2026-11-19. **Estado:** implementación entregada, QA local de usuario pendiente.

## Alcance realmente implementado

- Un estado de partículas por `FluidWorld`, con buffers densos SoA `Float64Array` para `positionsXYZ`, `velocitiesXYZ`, `massesKg` e `ids`, sin objetos por partícula almacenados internamente.
- Identificadores enteros seguros, crecientes y **no reutilizados**, independientes de los índices densos. Se aplica swap-remove al borrar; el orden del snapshot **no** garantiza ser orden de inserción.
- Gestión de capacidad de reserva geométrica (duplicación hasta el límite) y límites explícitos: `maxParticles` por defecto 1.000.000, máximo configurado admitido 10.000.000, reserva inicial 64 (o menos si límite menor). No se asignan 1.000.000 de partículas por defecto.
- Alta, edición atómica validada, baja, eliminación de todas, consulta de ID y snapshots. Los snapshots son **copias** de buffers: nunca exponen referencias al almacenamiento del mundo. El objeto contenedor es inmutable, no los TypedArrays entregados al consumidor.
- Índice uniforme espacial de 27 celdas vecinas, construido **bajo demanda** con tamaño de celda igual al radio de consulta; se recalcula cuando cambia la revisión de partículas o el radio. No es una segunda fuente de posiciones. Las salidas se ordenan por ID estable y se filtran por distancia euclídea inclusiva.
- Coordenadas, posiciones, velocidades y masas deben ser finitas; masas positivas. Radios finitos y estrictamente positivos. Si la cuadrícula no puede representar una escala/coordenada con índices enteros seguros se devuelve `OUT_OF_RANGE`, en lugar de truncar o devolver vecindades incorrectas.
- Se conserva la API S01 `FluidWorld(config)` y se añade opcionalmente `FluidWorld(config, limits)`; no hay una configuración oculta en el renderizador/Jolt.

## API pública S02

| Método/valor | Semántica |
| --- | --- |
| `FluidWorld(config?, limits?)` | Configuración S01 y límites opcionales `{initialCapacity?, maxParticles?}` |
| `particleCount` | Tamaño actual del mundo (sólo abierto) |
| `addParticle({position, velocity, massKg})` | Devuelve ID estable positivo |
| `getParticle(id)` / `hasParticle(id)` | Devuelve copia congelada con `Vec3` validados o presencia |
| `updateParticle(id, {position?, velocity?, massKg?})` | Valida todo antes de cambiar; error sin modificación parcial |
| `removeParticle(id)` / `clearParticles()` | Baja puntual o vaciado; nunca recicla ID |
| `particleSnapshot()` | Copia SoA orden denso; IDs y cuatro buffers independientes |
| `neighborsWithin(position, radiusMeters)` | IDs dentro de radio, incluye partícula ubicada en origen |
| `neighborsOf(id, radiusMeters)` | Como anterior, excluyendo el propio ID |
| `shutdown()` | Libera buffers/index, idempotente; posteriores consultas fallan con `CLOSED` |

Errores S02 agregados al contrato S01: `NOT_FOUND` y `CAPACITY_EXCEEDED`. La API exige objetos `Vec3` de esta biblioteca, no objetos host, para asegurar finitud y ownership.

## Compromisos de física y memoria

- **Esto NO es un solver de agua.** Ni `prepareStep` ni las consultas mueven partículas. Densidad, fuerzas, integración temporal, presión, emisores/sumideros y condiciones de contorno pertenecen a S03/S04.
- En S02 `updateParticle` modifica estado manualmente. En S03 el solver debe extender la autoridad de este mismo storage, sin replicar posiciones en otro buffer persistente y sin usar `getParticle` por cada par de partículas en el bucle crítico.
- El hash grid es derivado. Reconstruye en la primera consulta tras una mutación. Si un escenario requiere cambiar el radio por cada consulta, se incurre en reconstrucciones O(n); la estrategia óptima de radio fijado para S03 debe medirse cuando exista solver real.
- El índice de vecindad no retiene snapshots entregados al exterior. `clearParticles` conserva buffers para reuso; `shutdown` libera referencias a buffers.
- No hay importaciones de Century, Jolt, Three.js, WebGL, navegador ni WASM.

## Verificación

`npm run qa` ejecuta compilación/TypeScript estricto y `node --test tests/*.test.mjs`. `node tests/benchmark_particles.mjs` ejecuta el benchmark histórico no bloqueante de inserción, consultas indexadas y fuerza bruta. `python3 qa/verify_s02.py --project .` valida estructura, SHA, ledger y ejecuta QA sin exigir nombre fijo de carpeta. Las cifras de benchmark dependen del equipo y no constituyen un umbral de FPS. La comparación de vecindad contra fuerza bruta incluye distribuciones aleatorias deterministas, radios múltiples, eliminaciones y actualizaciones.

**Prerrequisito de S03:** las tolerancias del solver y la formulación de presión siguen sujetas al contrato numérico S00 no ratificado; ningún resultado de S02 acredita convergencia DFSPH.

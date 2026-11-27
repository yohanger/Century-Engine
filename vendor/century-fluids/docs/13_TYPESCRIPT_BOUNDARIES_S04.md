# CF-S04-TS-001 — Contornos sólidos 3D y contactos cinemáticos

**Gate autorizado y vigente:** `CENTURY-FLUIDS-S04-G001-INTEGRAL-FLUID-COLLISIONS-AND-BOUNDARIES`, 2026-11-19. El identificador de S04 planificado anteriormente (`...INTEGRAL-STATIC-DYNAMIC-BOUNDARIES`) fue sustituido por la declaración literal del usuario; **es el mismo Sprint S04 y su único Gate G001**, no un Gate adicional. S03-G001 aprobado por el usuario tras QA local 37/37.

## Autoridad de estado y límites

- `FluidWorld` conserva como única autoridad el `ParticleStore` de S02, el solver de S03 y una colección `BoundaryStore` pequeña y cohesionada; no se crean motores físicos paralelos, relojes, objetos Jolt ni renderizadores.
- Todos los datos del contorno se validan y copian al registrarlos. Los IDs de contorno crecen de manera monotónica, sobreviven a cambios de su geometría y no se reciclan. `boundarySnapshot()` es una vista desconectada/inmutable del almacenamiento. `updateBoundary()` sustituye una geometría completa de forma atómica. `shutdown()` libera las referencias.
- Tipos de geometría admitidos en S04: **plane** (semiespacio orientado hacia región permitida), **sphere** (sólido esférico), **box** (AABB con extents positivos) y **heightfield** (terreno bilineal finito con malla de muestras rectangular). Los heightfields no representan mallas triangulares arbitrarias ni superficies con voladizos. Las cajas aún no tienen orientación. No afirmar compatibilidad universal con shapes Jolt; S06 la auditará.
- Cada contorno tiene velocidad de traslación (m/s), restitución y fricción [0,1]. No se implementa rotación de collider ni cuerpos rígidos; se modela un sólido **cinemático prescrito**.

## Algoritmo de contacto

- En cada subpaso del solver existente, después de presión y viscosidad y antes del commit, el mismo frame temporal calcula posición tentativa `p + v·dt` y resuelve restricciones de no penetración contra geometría trasladada al tiempo final del subpaso.
- `particleContactRadiusMeters` es opcional en `LiquidSolverConfig.create`; valor por defecto `0.1 × supportRadiusMeters`, máximo `0.5 × supportRadiusMeters`. Representa exclusivamente el espesor de contacto de la partícula, no el radio de kernel. No cambia los datos de partículas S02.
- Distancia firmada y normal hacia el líquido: plano, esfera, caja y terreno. Corrección de posición y velocidad **relativa a la velocidad del contorno**. Restitución normal y amortiguación tangencial (fricción) para contacto entrante; el parámetro de fricción no es un modelo de adhesión, fricción estática ni resistencia hidrodinámica detallada.
- Para trayectorias que atraviesan una esfera o caja en un subpaso se utiliza un contacto barrido (segmento vs esfera expandida o AABB expandida) antes de aceptar el destino. El barrido AABB es conservador en esquinas; el plano y heightfield emplean proyección de contacto al final del subpaso. En terreno con footprint finito no se exige colisión fuera de sus muestras.
- Se calculan impulsos de reacción sobre el sólido como negativo del cambio de momento **por respuesta de contacto de velocidades**. No incluyen fuerzas debidas exclusivamente a corrección de posición ni presión hidrodinámica distribuida; el adaptador bidireccional Jolt S06 deberá validar el contrato de fuerzas, integración temporal, ownership y consistencia física antes de utilizar esas cantidades como fuerzas definitivas.
- `LiquidStepResult.boundaryContacts`, `maximumBoundaryPenetrationMeters` y `boundaryReactions` son telemetría por paso. Los contactos cuentan eventos (puede haber varios para el mismo par); las reacciones expresan impulso en N·s, no fuerza en newtons. El máximo de penetración se calcula **después** de resolver; se rechaza el paso si supera `1e-6 m` en los casos admitidos. Esta cota es un mecanismo local, no una garantía de precisión física para cualquier topología.
- El paso predice todas las traslaciones y valida finitud antes de empezar. La simulación trabaja en snapshots. Si presión, CFL, geometría, contornos incompatibles o finitud fallan, no se publican ni partículas ni posiciones de contornos. El mundo nunca actualiza Jolt ni consume RAF propio.

## API S04

| API | Contrato |
| --- | --- |
| `FluidWorld.addBoundary(input): id` | Registra geometría validada, ID estable |
| `getBoundary(id)` / `boundarySnapshot()` | Datos inmutables/detached |
| `updateBoundary(id, replacement)` | Reemplazo íntegro/atómico, mismo ID |
| `removeBoundary(id)` / `clearBoundaries()` | Retirada sin reutilización de IDs |
| `FluidWorld.boundaryCount` | Cantidad registrada |
| `FluidWorld.step(dt)` | Advierte/resulta ante penetración, contabiliza contactos, integra poses kinemáticas, commit atómico |
| `LiquidSolverConfig.particleContactRadiusMeters` | Configuración explícita del radio de contacto |

## Evidencia, alcance y límites de aceptación

`tests/boundaries.test.mjs` comprueba gestión/validación/ownership, semiespacio, fricción/restitución, contorno inclinado y móvil, esfera, caja, barrido continuo, heightfield bilineal, rollback CFL/overflow, tanque de seis paredes, conservación de masa y shutdown, sin alterar pruebas S01–S03. `tests/benchmark_boundaries.mjs` mide **216 partículas, 6 planos, 8 pasos a 120 Hz**, sin renderizado; valida masa, contactos y penetración. No fija límites de FPS universales.

**Limitación importante medida en el benchmark:** el estado final del tanque puede reportar `convergence: iteration_limit` por divergencia evaluada después de la resolución de contornos, pese a conservar masa y resolver penetración. Las reacciones de contacto por velocidad **no son aún un acoplamiento de presión sólido-fluido completo**; no se debe afirmar hidrostática/calibración experimental o interacción Jolt resuelta. Son límites explícitos de S03/S04 a validar en la estabilización física S09, no resultados aprobados silenciosamente. Los objetivos numéricos globales CF-PHYS-ACC-001 todavía no están ratificados por el usuario.

**QA:** `npm ci` seguido de `python3 qa/verify_s04.py --project .`; el runner no verifica el nombre de carpeta. ESM/TypeScript siguen sin dependencias runtime de Century, Three.js o Jolt. S08 Century permanece EN PAUSA y playground de agua corresponde a S09.

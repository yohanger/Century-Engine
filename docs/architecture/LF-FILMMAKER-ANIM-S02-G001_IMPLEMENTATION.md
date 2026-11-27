# LevelForge — LF-FILMMAKER-ANIM-S02-G001 · Physics Bake

**Fecha:** 2026-10-29  
**Estado:** autorizado e implementado; **NO CERRADO**, QA Jolt WASM y Electron pendientes.

## Contrato técnico

Se extiende Nether Film Maker sobre el SOURCE_BASELINE de `LF-FILMMAKER-ANIM-S01-G002`, aprobado por el usuario. LevelForge es un **editor basado en nodos**, no ECS. Se preservan SceneGraph, Event Order Flow, VFX3D, controles de grabación y pistas del montaje existentes.

### Simulación aislada

`physics-bake.js` crea nodos proxy `THREE.Group` con la jerarquía y los Transform de los nodos persistidos y los usa en un mundo `JoltWorld` temporal. El plan físico es el **mismo** `physicsNodePlan` y `NodeBodyRuntime` empleado por el Player, limitado aquí a `RigidBody3D`, `StaticBody3D` y sus `CollisionShape3D`. No se instancian escenas, scripts, eventos ni un segundo motor físico. Los nodos originales, sus datos persistidos y su historial de edición no se manipulan durante la simulación.

Se avanza a **60 Hz** constantes y se capturan muestras de posición local `[x,y,z]` y rotación quaternion `[x,y,z,w]`, incluida la pose inicial. Se respetan jerarquías mediante transformaciones mundo→local. Se limitan las tomas a **30 segundos y 16 cuerpos dinámicos** y se permite cancelar; los recursos Jolt del mundo temporal se liberan al terminar o fallar. Los callbacks de progreso solo informan al usuario.

**Limitación explícita de S02-G001:** solo participan las colisiones físicas de nodos `RigidBody3D`/`StaticBody3D` con `CollisionShape3D` válida. Terreno, mallas decorativas, sistemas de Gameplay Object, sensores y colisionadores de eventos **no se agregan automáticamente** a este mundo de bake. La UI no debe prometer colisión con ellos.

### Persistencia y compatibilidad

El formato `.nfm` pasa a **versión 4**. Las películas v1/v2/v3 se normalizan con `physicsBakes: []` si no contienen simulaciones; las versiones futuras desconocidas se rechazan. `film.edit.physicsBakes` mantiene un solo bake activo en este primer Gate, con `nodeId`, intervalo absoluto `start`, `duration`, `hz:60`, firma de colisiones y `bodies[].samples[]`. Se validan estructura, cantidades, números finitos e IDs sin duplicar. No se materializa ni añade al proyecto ningún objeto de demostración.

La firma incluye Transform, visibilidad, jerarquía y parámetros de cuerpos y formas, para detectar cuándo se debe **rehornear**. Renombrar un nodo o cambiar un material decorativo no invalida el resultado.

### Autoría y reproducción

En Filmmaker, **Animar → Física → Simular** ejecuta un bake temporal no persistido. **Hornear** confirma el resultado como una operación del historial independiente de película; **Quitar bake** y Undo/Redo restauran tomas anteriores. Una pista contextual identificada «Física» indica la duración y el número de cuerpos. El Inspector muestra el estado válido o desactualizado.

`FilmPhysicsPose` aplica muestras **solo a objetos Three.js** durante previsualización y playback. El `seek` evalúa el tiempo absoluto, incluida la dirección inversa, e interpola quaterniones mediante SLERP; no solicita un `world.step` al recorrer el timeline. El overlay restaura la pose original al detener o cambiar de modo. Durante reproducción de un bake válido, se retiran del conjunto dinámico Jolt del Player los cuerpos horneados para impedir **doble escritura del Transform**. El resto de los cuerpos continúa bajo Jolt. Cuando un bake está desactualizado, no se impone su Transform.

La importación a la cinemática de gameplay de una película que contenga `physicsBakes` se rechaza explícitamente antes de perder sus datos: la conversión final pertenece a `LF-FILMMAKER-ANIM-S02-G002`.

### Archivos del cambio

- `src/filmmaker/physics-data.js` (nuevo): límites, firma e invariantes del esquema.
- `src/filmmaker/physics-bake.js` (nuevo): simulación Jolt temporal y muestreo reversible.
- `src/filmmaker/{film.js,montage.js,session.js,node-authoring.js,NleTimeline.vue}`: integración persistencia/autoría/player.
- `src/core/state/film.js`: barrera contra importación con pérdida de datos.
- `scripts/test-filmmaker-anim-s02-g001*.mjs`: pruebas nuevas; test históricos versionados a NFM v4.
- `docs/qa/LevelForge_DB_Ledger.xlsx`: seis hojas conciliadas; sin borrar filas del baseline.

### Exclusiones

No implementar destrucción, fractura de malla, fluidos, VFX, colisión automática de terreno, simulación de gameplay con scripts, exportación de bakes a Timeline del juego, ni reproducción de música. No cambiar el modelo de nodos ni Event Order Flow.

### Validación pendiente

La regresión ampliada alcanzó **212 PASS, 0 FAIL, 1 SKIP** (el omitido requiere Three.js instalado). Las pruebas `Node` y con dobles de Jolt verifican integración y algoritmos, **no** sustituyen una prueba real de Jolt WASM con cuerpos físicos ni un build/QA gráfico en Electron. Consultar `docs/qa/LF-FILMMAKER-ANIM-S02-G001_QA.md`. No marcar el Gate CERRADO hasta la verificación local y aprobación expresa del usuario.

# LF-NODE-PHYSICS-RUNTIME-S03-G001 — Contrato de integración física

**Estado:** IMPLEMENTADO; pruebas automatizadas PASS; **Jolt WASM real, Vite, Electron y Player exportado: NO VERIFICADOS**. Aprobación del usuario pendiente.
**Baseline de entrada:** `LevelForge_NODE_PHYSICS_S02_G001_SOURCE_BASELINE.zip` (920 archivos; verificado íntegro).
**Autorización:** `Listo. LF-NODE-PHYSICS-RUNTIME-S03-G001 autoriza comenzar`, 2026-10-28.

## Regla arquitectónica

LevelForge sigue utilizando NodeRegistry, SceneGraph y un único JoltWorld creado por PlayMode. **Las primitivas no crean cuerpos**. StaticBody3D/RigidBody3D son propietarios de la configuración física y sus hijos CollisionShape3D proporcionan las formas y poses locales. No hay ECS, un segundo mundo, ni otro ciclo fijo.

## Flujo de creación

1. PlayMode `_setupScene()` crea el mismo JoltWorld existente y el terreno, y mantiene la inicialización especializada de Gameplay Objects, páginas de eventos y sensores.
2. `_bodiesInit()` crea `NodeBodyRuntime` y consulta `physicsNodePlan(project.objects)`; el plan valida el árbol S02 y descarta cuerpos ocultos o sin formas habilitadas.
3. Cada `StaticBody3D` genera un único cuerpo estático mediante `JoltWorld._body`, con fricción y restitución del nodo.
4. Cada `RigidBody3D` genera un único cuerpo dinámico en `BodySet.add`, utilizando la masa, gravedad, amortiguación, sueño y superficie del nodo. Se conserva la sincronización existente `_bodiesTick` y su manejador `game.physics`.
5. Formas Box/Sphere/Capsule se obtienen de caché por dimensión, nunca de la malla visual. Formas locales desplazadas/rotadas se componen mediante `RotatedTranslatedShapeSettings`; varias formas usan `StaticCompoundShapeSettings` en un único cuerpo. La cápsula de altura exactamente igual al diámetro equivale a esfera.
6. Las geometrías visuales descendientes siguen el transform del cuerpo dinámico y no generan Jolt MeshShapes adicionales. Los nodos físicos sin forma válida no generan colisión ficticia y producen advertencia explícita.
7. Las formas editoriales S02 siguen invisibles en reproducción; no se representan como recursos de juego.

## Sincronización y liberación

- `NodeBodyRuntime` no crea otro mundo; posee únicamente el registro de handles estáticos de la escena.
- `JoltWorld.nodeHandles` identifica cuerpos estáticos explícitos y `rigidNodes` enlaza los dinámicos con `BodySet`.
- `JoltWorld.syncNode`, `makeKinematic` y `setNodeEnabled` reconocen cuerpos estáticos del árbol. Un teletransporte de script sobre un RigidBody3D utiliza BodySet.teleport; la simulación actualiza el transform visual en `_bodiesTick`.
- Al detener PlayMode o cambiar de escena se eliminan primero los handles del adaptador y, después, `JoltWorld.dispose()` libera cuerpos, formas cacheadas y WASM. La retirada de un cuerpo dinámico elimina su vínculo.
- Las superficies visuales asociadas a cuerpos se registran únicamente como objetivos de rayos de respaldo/material de pasos; **no generan MeshShapes Jolt**.

## Excepción contractual de eventos

Cambios autorizados exclusivamente en `src/engine/runtime/events/play.js` y `src/engine/runtime/events/play-bodies.js` para sustituir la creación física y enlazar el adaptador. `play-controls.js` y los 47 módulos restantes protegidos deben mantenerse byte a byte. Las páginas, comandos, señales, intérprete y `_simStep` **no cambian**. Event/Database conservan sus físicas especializadas y `game.physics` opera sobre cuerpos dinámicos explícitos.

## Eliminación de física visual heredada

`makeObject` deja de asignar `collision: true` a primitivas nuevas. El Inspector elimina los controles de `dynamic`, `floats`, `bodyMass`, `bodyOffset`, `bodyExtension` y `collision` de primitivas/mallas/modelos. Los recursos de formas físicas S02 permanecen como único medio autoral de colisión de geometría visual. No se desarrollan migradores de escenas antiguas.

**Pendiente fuera de este Gate:** `CharacterBody3D` y `Area3D` (S04); script por nodo (S05); remodelación integral del Inspector/árbol (S06); limpieza de consumidores de física heredada en exportaciones alternativas, navegación, herramientas/editor y rutas de Database (S07). El Player propio reutiliza PlayMode, pero requiere QA con dependencias reales.

## Pruebas y límites

- `scripts/test-node-physics-runtime-s03-g001.mjs`: 31 PASS (plan puro, adaptador con dobles de Three/Jolt, garantías de cableado y protecciones).
- Regresión seleccionada de 100 suites: 2.153 PASS / 0 FAIL / 19 SKIP. Excluye familias starcat y clouds, según antecedentes del baseline.
- La ausencia de `node_modules` y el error `EAI_AGAIN` al consultar npm impiden verificar los binarios reales, Jolt WASM y Vite. Los tests con dobles no se presentan como QA físico real.
- Las pruebas de aceptación que faltan incluyen caída real sobre suelo, raycast exacto, rotación/desplazamiento de formas compuestas, cambio de escena, ocultación, pausar/reanudar, rendimiento y ejecución tanto en Electron como en Player exportado.

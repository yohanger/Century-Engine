# LF-NODE-ARCH-AUDIT-S00-G001 — Plan de sprints y Gates

**Estado:** PLANIFICADO, NO AUTORIZADO (excepto S00). Identificadores S01-S07 sujetos a ratificación tras QA de S00.

| Sprint / Gate | Objetivo permitido | Dependencias verificables | Fuera de alcance | Evidencia de aceptación |
|---|---|---|---|---|
| S00 `LF-NODE-ARCH-AUDIT-S00-G001` | Documentar código real; contrato Godot-like; QA y ledger | Baseline limpio verificado; autorización S00 | Código producción | Docs y seis hojas; 0 cambios de producción; QA Node histórico |
| S01 `LF-NODE-CORE-S01-G001` | Extender NodeRegistry, árbol actual, Node/Node3D, lifecycle | Contrato S00 aprobado; `core/state/tree.js`, `scene/objects.js`, `nodes/three-helpers.js` | Física, scripts de nodo, cambio Event Flow | Root y parenting, transform, Undo/Redo, SceneGraph/Player, no árbol duplicado |
| S02 `LF-NODE-PHYSICS-S02-G001` | Definir StaticBody3D, RigidBody3D, CollisionShape3D y shapes de recurso usando Jolt existente | S01; parent/shape válido; `physics/jolt.js`, `physics/bodies.js`, `physics/collider-shape.js` | Extraer PlayMode y borrar legacy todavía | Crear/eliminar, shapes múltiples, escala, material físico, no colisión implícita |
| S03 `LF-NODE-PHYSICS-RUNTIME-S03-G001` | Hacer que Physics Runtime consuma nodos físicos, sustituir creación por tipo visual | S02; caracterización `_bodiesTick`, `_setupScene`, `game.physics`, agua, eventos; autorización específica de cambios integración en `events/` | Cambiar páginas/comandos/señales/Event Order Flow | Jolt real Editor/Player, orden fijo, sin doble collider; eventos idénticos funcionalmente |
| S04 `LF-NODE-CHARACTER-AREA-S04-G001` | CharacterBody3D, Area3D, sensores | S03; reuse `jolt-character.js` y `jolt-sensors.js` | Gameplay/AI nuevos | Movimiento, colisiones, overlap enter/exit, pausa y scene switch |
| S05 `LF-NODE-SCRIPT-S05-G001` | Recurso Script opcional por nodo, callbacks lifecycle desde S01 | S01 y runtime estable; `Game.loadScripts` global conocido | Sustituir script global/Event Pages | Scripts de varios tipos, sin doble `update`, limpieza, excepción aislada, Player |
| S06 `LF-NODE-EDITOR-S06-G001` | Scene Tree, Inspector y plantillas de nodos estilo Godot | S01-S05; Store, Inspector, Undo/Redo | Rediseño IA y duplicar paneles | Selección, reparent, validación, propiedades sin contaminación, scripts/shape, DPI |
| S07 `LF-NODE-QA-S07-G001` | Eliminar rutas obsoletas y validar integración integral | S01-S06 aprobados; escenas nuevas sin legacy | Migradores de escenas antiguas | Editor + Player + export; Jolt, eventos, scripts, materiales, CSG, Geometry y regresión |

### Política de ejecución

1. Cada Gate requiere un mensaje posterior con `Listo. [ID] autoriza comenzar`. S00 no autoriza S01.
2. Cada Gate debe comenzar desde el último SOURCE_BASELINE **entregado** por este asistente y confirmado vigente por el usuario; no aplicar ZIP anteriores ECS.
3. EXACTAMENTE dos ZIP por implementación: CHANGE (solo diferencias) y SOURCE_BASELINE (proyecto completo), sin SHA-256 ni scripts .sh.
4. La extracción física debe evitar doble administración de Jolt y preservar todos los consumidores de la nueva representación, **sin hacer migradores heredados**.
5. Cualquier necesidad de editar módulos `events/` debe declararse explícitamente en el Gate y acotarse a coordinación física; el usuario retiene control de autorizarlo.
6. Compilar, Node tests, QA visual y QA exportado son estados distintos. No marcar APROBADO hasta evidencia del usuario.

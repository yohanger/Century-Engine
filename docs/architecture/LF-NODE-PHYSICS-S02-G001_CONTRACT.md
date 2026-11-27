# LF-NODE-PHYSICS-S02-G001 — Contrato de nodos físicos de autoría

**Fecha:** 2026-10-28  
**Base:** LF-NODE-CORE-S01-G001, aprobado por el usuario.  
**Gate:** autorizado el 2026-10-28; implementación preparada para QA local.  
**Paradigma:** SceneGraph + NodeRegistry existentes, sin ECS.

## 1. Problema delimitado

LevelForge conserva por ahora `collision`, `dynamic` y otras propiedades físicas dentro de los objetos visuales y de PlayMode. **S02 no retira esa ruta**: añadir un segundo runtime físico sería un defecto. S02 introduce únicamente los tipos de nodo, sus datos serializables, validaciones y representación editorial. La sustitución de la ruta anterior corresponde a `LF-NODE-PHYSICS-RUNTIME-S03-G001`, con autorización específica para los puntos de integración de `events/`.

No existe obligación de migrar escenas antiguas. La prioridad es la arquitectura definitiva para escenas nuevas.

## 2. Responsabilidades

| Tipo | Rol | Datos propios | Exclusiones |
|---|---|---|---|
| StaticBody3D (`staticbody3d`) | Cuerpo estático futuro | Rozamiento, rebote, pose local | Malla, UV, shader, creación Jolt en S02 |
| RigidBody3D (`rigidbody3d`) | Cuerpo dinámico futuro | Masa, escala de gravedad, damping lineal/angular, sleep, rozamiento, rebote | Geometría visual, ejecución de comandos Event |
| CollisionShape3D (`collisionshape3d`) | Define una forma del cuerpo | `props.shape`, `props.disabled`, posición/rotación locales | Masa, física dinámica, render de juego |
| BoxShape3D | Recurso plano y serializable | `type`, `size: [x,y,z]` en metros | Nodo separado, malla física Jolt ejecutada |
| SphereShape3D | Recurso plano y serializable | `type`, `radius` | Idem |
| CapsuleShape3D | Recurso plano y serializable | `type`, `radius`, `height` TOTAL (incluye tapas) | Idem |

El recurso Shape3D es un valor serializable propio de `CollisionShape3D` y se crea de manera independiente para cada nuevo nodo. **No implementamos un segundo repositorio de recursos compartidos** en S02; eso evita alias y destrucción accidental en esta fase.

## 3. Autoría y parentesco

- `CollisionShape3D` **debe ser hija directa** de `StaticBody3D` o `RigidBody3D`. Soportamos múltiples formas por cuerpo.
- Padres inválidos y ciclos son rechazados antes de cambiar `project.objects`. La función común es `validateNodeTree()` / `validateNodeParent()`.
- `CollisionShape3D` se añade mediante «Añadir → Física», con un cuerpo físico seleccionado. Se crea a su origen local (posición y rotación cero).
- Se rechazan escalas propias distintas de `(1,1,1)` y escalas heredadas del árbol Node3D sobre un cuerpo o forma física. Dimensiones se editan en el recurso, no escalando el nodo.
- Box: dimensiones estrictamente positivas y finitas; Sphere: radio válido; Capsule: altura total mayor o igual a dos radios. Valores inválidos no se corrigen silenciosamente.
- No se generan cuerpos Jolt desde los nuevos nodos en S02. Si un cuerpo no tiene CollisionShape3D, sigue siendo un nodo de autoría sin geometría de colisión.

### Ejemplo de escena nueva

```text
Level (Node3D)
└── Pared (StaticBody3D)
    ├── MeshInstance3D / Primitiva visual (futuro contrato)
    └── CollisionShape3D [BoxShape3D] size: [4, 2.8, 0.25]
```

`MeshInstance3D` no forma parte del alcance del Gate S02: las mallas y primitivas existentes siguen siendo los recursos visuales. S03 hará que los nuevos PhysicsBody3D y sus shapes representen la **única** ruta activa de colisiones del runtime.

## 4. Integración en el editor existente

- `nodes/index.js` registra los tipos en el NodeRegistry existente; `makeObject` no añade automáticamente `collision`, `castShadow` ni parámetros PBR a estos nodos.
- `core/commands.js` añade los tipos al catálogo existente; `CollisionShape3D` no utiliza la herramienta de colocación libre en el mundo.
- `Inspector.vue` expone únicamente los datos del cuerpo o de la forma, además de Transform (sin gizmo de escala).
- `core/state/objects.js` valida creación y edición antes de escribir; `core/state/tree.js` ya reutiliza `validateNodeParent` del núcleo S01.
- La previsualización del body y de la shape es ayuda editorial, solo visible cuando está seleccionada, no representación de juego; las geometrías propias se liberan al reemplazar, eliminar o descargar la escena.
- La serialización y Undo/Redo existentes registran estas propiedades como datos puros de `project.objects`; no se agrega otro estado de escenas.

## 5. Invariantes del runtime y protección de eventos

**Los 49 archivos protegidos bajo `events/` y componentes de eventos deben conservarse idénticos al baseline de S01.** No modificar Event Order Flow, el intérprete, las páginas, los comandos ni las señales. Play Editor y Player exportado siguen compartiendo PlayMode actual. Jolt real, la eliminación de `o.collision` y la retirada de `props.dynamic` de los nodos visuales quedan para S03; las primitivas antiguas siguen usando su configuración física legacy hasta reemplazar los consumidores de producción.

No se declara compatible con escenas legacy ni se desarrollan migradores.

## 6. Exclusiones

- S03: creación, simulación y sincronización de cuerpos Jolt; físico en Player exportado; retiro de rutas legacy y actualización de consumidores.
- S04: CharacterBody3D y Area3D.
- S05: recurso Script asociado a un nodo.
- S06: refactor de la UI global, escenas reutilizables y herramientas de creación avanzadas.
- S07: QA integral, limpieza, validación real de distribución.

**Condición para cerrar S02:** tests de contrato, regresión relevante y QA local de creación, parenting, edición, selección, undo/redo y persistencia. La ejecución real de cuerpos Jolt NO es criterio de S02.

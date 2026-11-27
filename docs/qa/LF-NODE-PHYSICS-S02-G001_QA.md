# LF-NODE-PHYSICS-S02-G001 — QA y entrega

**Fecha:** 2026-10-28  
**Gate:** autorizado; implementación en espera de QA local y aprobación del usuario.  
**SOURCE_BASELINE de entrada:** `LevelForge_NODE_CORE_S01_G001_SOURCE_BASELINE.zip` (915 entradas).  

## 1. Evidencia automatizada

```
node --test scripts/test-node-physics-s02-g001.mjs scripts/test-node-core-s01-g001.mjs
```

Resultado de fase inicial: **85 PASS / 0 FAIL / 1 SKIP** (S02: 42 PASS + 1 SKIP; S01: 43 PASS).

```
files=$(find scripts -maxdepth 1 -name 'test-*.mjs' \
  ! -name 'test-starcat*' ! -name 'test-clouds*' | sort)
node --test $files
```

Regresión ampliada: **2122 PASS / 0 FAIL / 19 SKIP** en 99 archivos de test. Archivos de starcat y clouds excluidos expresamente por requerimientos independientes del entorno. Uno de los 19 SKIP es la prueba opcional con Three.js real; los otros 18 pertenecen a la base histórica.

La prueba `scripts/test-node-physics-s02-g001.mjs` cubre constructor de recursos, límites, tipos, parentesco, shapes múltiples, mutación atómica, escala, estado de autoría, integración estática del Inspector/comandos y protección de eventos.

**NO VERIFICADO:** `npm run build` (sin `node_modules`), ejecución de Electron, editor visual, render real de Three.js, simulación Jolt y Player exportado. Las pruebas estáticas no demuestran QA visual.

## 2. QA local del usuario (pendiente)

1. Añadir `StaticBody3D` y `RigidBody3D` desde menú **Añadir → Física**. Verificar que se ven en el Scene Tree, se pueden seleccionar y el Inspector muestra sus parámetros propios.
2. Seleccionar un `StaticBody3D`, usar **Añadir → Física → BoxShape3D**. Verificar que se crea `CollisionShape3D` como **hijo directo** del body, en posición local cero.
3. Añadir una segunda forma SphereShape3D y cambiarla a CapsuleShape3D. Editar radio, altura, posición y rotación; comprobar línea de vista previa solo durante selección.
4. Intentar añadir una forma a raíz o bajo Mesh/Node3D, y mover la forma por drag-and-drop a un padre incompatible: debe ser rechazado sin cambiar la jerarquía.
5. Crear un body debajo de Node3D escalado y escalar su antecesor con body/shape descendientes: el sistema debe rechazar escalas incompatibles.
6. Modificar masa, rozamiento, rebote, gravedad y damping; comprobar Undo/Redo. Cambiar formas y sus dimensiones, luego guardar, cerrar y reabrir el proyecto.
7. Duplicar un body con dos formas y verificar que la copia no comparte por referencia los datos editables de las shapes.
8. Confirmar que los nodos físicos no ejecutan simulación Jolt todavía y que las ayudas de autoría no aparecen como geometría de juego.
9. Verificar que primitivas, Editor, eventos y PlayMode anteriores siguen funcionando (ruta legacy activa hasta S03).

## 3. Bloqueos explícitos

- No eliminar todavía `collision`, `props.dynamic`, `bodyMass` o `bodyShape`: sus consumidores siguen operando y son alcance de S03.
- Los puntos de integración física en `events/play.js` / `events/play-bodies.js` solo podrán tocarse en un Gate explícito. **S02 prohíbe modificar esos archivos**.
- No afirmar que Jolt / Player manejan los nuevos nodos hasta completar S03 con QA real.

## 4. Integridad del paquete

Comparar los ZIP contra la entrada S01 y confirmar: solo archivos pertinentes al Gate; 49 archivos de eventos idénticos; sin módulos ECS, dependencias, `node_modules` ni builds. Estado de QA local: **PENDIENTE**.

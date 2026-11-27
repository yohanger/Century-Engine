# LevelForge — LF-CSG-SUBTRACT-NODE-CORR-G001 · QA

**Autorización:** `Listo. LF-CSG-SUBTRACT-NODE-CORR-G001 autoriza comenzar` — 2026-10-27.

**Estado:** IMPLEMENTADO · NODE TEST PASS · BUILD/EDITOR/PLAYER NO VERIFICADOS · APROBACIÓN PENDIENTE.

## Baseline y alcance

Fuente: `LevelForge_CSG_SUBTRACT_CORR_G001_SOURCE_BASELINE.zip`, íntegro, 883 archivos. Se conserva el FOV horizontal único de Jugador y los sprints de Mesh Editing, instancias vinculadas, materiales y Shader Graph. Queda fuera de este Gate la persistencia de cámara de Editor.

## Arquitectura aplicada

- **Substract** es un tipo de nodo independiente (`type: 'subtract'`), creado mediante el catálogo genérico de NodeDefs. Su Inspector selecciona caja, cilindro o escalera. No tiene material editable ni colisión propia. El volumen editorial es translúcido y seleccionable. No se utiliza una primitiva con `props.csg`.
- El cálculo Boolean BSP existente continúa en `geometry/csg.js`; `isCutter` identifica **solo** nodos `subtract`. Se recortan primitivas y mallas cerradas con la ruta `scene/brushes.js`.
- Se preservan por clonación/interpolación los atributos geométricos `lfBlockUV`, `lfBlockSize`, `lfPaintUV`, `lfColor`, `lfWeights0`, `lfWeights1` y `color` del **sólido receptor**. El resultado mantiene `position`, `normal` y `uv`.
- Las caras **nuevas** del hueco usan el **mismo objeto material** que la superficie del receptor, no el color ni el material del Substract. Si el receptor usa Blockout, esas caras reciben atributos métricos calculados en su plano. Si usa Vertex Paint, obtienen atributos de pintura válidos con la primera capa como valor inicial neutro; el color de vértice de caras nuevas se inicializa blanco neutro.
- Las caras originales del receptor conservan el UV/Blockout/pintura interpolados; los nuevos cortes no pueden inventar la pintura artística que no existía antes sobre esas superficies.
- El estado recortado se recalcula al mover o cambiar el Substract; eliminarlo restaura la geometría original. Las caras nuevas comparten material, de modo que la limpieza de la geometría **no dispone el material del muro**.
- El antiguo `primitive + props.csg='subtract'` se convierte unidireccionalmente a `type='subtract'` durante `migrateScene()`; el motor de escenas solamente reconoce el nodo nuevo. No se mantienen dos modos CSG paralelos.
- Player continúa excluyendo de dibujo y colisiones el nodo que satisface `isCutter()`, mientras que el receptor conserva sus superficies recortadas para la construcción de colisiones.

## Pruebas ejecutadas

| Comprobación | Resultado |
|---|---|
| `node --test scripts/test-csg-subtract-node-corr-g001.mjs` | **20 PASS / 0 FAIL** |
| `node --test scripts/test-csg-subtract-corr-g001.mjs` (harness actualizado al nuevo contrato) | **20 PASS / 0 FAIL** |
| Regresión Node global disponible, sin `test-starcat.mjs` | **1978 PASS / 0 FAIL / 18 SKIP** |
| `npm run build` | **NO VERIFICADO**: `vite: not found` (código de salida 127) |
| Editor Electron, Player con Three.js y Jolt, export ejecutado | **NO VERIFICADO** |

Las pruebas geométricas ejercitan las funciones BSP de producción bajo clases matemáticas equivalentes de un fixture Node. Verifican conservación y finitud de atributos, superficies nuevas, material receptor, ausencia de `dispose()` sobre el material del muro, eliminación/restauración, doble corte, migración y hooks de sincronización. **No sustituyen una renderización GPU ni una prueba de física Jolt real.**

## QA manual obligatorio (usuario)

1. En Editor, abrir el catálogo de Geometría y crear **Substract**, que debe aparecer en el árbol de escena con su tipo propio. El Inspector debe mostrar «Volumen: Caja / Cilindro / Escalera». En primitivas ya no debe existir el selector «Sustractivo».
2. Crear un muro mediante cubo primitivo con material/textura Blockout. Insertar el nodo Substract parcialmente en el muro. **La textura del muro debe continuar visible** en toda su superficie original y las paredes interiores deberán estar texturizadas con el material del muro.
3. Repetir sobre una malla editable cerrada con pintura UV, textura o pintura de vértices. Comprobar específicamente las superficies originales y la apariencia neutra de las caras nuevas.
4. Mover, rotar y escalar Substract. Comprobar que actualiza el hueco. Cambiar Caja → Cilindro → Escalera y volver a Caja.
5. Agregar dos nodos Substract sobre un muro. Confirmar que ambos abren huecos; eliminar uno y comprobar que el otro continúa funcionando.
6. Eliminar ambos nodos. El muro debe restaurar su geometría y textura exactas sin reconstruir el material original.
7. Guardar, cerrar y abrir proyecto. Repetir Undo/Redo de nodo, posición y tipo. Si hay una escena antigua con `props.csg`, debe migrarse una vez a `type='subtract'`.
8. Ejecutar Play/Player: el nodo Substract NO debe verse ni colisionar; el hueco debe permitir atravesarlo y el resto del muro debe bloquear al jugador. Comprobar exportación.
9. Verificar que Loop Cut, transformaciones numéricas, Mesh Instances, Shader Graph y FOV horizontal del jugador permanecen intactos.

## Límites y riesgos

El BSP se utiliza sobre sólidos cerrados; topologías abiertas/no manifold no están cubiertas. Las superficies nuevas requieren UV de autoría propias (los UV anteriores del cortador no representan una pintura hecha a mano en el receptor). La inspección visual, shader personalizado y físicas reales aún requieren QA local. No declarar estos puntos PASS a partir de tests Node.

## Integridad

Se tocaron únicamente registro de nodos, nuevo `subtract`, catálogo y Inspector, BSP y refresco de brushes, serialización/migración y test/QA/ledger. No se cambió el sistema de cámaras, Shader Graph, FOV, render PBR ni el motor Jolt.

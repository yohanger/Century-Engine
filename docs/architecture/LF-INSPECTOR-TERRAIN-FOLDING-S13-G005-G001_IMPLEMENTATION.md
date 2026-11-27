# LevelForge — S13-G005-G001 · Plegado del Inspector de Terreno

**Gate:** `LF-INSPECTOR-TERRAIN-FOLDING-S13-G005-G001`  
**Fecha:** 2026-11-08 · **Estado:** IMPLEMENTADO / NODE PASS / ELECTRON NO VERIFICADO / QA LOCAL PENDIENTE.

## Autoridades y alcance

Base acumulada: `LF_INSPECTOR_NODE_SPACING_S13_G011_G001_SOURCE_BASELINE.zip`. Contrato vinculante UX-01 a UX-08, aprobado por el usuario. La infraestructura de plegado de S13-G002 y su CORR-001 está aprobada. La limpieza de párrafos, listas, scroll y espaciado corresponde a G005-G002: **no se implementa aquí**.

### Observado antes del cambio

- `TerrainPanel.vue` era el Inspector contextual **único** del nodo `terrain` montado desde `Inspector.vue`. Existían siete `<section>` con encabezado `<h4>`; estos no eran reconocidos por el delegado `InspectorDock.vue` (`.sect > header`).
- `InspectorDock.vue` ya determina el contexto semántico con `.insp[data-node-type]` y guarda las preferencias en `store.prefs.inspFold`.
- El encabezado Vegetación tenía un botón de ojo que modifica `store.view.foliage` sin cambiar el proyecto; debía conservar su propia acción.
- `Terrain Generator` y Tamaño contienen avisos sobre costa heredada y resoluciones costosas. Contraer sus apartados no puede ocultar totalmente la condición de riesgo.

## Implementación

Se modificó **solo `src/components/TerrainPanel.vue` en producción**. Cada apartado adopta `.sect.terrain-sect > header + .body`, con ID estable:

| Apartado | `data-fold-id` |
|---|---|
| Piezas de terreno | `terrain-pieces` |
| Agua física | `terrain-water` |
| Pincel | `terrain-brush` |
| Capas de pintura | `terrain-layers` |
| Vegetación | `terrain-foliage` |
| Terrain Generator | `terrain-generator` |
| Tamaño | `terrain-size` |

El delegado existente forma las claves `fold:node:terrain:terrain-*` y expone `role=button`, `tabindex=0`, `aria-expanded`, clic, Enter y Espacio. No se introduce `ref` de plegado, persistencia paralela, servicio global ni migración de objetos.

Los siete apartados mantienen su contenido original en `.body`. El ojo Vegetación sigue en el encabezado y usa propagación detenida para no activar el plegado. El encabezado del Generador muestra «Costa heredada» si corresponde, y Tamaño indica «Resolución alta» con más de 512 segmentos; los avisos detallados **siguen en los cuerpos**. Los apartados inician abiertos por defecto, salvo preferencia preexistente. Las clases `.sect` aprovechan el estilo compartido; el componente solo ajusta padding y disposición de encabezados/cuerpos.

## Preservación

Sin modificaciones a `InspectorDock.vue`, `Inspector.vue`, `store.js`, Terrain, Jolt, Gizmo, Player, Preview, Editor, hidrólisis, vegetación runtime, generador, límites de datos, ni preferencias de tooltips. Se conserva la selección `selectedId`/pieza y la única fuente de datos de Terrain.

Se adaptó únicamente la expectativa literal de `TER-INSP-12` en `scripts/test-terrain-inspector-context-s04a-g001.mjs`: antes exigía `<h4>Piezas de terreno`; ahora exige el encabezado semántico del **mismo** `TerrainPanel`. No se eliminó ninguna comprobación histórica.

## QA y límites

- Nuevo test `scripts/test-inspector-terrain-folding-s13-g005-g001.mjs`: **17 PASS / 0 FAIL**.
- Regresión Terrain/Inspector/plegado: **144 PASS / 1 SKIP / 0 FAIL**.
- Regresión cruzada Escena/Primitivas/Terrain: **83 PASS / 1 SKIP / 0 FAIL**.
- Fixture Electron real: **37 verificaciones exigidas**; `scripts/test-inspector-terrain-folding-s13-g005-g001-electron.mjs`.
- Electron y build no ejecutables en entorno de preparación porque faltan dependencias instaladas (`vite`). **NO VERIFICADO**; el usuario ejecutará QA local.

**El Gate no está APROBADO/CERRADO hasta evidencia de QA local y aprobación del usuario.**

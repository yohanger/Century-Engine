# LevelForge — LF-TERRAIN-NODE-S01-G001

**Autorización literal:** `Listo. LF-TERRAIN-NODE-S01-G001 autoriza comenzar`
**BASE:** `LevelForge_EDITOR_CAMERA_CONTINUOUS_OBJECTMODE_G001_SOURCE_BASELINE.zip`
**Estado:** IMPLEMENTADO · NODE PASS · QA Electron, build y QA usuario NO VERIFICADOS · NO CERRADO.

## Diagnóstico observado

`SceneTree.vue` representaba las piezas en un bloque `.terrow` por fuera del árbol virtualizado `.list`. La búsqueda, el contador, el teclado, el renombrado y las acciones propias de la lista de nodos no incluían Terrain. El estado de cada pieza vive en `Terrain`, con ID, nombre, posición X/Z, alturas, pintura, vegetación y flag `enabled` persistidos por `Terrain.serialize()`.

## Implementación S01

- Se proyectan las piezas de terreno reales como entradas `type: terrain` del árbol de jerarquía existente. No se crean duplicados en `project.objects` ni un renderer adicional. El árbol usa una misma lista virtualizada para objetos y piezas, con búsqueda y navegación.
- La selección conserva el `id` real de pieza y abre el Inspector Terreno existente; el resto de objetos conserva su selección normal.
- Renombrar (doble clic y F2), contextual, eliminar y mostrar/ocultar usan las operaciones de `state/terrain.js`, la instantánea Terrain y el historial `commitTerrain`. La visibilidad `Terrain.visible` se guarda y se restaura por Undo; es diferente de `Terrain.enabled`, que gobierna existencia física y colisiones.
- Una pieza desactivada puede seguir seleccionándose en la jerarquía y recuperarse por su icono de ojo sin descartar su pintura, alturas o vegetación. `project.terrain.enabled` refleja si existe alguna pieza activada, no solo el estado de la pieza seleccionada.
- El orden del árbol y sus dependencias físicas permanecen sin alterar. Una pieza aparece en la raíz de escena; aún no se admite convertirla en hijo de un Node3D o aplicar escala/rotación arbitrarias. No se simula soporte para estas operaciones.

## Fuera de S01, deuda planificada

- **S02:** permitir desplazamiento vertical Y respaldado por raycasts, colisiones, agua, vegetación, exportación y otras consultas del mundo. La gizmo y la escala no se habilitan artificialmente en S01.
- **S03:** ampliar independientemente +X, -X, +Z y -Z preservando relieve/pintura; diferenciar dimensión de resolución.
- **S04:** corregir el `frameAll()` tras «Aplicar tamaño» y ejecutar QA integral de escenas y Player.

## Evidencia automatizada local

- `node --test scripts/test-terrain-node-s01-g001.mjs`: **16/16 PASS**, incluye ID, selección, visibilidad, nombre, estado de escena, ausencia de datos duplicados, perfil de operaciones y limitación de alcance.
- Regresión Node en 14 suites: **263/263 PASS**. Incluye nodos, Scene Inspector, navegación, Edit Mode Shift/Snap, agua, hidrología y terreno.
- `scripts/test-terrain-node-electron-s01-g001.mjs` y `scripts/fixtures/terrain/node-tree-s01.html` se entregan como prueba Electron real de SceneTree con Vue y WebGL2. **NO VERIFICADO** en este entorno sin Vite/Electron instalados.
- Build Editor/Player: **NO VERIFICADO** (dependencias locales ausentes).

## QA del usuario — ejecutar en Electron

1. Crear/abrir una escena con dos piezas de terreno y objetos normales. Confirmar que todos son filas del **mismo árbol**, sin sección privilegiada aislada ni duplicaciones.
2. Seleccionar cada pieza; debe abrirse el panel de terreno con el ID real y su contenido original. Seleccionar después un objeto normal; no debe quedar seleccionado Terrain.
3. Renombrar desde doble clic y F2; guardar, cerrar y reabrir. Nombre, relieve, vegetación y pintura deben conservarse.
4. Ocultar solo la segunda pieza desde el ojo; la primera sigue visible. Volver a mostrar; los datos siguen intactos. Probar Undo/Redo.
5. Eliminar una de varias piezas y probar Undo; reabrir una escena distinta y confirmar que las piezas pertenecen a la escena correcta.
6. Verificar que las operaciones de pincel y el Player exportado siguen renderizando el terreno según su estado real.

Ejecutar desde la raíz:

```bash
node --test scripts/test-terrain-node-s01-g001.mjs
node --test scripts/test-terrain-node-electron-s01-g001.mjs
npm run build
npm run electron
```

Si faltan dependencias, `npm ci` antes del build/Electron. Devolver stdout, capturas del árbol con terreno + objeto, renombrado y visibilidad, y resultado de guardar/recargar. Si el Editor falla, enviar la consola; no se declarará PASS visual sin evidencia.

## Prohibiciones conservadas

No sobrescribir escenas/proyectos del usuario. No editar `Terrain` geométrico, Jolt, WaterWorld, hidrología, render Player ni rutinas de extensión. No añadir `Terrain` a `project.objects`, porque duplicaría la autoridad de datos del terreno sin resolver las dependencias de S02. No interpretar la integración de filas de S01 como un Node3D transformable.

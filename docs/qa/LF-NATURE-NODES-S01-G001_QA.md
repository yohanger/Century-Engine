# LevelForge · LF-NATURE-NODES-S01-G001

**Autorización recibida:** `Listo. LF-NATURE-NODES-S01-G001 autoriza comenzar`.

**SOURCE_BASELINE:** `LevelForge_EDITOR_HIERARCHY_REORDER_G001_CORR_001_SOURCE_BASELINE.zip` (1.444 archivos). **Estado:** IMPLEMENTADO; TEST NODE focal PASS; Electron, build y QA local NO VERIFICADOS; NO CERRADO.

## Contrato y frontera del Sprint

S01 agrega instancias **individuales** independientes de Terrain. Son nodos reales de tipo `nature`, con siete variantes derivadas exclusivamente del catálogo existente `BUILTIN_FOLIAGE`: hierba, hierba alta, flores, arbusto, pino, árbol y roca. El nodo `terrain` cambia de categoría de *Ambiente* a *Naturaleza* sin modificar su tipo, su geometría o su ciclo físico.

**No se autoriza S01 a migrar la vegetación pintada** que hoy vive en `project.terrain.foliage`, `Foliage(terrain)` y piezas Terrain. Esa separación de propiedad, instancing masivo, migración y persistencia heredada corresponde a S02. S01 no permite afirmar que toda la naturaleza del Editor ya sea independiente de Terrain.

## Código real y mecanismo

- `src/engine/runtime/nodes/nature.js`: define variantes desde `BUILTIN_FOLIAGE` (sin reimplementar sus generadores), geometría unificada compartida por variante y material individual con colores por vértice; utiliza `applyWind` y `geometryHeight` existentes para el viento global de World. No hay un segundo sistema de render, flora o física.
- `src/engine/runtime/nodes/index.js`: registra el tipo `nature` mediante el registro preexistente; `project.objects`, parentId, Transform, selección, duplicación, Undo/Redo, exportación y Player continúan por las rutas genéricas.
- `src/engine/runtime/nodes/terrain.js`: solo `category: 'Naturaleza'`; sin alteraciones del Terrain físico.
- `src/components/Inspector.vue`: controles individuales Color, Sombra e Influencia del viento, además de los Transform generales.
- `src/engine/runtime/scene/objects.js`: libera únicamente materiales propios en eliminación y reconstrucción; las geometrías de variante tienen caché acotada de siete entradas. `src/core/editor/placement.js` libera el material de la previsualización cancelada.
- `src/core/commands.js` y `src/core/state/objects.js`: icono Naturaleza y texto correcto de ruta de creación de Terrain. No se duplicó el menú ni el registro.

## Pruebas automatizadas y limitaciones

- `scripts/test-nature-nodes-s01-g001.mjs`: **26/26 PASS**, cubre variantes y categoría, identidad, independencia de terreno, geometría compartida, materiales y transformaciones individuales, viento, sombras, liberación, integración de registro y exclusión de migración.
- Focal junto a Shift+A, Terrain y jerarquía: **93/93 Node PASS**.
- Regresión ampliada: **367 PASS, 5 FAIL, 0 SKIP**. Los mismos cinco casos fallan ejecutados contra el baseline anterior sin modificar: cuatro suites carecen de dependencias o componentes para ejecutarse y una aserción heredada busca CSS `@container insp (max-width: 340px)` eliminado en anteriores Gates. No declarar toda la regresión PASS.
- `scripts/test-nature-nodes-electron-s01-g001.mjs` y fixture Three/WebGL: **NO VERIFICADO** sin dependencias de Electron/Vite (`Falta Vite`).
- `npm run build`: **NO VERIFICADO** (`vite: not found`).
- Play/Player y autoría real de escena: **NO VERIFICADO** hasta QA local.

## QA local obligatorio

Extraer este SOURCE_BASELINE en otra carpeta. Desde la raíz:

```bash
npm ci
node --test scripts/test-nature-nodes-s01-g001.mjs
node --test scripts/test-editor-addmenu-categories-corr-g001.mjs scripts/test-terrain-node-s01-g001.mjs
node --test scripts/test-nature-nodes-electron-s01-g001.mjs
npm run build
npm run electron
```

**Se espera:** 26/26 nuevas Node, sin fallos en las otras suites focales; 1/1 Electron con al menos 12 comprobaciones internas; build Editor/Player sin errores. Electron fixture prueba el registro y render Three.js real, **no** reemplaza la prueba visual de la interfaz.

### Prueba de integración visual del usuario

1. Escena nueva **sin terreno**; abrir Shift+A → Naturaleza y comprobar que existen Terreno y las siete variantes, sin duplicar tipos.
2. Crear Árbol, Pino, Hierba, Hierba alta, Arbusto, Flores y Roca; confirmar que generan geometría visible con su nombre en jerarquía, color y sombra según especie.
3. Seleccionar, mover, rotar, escalar, duplicar, agrupar, reparentar y eliminar cada tipo; usar Snap, Global/Local y Undo/Redo.
4. Cambiar Color, Sombra e Influencia del viento en Inspector; activar viento y comprobar movimiento en los tipos con parámetros; la Roca no debe doblarse.
5. Guardar, cerrar y reabrir; comprobar IDs, parentesco, Transform y propiedades. Cambiar entre escenas y entrar/salir de Play sin instancias residuales.
6. Abrir un proyecto con Terrain y vegetación pintada: **no debe perderse, duplicarse ni convertirse automáticamente**. El pincel y los datos heredados permanecen bajo Terrain durante S01.
7. Probar visualización en Player exportado. Si hay fallo de render, viento, sombras o persistencia, registrar la incidencia sin asumir PASS.

**Evidencia requerida:** Node/Electron/build, captura de una escena sin Terrain con árbol y hierba, Inspector y prueba de guardado/recarga; resultado de Player. Solamente el usuario puede aprobar QA local y cerrar este Gate.

## Futuros Gates (fuera de S01)

**S02:** propiedad y migración de vegetación masiva pintada, sin duplicar instancing. **S03:** pinceles independientes, LOD, viento y física existente con integración completa. No corregir contratos para justificar deficiencias; si aparecen contradicciones, bloquear y promover Contract Amendment.

**Entrega:** exactamente dos ZIP, CHANGE con archivos nuevos/modificados + pruebas/documentación/ledger y SOURCE_BASELINE acumulado completo; sin SHA separado ni scripts `.sh`.

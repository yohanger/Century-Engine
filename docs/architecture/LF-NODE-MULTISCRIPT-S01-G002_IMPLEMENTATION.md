# LF-NODE-MULTISCRIPT-S01-G002 — Implementación

**Baseline:** Multiscript S01-G001 aprobado por usuario. **Estado:** IMPLEMENTADO; QA LOCAL PENDIENTE.

## Cambios de producción

- `src/engine/runtime/nodes/index.js`: nodos nuevos utilizan `scriptIds: []`; normalización compatible para constructores con `scriptId` legado.
- `src/core/project.js`: `migrateScene()` normaliza `scriptId` → `scriptIds` antes de otras migraciones de nodo, conservando referencias ausentes y rechazando listas corruptas.
- `src/core/state/objects.js`: operaciones transaccionales reutilizando `updateObject` y el mismo historial. Una operación = un commit; evitar modificar si duplicada/nula.
- `src/components/Inspector.vue`: lista compacta por script, selector de recursos, drop desde Assets, arrastre para reordenar, controles de subir/bajar, abrir, eliminar asociación, recurso ausente con diagnóstico.
- `src/components/SceneTree.vue`: arrastre añade, contador de scripts; una asociación abre su script y varias llevan al Inspector.
- `src/core/levelpackage.js` y `src/core/levelpackage-import.js`: bloqueo temporal explícito para escenas y Prefabs con `scriptIds` no vacío; G003 implementará y probará compatibilidad integral.

No se modificaron `NodeScriptRuntime`, `NodeLifecycle`, SceneGraph, Player, Signals, física ni Terreno. No se creó ninguna instancia global ni estructura de estado paralela. El `scriptId` vacío que algunos flujos de Terreno heredados generan fuera de `makeObject` se normaliza al cargar la escena; la ruta específica se revisará en la integración de G003, sin intervención no autorizada en `state/terrain.js`.

## Evolución de pruebas históricas

Se actualizaron solo las expectativas de tests de Script Nodo y SceneTree relativas a la representación antigua `scriptId` para evaluar el nuevo contrato `scriptIds`. No se eliminaron tests ni se ocultaron incidencias preexistentes. Las expectativas anteriores de un solo script no deben reinterpretarse como defectos del nuevo comportamiento previsto.

## Evidencia

- G002 nuevas: **20/20 Node PASS**.
- Regresión focal acumulada: **276/276 Node PASS**, 0 FAIL, 0 SKIP.
- Regresión histórica adicional de editor: **94/95 PASS**, 1 FAIL histórico `NE6-16`, demostrado anterior al Gate por falta de CSS `@container` en el SOURCE_BASELINE G001 (archivo `src/styles.css` no modificado).
- `node scripts/gen-docs.mjs --check` PASS; `node --check` PASS.
- Electron Vue/WebGL2 y `npm run build`: **NO VERIFICADOS**, Vite ausente en entorno implementador (`vite: not found`).
- QA local Editor/Player: PENDIENTE.

La aprobación del usuario de G001 se registra aparte como QA LOCAL PASS declarado por él; no acredita las pruebas G002.

# LF-NODE-REFERENCE-RESOLUTION-S01-G001 — Implementación

**Autorización:** recibida, alcance solo S01. **Baseline:** ZIP G001 de auditoría de referencias/señales, sin tomar la rama Terrain Extents como origen.

## Cambios ejecutados

- `play-nodes.js`: `game.node()` admite rutas absolutas y NodeLike; `_nodeHandle` consulta identidad y `Object3D` vigentes, expone `parent`, `children`, `get_node`, `is_valid`; restringe delegados de Groups/animación y movimientos.
- `node-scripts.js`: `resolveNodePath` reutilizable y eliminación del algoritmo de rutas duplicado de Scripts de Nodo; conserva compatibilidad con hosts ligeros de prueba.
- `play.js`: token de vigencia por sesión, invalidado al parar.
- `scene/objects.js`: marca privada del registro lógico propietario en el Object3D raíz, tanto al construir como al sincronizar; comprobación de vigencia O(1) y sin serialización Three.js.
- `play-level.js`, `play-dialog.js`: cancelación de movimientos/fundidos durante teardown, protección de tween ante desmontaje/recreación.
- `play-light.js`: caché por identidad de registro y protección de fundidos y operaciones de luz ante referencias antiguas.
- `game-api.d.ts`, `docs/referencia/api.md`: API unificada, referencia generada desde tipos.
- `scripts/test-node-reference-resolution-s01-g001.mjs`: prueba de cuerpo real de mixins con sustitutos de dependencias externas + módulo `node-scripts.js` real; NO equivale a prueba integrada Vite/Three.js.
- Runner Electron y fixture WebGL específicos de este Gate, basados en `qa-electron-webgl-runner.mjs` existente.

## Riesgos y verificaciones pendientes

1. Escena y Player reales requieren QA local. Los cambios no reconstruyen ni ejecutan un Player empaquetado en este entorno.
2. `object3D` directamente almacenado permanece fuera del mecanismo de revocación. Cualquier retención externa avanzada es responsabilidad del script.
3. Un mismo objeto JS reinsertado tras salir del árbol no permite inferir destrucción inequívoca sin integrar una generación al lifecycle; no se altera NodeLifecycle fuera del alcance declarado.
4. El test Electron se preparó pero no se ejecutó exitosamente por ausencia de `node_modules`/Vite en el entorno de entrega.
5. Las pruebas Node de S01 emplean un cargador ligero del **cuerpo** de `play-nodes.js` y `play-light.js`; la integración real con Three.js depende de Electron.

**Evidencia:** `docs/qa/LF-NODE-REFERENCE-RESOLUTION-S01-G001_QA.md`. No cerrar sin QA usuario.

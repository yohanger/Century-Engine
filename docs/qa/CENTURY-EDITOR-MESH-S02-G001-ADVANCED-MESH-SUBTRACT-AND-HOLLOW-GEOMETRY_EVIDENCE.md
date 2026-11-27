# Mesh Substract — evidencia de QA

**Gate:** `CENTURY-EDITOR-MESH-S02-G001-ADVANCED-MESH-SUBTRACT-AND-HOLLOW-GEOMETRY`.

- **14/14 PASS** — suite específica `scripts/test-mesh-subtract-hollow-geometry.mjs`; CSG/BSP del proyecto ejercitado con sustitutos de Three.js. Incluye recorte de una escalera con ocho peldaños, paredes interiores, recuperación tras retirar cortador, movimiento de fuente, dos cortadores, fuentes inválidas y referencia válida a TriMeshShape3D.
- **29/29 PASS** — suite focal junto con `test-transform-global-local-corr-g001.mjs`.
- **19/20 PASS** — regresión antigua `test-csg-subtract-node-corr-g001.mjs`: único fallo `SN-17`, también reproducido en SOURCE_BASELINE sin cambios (`validateSignalConnections is not defined` en el test histórico). El assertion de `SN-15` se amplió para reconocer el segundo tipo de cortador, sin cambiar el escenario probado.
- **24/28 PASS** — regresiones de catálogo y Content Browser. Los mismos cuatro casos `AC-14`, `AC-16`, `S03-01`, `S03-05` fallan también en el SOURCE_BASELINE anterior. No se presentan como QA aprobado.
- **Sintaxis JavaScript** — comprobaciones `node --check` de los archivos JavaScript modificados: PASS.
- **Compilación** — `npm run build`: EXIT 127 (`vite: not found`). Las dependencias no están instaladas en el entorno aislado. No se acredita build ni prueba real de Vue SFC.
- **QA visual Electron / GPU** — NO EJECUTADO. Necesaria validación manual del Inspector, selección, geometría visible, Play, Undo/Redo, Snap y rendimiento real.
- **Jolt WASM / colisiones** — NO EJECUTADO. Para dejar el espacio transitable se requiere `StaticBody3D` + `TriMeshShape3D` explícito sobre el receptor; `BoxShape3D` conserva un volumen macizo.
- **Modelos GLB/GLTF como `model` fuente directa** — NO IMPLEMENTADO; primero deben convertirse en malla editable cerrada cuando el flujo admita la conversión. Las fuentes `mesh`, primitivas sólidas y la referencia física TriMesh válida sí están implementadas.

**Estado final:** IMPLEMENTADO EN FUENTE; pruebas focales PASS; build, Player, visual y física NO VERIFICADOS; aprobación de usuario y cierre PENDIENTES. No se operó Git.

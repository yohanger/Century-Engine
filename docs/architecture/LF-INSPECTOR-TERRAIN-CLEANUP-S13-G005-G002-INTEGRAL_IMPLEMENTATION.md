# S13-G005-G002 · Limpieza del Inspector de Terreno

**Autorización:** literal recibida el 2026-11-08. **Contratos:** UX-01..UX-08; CA-TRANSFORM-S-OBJECTMODE-001 ratificado conjuntamente. **Baseline:** S13-G005-G001_CORR-002.

## Auditoría

- `TerrainPanel.vue` muestra instrucciones prolongadas en párrafos `hint lf-help`; contiene información dinámica y advertencias de operaciones irreversibles que no deben desaparecer.
- La lista de Piezas y el selector de texturas ya tenían scroll de 150 px. Capas, vegetación y conexiones hidráulicas carecían de límite de altura.
- `src/core/editor/keys.js` contenía en Object Mode un manejador numérico S que no corresponde a Edit Mesh; `src/core/mesh/session-modal.js` posee su propio flujo para S.
- Los controles de hidrología y el área de drop de vegetación tenían la clase de ayuda `lf-help` pese a ser elementos interactivos; ahora son visibles independientemente del ajuste global de ayudas.

## Implementación

- Terreno: eliminar tutoriales en el Inspector, conservando métricas en vivo de piezas, celdas de agua y resolución; mantener advertencias de costa/relieve heredados, alta resolución y reemplazo de alturas por Generate.
- Aplicar padding/espaciado a los controles y adaptación de filas en anchuras estrechas mediante estilos scoped existentes.
- Contener únicamente listas extensas: conexiones hidráulicas desde 4, capas y vegetación desde 6; scroll interno máximo 280 px, preservando selección, campos, botones, drop de Assets y el montaje único.
- Teclado: retirar la ruta modal S en Object Mode de `keys.js`, conservar S de Edit Mesh, Ctrl+S, R y escalado desde Inspector.
- Rebasar solo aserciones históricas supersedidas; conservar funciones, datos y exportación.

**No modificados:** `InspectorDock.vue`, `ScenePanel.vue`, `MeshPanel.vue`, Audio, Jolt, World, Three.js, Player, modelos de Terreno y sistemas de tooltips.

**Limitaciones:** el entorno de preparación no tiene Vite/node_modules; Electron y build requieren pruebas locales. Estado G005-G002: IMPLEMENTADO, NODE PASS, QA LOCAL PENDIENTE. El Gate no se considera APROBADO ni CERRADO.

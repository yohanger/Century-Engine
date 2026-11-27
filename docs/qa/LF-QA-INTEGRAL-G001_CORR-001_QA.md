# LevelForge — LF-QA-INTEGRAL-G001_CORR-001 · Corrección Edit Mesh

**Gate aprobado previamente:** `LF-QA-INTEGRAL-G001_CORR-001`, restaurado en la continuidad del SOURCE_BASELINE de Shader Graph. Esta entrada no autoriza una corrección nueva.

**Entrada original de esa corrección:** `LevelForge_SHADER_GRAPH_S02_G001_SOURCE_BASELINE(1).zip` (786 archivos). Se rechazó expresamente utilizar `LevelForge_QA_INTEGRAL_G001_SOURCE_BASELINE.zip` como fuente.

## Defecto y causa

Durante Edit Mesh, `session-input.js` accedía a `store.edit.paint.active` desde `_onMove` y `_onDown` sin importar `store`; `session.js` importa esa variable, pero un módulo no hereda el alcance léxico de otro. Se corrigió importando `store` desde `../store.js` en `src/core/mesh/session-input.js`, sin sustituir los flujos existentes.

## Regresión de la corrección aprobada

- `scripts/test-qa-integral-g001-corr-001.mjs`: 5 casos de selección por clic en vértice/arista/cara, arrastre, pintura y navegación.
- **Visual Electron / GPU:** permanece pendiente hasta recibir evidencia local.
- **Continuidad:** el ZIP corregido de aquella entrega no está disponible en esta sesión. Se recuperaron la importación, las pruebas y su trazabilidad desde la corrección aprobada en el hilo. Esta reconstrucción no constituye una verificación binaria contra aquel ZIP y debe cotejarse en el próximo QA del usuario. No arrastra el Gate QA-INTEGRAL-G001 rechazado.

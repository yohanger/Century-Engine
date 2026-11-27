# S13-G001 — QA documental y criterios para ratificación

**Tipo:** auditoría estática y propuesta contractual. **No es QA de implementación visual.**

## Controles documentales verificados

- [x] Integridad de SOURCE_BASELINE de entrada: ZIP válido, 2.650 entradas.
- [x] Montaje desde App/DockPanelBank y rutas condicionales de InspectorDock inspeccionados.
- [x] Reutilización de `inspFold` y selector `.sect > header` constatada.
- [x] Reglas de ayuda `lf-tips` y auditor existente inspeccionados.
- [x] Inspeccionadas familias Node/Scene/Terrain/Temporal/Signals/Resource/Mesh/Paint.
- [x] Contratos de Terrain, Scene Ownership, VFX CA, Timeline FX CA y puntos de volumen contrastados.
- [x] Matriz clasifica tutorial, propiedad, estado, validación y riesgo destructivo.
- [x] Propuestas futuras divididas en Gates y tooltips pospuestos.
- [ ] Ratificación contractual del usuario: **PENDIENTE**.
- [ ] Electron/visual/compilación/Player: **NO VERIFICADOS** y no indispensables para el Gate exclusivamente documental.

## Resultados de comandos reales de auditoría

- `node scripts/audit-help-text.mjs --check`: **EXIT 1, 134 textos señalados en todo `src/`**, antes de cualquier cambio en producción; ver `evidence/LF_INSPECTOR_S13_G001/help_audit_baseline.log`. No llamarlos 134 problemas del Inspector.
- `node --test scripts/test-editor-property-readability-s01-g001.mjs scripts/test-inspector-primitives-ux-s01-g001.mjs scripts/test-scene-inspector-s01-g001.mjs scripts/test-inspector-audio-volume-points-s12-g007-g001-corr001.mjs`: **56 tests: 55 PASS, 1 FAIL** (`SCENE-09`: aserción estática `src/core/mesh/session.js - translate`), ver `inspector_readonly_regression.log`. Las fuentes de producción son idénticas al baseline de entrada; se registra como fallo heredado/preexistente a este Gate, no corregido, y su causa de fondo no se ha determinado aquí.
- La prueba `scripts/test-help-hidden.mjs` **no existe en este baseline**; no se cuenta como ejecutada ni PASS. El auditor real disponible es `scripts/audit-help-text.mjs`.

## Reglas QA vinculantes una vez RATIFICADO el contrato

1. No texto editorial de documentación dentro del Inspector tanto con `tooltips` activados como desactivados.
2. Estados/advertencias críticos no desaparecen por limpieza ni por secciones plegadas.
3. Plegado de todos los apartados del contexto afectado por ratón y teclado, ARIA y foco correcto.
4. Preferencias existentes de plegado se conservan con migración no destructiva; distintos recursos o contextos no colisionan.
5. No se dispara commit, undo ni cambios en objetos al plegar.
6. No se altera selección, materiales, lógica World, Terrain, Signals, Timeline, VFX, audio, Player/export ni propiedades de recursos.
7. Las listas extensas usan scroll interior sólo cuando sea útil y no impiden drag/drop/teclado.
8. Cada Gate de código tendrá Node + Electron reales + build Editor/Player + QA local de usuario. Fallo histórico sin corrección no se ocultará ni se reclasificará PASS.

**Estado:** AUDITADO, CONTRATO RECOMENDADO, aprobación contractual y Gate de código posteriores PENDIENTES. No implementar ni cerrar G002-G010 sin autorización literal específica.

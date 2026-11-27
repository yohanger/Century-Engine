# DIFF — S12-G001 CORR-001

SOURCE_BASELINE de entrada: `LF_TIMELINE_PREVIEW_DIALOG_S12_G001_INTEGRAL_SOURCE_BASELINE.zip`.

## Archivo corregido

`scripts/fixtures/editor/timeline-preview-dialog-s12-g001.html`:
- Importa `registerUiComponents`, `RtDialogText` y la paleta existente `TEXT_COLORS`.
- Registra los componentes de Runtime en la misma aplicación Vue aislada **antes** de montarla, igual que el Editor y el Player.
- Sustituye una búsqueda superficial de texto por verificación del componente, los tramos visibles y el formato de color de `\C[2]` aplicado en DOM real.
- Conserva las verificaciones originales de transporte, integridad de proyecto, WebGL, canvas y limpieza.

## Archivo de trazabilidad

`docs/qa/LevelForge_DB_Ledger.xlsx`: registros nuevos en las seis hojas, sin reescribir la historia anterior.

## Pruebas y documentación nuevas

- `scripts/test-timeline-preview-dialog-s12-g001-corr001.mjs`: 4 pruebas Node de contrato, presencia real del componente y estilo.
- Documentación QA/DIFF/INVENTORY y registros de evidencia en `docs/qa/`.

## Fuera de alcance y seguridad

Ningún archivo `src/` ni runtime del Player se modifica. Se preservan formatos, scene/Assets, UI personalizada, `UiManager` y el runner compartido. G001 no se declara aprobado ni cerrado antes del QA del usuario. No hay Contract Amendment porque se corrige una fixture incorrecta, no un contrato de producto.

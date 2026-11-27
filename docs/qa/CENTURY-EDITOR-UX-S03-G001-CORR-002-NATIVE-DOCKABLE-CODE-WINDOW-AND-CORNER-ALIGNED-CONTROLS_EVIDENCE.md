# QA — CENTURY-EDITOR-UX-S03-G001-CORR-002-NATIVE-DOCKABLE-CODE-WINDOW-AND-CORNER-ALIGNED-CONTROLS

**IMPLEMENTADO EN FUENTE · NODE PASS ACOTADO · NO COMPILADO · QA ELECTRON NO VERIFICADO · NO APROBADO · NO CERRADO**

## Baseline

`CENTURY-EDITOR-UX-S03-G001-CORR-001-PROFESSIONAL-CODE-WORKSPACE-AND-NATIVE-WINDOW-UX_SOURCE_BASELINE.zip`; 3334 archivos verificados. Sin modificaciones externas identificables en el material entregado, sin `.git` ni dependencias instaladas.

## Resultados

- Prueba nueva `scripts/test-century-code-native-docking-corr002.mjs`: **8/8 PASS**. Valida ruta nativa sin CSS float, desacoplar desde docking, `modal: false`, parent independiente, registro de foco, restauración de layouts y separación de comandos.
- Suite integrada inicial (Code + contrato previo): **27/27 PASS**.
- Regresión focal ampliada: **172/181 PASS**. Nueve fallos reproducidos también sobre el baseline de CORR-001 sin los cambios actuales (**87/96 PASS** en los tres archivos afectados): `DOCK-30`, `DOCK-C09`, `WL-12` y seis casos `SE-C03`. No son fallos nuevos de CORR-002.
- Comprobación de sintaxis: archivos JS y `script setup` de Vue modificados PASS.
- `npm run build`: **BLOQUEADO** por `vite: not found`; no hay `node_modules`.
- QA Electron real, movimiento de Code a un segundo monitor, retorno del componente CodeMirror, drag-and-drop multiventana, tamaño y apariencia: **NO VERIFICADOS**.

## Trazabilidad

Archivos de prueba y logs incluidos; no se reemplazan registros previos. Al usuario corresponde QA y aprobación; ningún PASS automatizado significa compilación, QA visual o cierre.

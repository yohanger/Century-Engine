# LF-NODE-SIGNALS-GODOT-UX-S04-G001_CORR-002 — Contrato de corrección

**Fecha:** 2026-11-02. **Autorización literal:** `Listo. LF-NODE-SIGNALS-GODOT-UX-S04-G001_CORR-002 autoriza comenzar`.

**SOURCE_BASELINE:** `LevelForge_NODE_SIGNALS_GODOT_UX_S04_G001_CORR_001_SOURCE_BASELINE.zip`, 1605 archivos y comprobación ZIP íntegra. No utilizar el SOURCE_BASELINE S04-G001 anterior ni sobrescribir proyectos locales.

## Disparador y evidencia vinculante

El usuario ejecutó S04-G001_CORR-001: **18/18 Node PASS**, **Electron FAIL** (`No se obtuvo resultado WebGL de la fixture`), **npm run build FAIL** (`[vite:vue] v-else/v-else-if has no adjacent v-if or v-else-if`, `SignalConnectionsPanel.vue:286`). La compilación Player no comenzó. `node scripts/gen-docs.mjs --check` PASS. El comando `npm run electron` se lanzó, pero no constituye evidencia de QA visual PASS. El terminal nombraba una carpeta S04-G001, pero el contenido del ZIP CORR-001 reproduce exactamente el defecto, por lo que no se atribuye la causa a la ruta local del usuario.

## Objetivo y mecanismo

1. Recuperar la compilación Vue sustituyendo el `v-else` huérfano por una condición propia `v-if="!editable"` aplicable cuando exista selección y Play o Edit Mode deshabilite la edición. Conservar el texto informativo de Custom Signals. No alterar el flujo contextual ni el catálogo.
2. En la fixture Electron S04 CORR-001, comprobar `#lf-sig-name` únicamente con el diálogo abierto: reubicar la comprobación de origen fijo después del clic en `+` contextual que reabre el diálogo, antes de cerrarlo.
3. Añadir prueba de compilación real de `<template>` utilizando `@vue/compiler-sfc` ya incluido en el grafo de dependencias de Vue/Vite. Si no está instalado, registrar SKIP y exigir `npm ci` para verificar: no presentar la comprobación estática como compilación real.
4. Repetir regresiones S01–S04, documentación, Electron embebido, `npm run build` Editor/Player y QA local. Cierre solo con evidencia local satisfactoria y aprobación explícita del usuario.

## Alcance autorizado y restricciones

Producción: exclusivamente `src/components/SignalConnectionsPanel.vue`. QA: fixture `scripts/fixtures/nodes/node-signals-godot-ux-s04-g001-corr001.html`, `scripts/test-node-signals-godot-ux-s04-g001-corr001.mjs`, y runner Electron `scripts/test-node-signals-godot-ux-electron-s04-g001-corr001.mjs` solo si fuese indispensable. Documentación de contrato, implementación y QA, más seis hojas del ledger. No se autoriza modificar NodeScriptRuntime, registry, SceneGraph, Jolt ni la persistencia.

**Condición de bloqueo:** si surge otra causa en un archivo de producción fuera del alcance, documentarla y proponer enmienda/otro Gate antes de modificar. Los tests Node no validan por sí solos la compilación SFC ni la fidelidad visual de Godot.

## Entrega

Exactamente dos ZIP: CHANGE con diferencias concretas; SOURCE_BASELINE acumulado completo. Sin scripts de verificación .sh ni SHA separado.

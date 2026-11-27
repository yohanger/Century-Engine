# LF-NODE-SIGNALS-GODOT-UX-S04-G001_CORR-002 — Informe de implementación

**Fecha:** 2026-11-02. **Estado:** IMPLEMENTADO, TEST NODE PASS, COMPILADOR VUE NO VERIFICADO en este entorno, Electron/Build/QA local pendientes.

## Diagnóstico observado y causa raíz

**OBSERVADO:** `SignalConnectionsPanel.vue` línea 286 tenía `<p v-else>` tras un `<p>` no condicionado. La directiva no podía asociarse con el `v-if` de diagnósticos de la línea 284 y Vue rechazaba el archivo antes de producir la compilación Editor. **CAUSA RAÍZ confirmada:** rama condicional huérfana introducida en CORR-001 y no detectada por su suite Node basada en inspección textual. Electron no devolvió datos de la fixture; su causalidad única no está confirmada hasta reejecutarlo.

**OBSERVADO:** la fixture del diálogo comprobaba `#lf-sig-name` después de cambiar `selectedId` a `null`, lo que cerraba el diálogo. Ese check no podía pasar. Se reubicó tras la operación `+` contextual que abre nuevamente el diálogo.

## Cambio mínimo

- `src/components/SignalConnectionsPanel.vue`: se reemplaza **solo** la directiva `v-else` huérfana por `v-if="!editable"`, conservando el aviso de modos de edición y el texto de Custom Signals. No se toca el catálogo, callbacks de panel, API de conexión ni persistencia.
- `scripts/fixtures/nodes/node-signals-godot-ux-s04-g001-corr001.html`: se traslada el check del elemento fuente al tramo donde el diálogo está abierto; se conserva el número de verificaciones.
- `scripts/test-node-signals-godot-ux-s04-g001-corr001.mjs`: nueva prueba CORR-19 invoca `parse()` y `compileTemplate()` del compilador Vue real y exige ausencia de errores; CORR-20 verifica el orden del check contextual de la fixture. La prueba CORR-19 registra SKIP explícito sin `npm ci`, sin inferir PASS.

**Invariantes:** Modelo A contextual al nodo, conexión solo desde una señal conectable, historial y conexiones antiguas preservadas. Editor, Player, scripts y motor físico permanecen intactos.

## Limitación de entorno

Una instalación `npm ci --ignore-scripts --no-audit --no-fund --prefer-offline` fue interrumpida por el límite de ejecución, sin dejar instalado `@vue/compiler-sfc` o Vite. No existe compilación Vue ni ejecución Electron verificada en este entorno. La prueba real del compilador deberá pasar en Linux después de `npm ci`. No presentar su SKIP como aprobación.

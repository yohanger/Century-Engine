# LF-NODE-SIGNALS-GODOT-UX-S04-G001_CORR-001 — Evidencia QA

**Fecha:** 2026-11-02 · **Estado:** IMPLEMENTADO · TEST NODE PASS · QA LOCAL PENDIENTE · NO CERRADO.

| Verificación | Resultado |
|---|---|
| Nueva suite CORR-001, `scripts/test-node-signals-godot-ux-s04-g001-corr001.mjs` | **18/18 Node PASS** |
| Regresión focal S01–S04 + Multiscript + Area/Character + Audio/Animation (21 suites) | **409/409 Node PASS**, 0 FAIL, 0 SKIP |
| Test Node histórico S04-G001 adaptado al origen fijo | **18/18 PASS** (incluido en regresión) |
| `node scripts/gen-docs.mjs --check` | PASS |
| Sintaxis de fixture Electron | PASS (`node --check`) |
| Electron embebido | **NO VERIFICADO**: falla antes de abrir la fixture por falta de Vite; `npm ci` requerido |
| `npm run build` Editor/Player | **NO VERIFICADO**: `vite: not found` |
| QA local usuario | PENDIENTE |

## Comandos de prueba

```bash
npm ci
node --test scripts/test-node-signals-godot-ux-s04-g001-corr001.mjs
node --test scripts/test-node-signals-godot-ux-electron-s04-g001-corr001.mjs
node --test scripts/test-node-signals-godot-ux-s04-g001.mjs
node scripts/gen-docs.mjs --check
npm run build
npm run electron
```

## QA funcional visual obligatorio

1. Seleccionar `Area3D`: aparecen cuatro señales físicas más las comunes reales. Seleccionar `CollisionShape3D`: desaparecen las señales físicas que ese nodo no puede emitir. `animation_finished` puede mantenerse si ese nodo soporta animación de claves. No mostrar catálogo global.
2. Verificar que desapareció el botón inferior «Conectar señal». Doble clic sobre `body_entered` o su `+` abre diálogo con **emisor y señal fijados**, sin selector, `input` ni datalist libre de origen. Seleccionar receptor real y escribir un método publicado con `node.expose()`. Verificar guardado.
3. Cambiar selección de nodo durante el diálogo y comprobar que se cierra o se bloquea guardar. Modificar declaraciones Custom durante conexión: una señal que desapareció no puede crear conexión nueva. Repetir con Play activado: edición bloqueada.
4. Cargar una escena histórica que contenga una conexión guardada cuya Custom Signal ya no se declara. Debe mostrarse con advertencia, permitir editar receptor/método conservando su nombre, desconectar y Undo/Redo. El icono `+` para esa señal no debe aparecer.
5. Verificar plegar/expandir, búsqueda, teclado (Enter/Escape/flechas/Tab), dock estrecho, exportación Player y persistencia. Verificar que no se evalúan scripts del usuario en Edit Mode.
6. Comparar capturas con el flujo de conexión básico de Godot 4.7. Entregar capturas del panel/modal y logs de Electron y build, o incidencia con pasos de reproducción.

**Parent S04-G001:** QA CON OBSERVACIONES por las capturas del usuario; **NO APROBADO**. No confundir aprobación de S03-G001 con aprobación de S04-G001. No cerrar CORR-001 hasta QA local satisfactorio del usuario.

## Actualización de evidencia posterior — QA del usuario, 2026-11-02

**Estado corregido:** **QA LOCAL FAIL · NO APROBADO · NO CERRADO**. Usuario ejecutó Node **18/18 PASS**, pero Electron **1 FAIL** (`No se obtuvo resultado WebGL de la fixture`) y `npm run build` **FAIL** en `SignalConnectionsPanel.vue:286` por `v-else/v-else-if has no adjacent v-if or v-else-if`. El build Player no se ejecutó. El QA de CORR-001 fue declarado BLOQUEADO y el usuario autorizó explícitamente CORR-002. No interpretar el antiguo `NO VERIFICADO` de esta hoja como evidencia de éxito local.

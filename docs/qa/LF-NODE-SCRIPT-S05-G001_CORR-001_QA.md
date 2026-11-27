# LF-NODE-SCRIPT-S05-G001_CORR-001 — Evidencia QA

**Fecha:** 2026-10-28  
**Baseline:** DOCS-WEB-G001 (973 archivos).  
**Estado:** implementado, pruebas automatizadas PASS, QA Electron y Player pendiente.

## Cobertura automática

`node --test scripts/test-node-script-s05-corr001.mjs` → **11 PASS / 0 FAIL**.

| ID | Verificación |
|---|---|
| CORR-01 | Plantilla Global: start/update/fixedUpdate, sin ejemplos ejecutables |
| CORR-02 | Plantilla Nodo: ready/process/physicsProcess, sintaxis válida |
| CORR-03 | Assets crea, selecciona y renombra sin abrir código |
| CORR-04 | Comando de creación muestra Assets y solicita nombre |
| CORR-05 | Inspector asigna recursos sin crear nuevos |
| CORR-06 | Drag-and-drop usa el mismo formato de Assets |
| CORR-07 | Rechazo de elementos incorrectos, múltiples y payload inválido |
| CORR-08 | Global no se asocia a Nodo |
| CORR-09 | ID, nombre, modo y registro de historial existentes |
| CORR-10 | Manual y portal explican el flujo |
| CORR-11 | Ciclo de vida y Event Order Flow conservados |

Regresión: `node --test scripts/test-*.mjs` excepto `test-starcat.mjs` y `test-clouds.mjs`: **2.259 PASS / 0 FAIL / 19 SKIP** en **106 archivos**. Se actualizaron dos pruebas históricas de S05/S06 que exigían el botón de creación anterior del Inspector; ahora comprueban el acceso a asignación de scripts existentes.

`npm run build`: **NO EJECUTADO CORRECTAMENTE** (`vite: not found`, faltan `node_modules`). No se declara build, integración Electron, drag DOM real, guardado/reapertura visual ni Player como aprobados. El portal generado se sincronizó preservando sus 179 páginas; `npm run docs:build` local regenera desde `docs/web-src/` con `marked` cuando las dependencias estén instaladas.

## QA local solicitado

1. Assets → Crear Script de Nodo: aparece archivo y editor de nombre, sin abrir ventana de código. Enter confirma; doble clic sí abre el editor.
2. Repetir con Script Global. Las plantillas deben contener solo los callbacks vacíos adecuados.
3. Inspector de Node3D: seleccionar Script de Nodo; **Agregar script** no crea otro archivo. **Quitar script** retira solo la asociación; el recurso permanece.
4. Arrastrar el Script de Nodo desde Assets al Inspector y a una fila del Scene Tree; se asigna al nodo de destino.
5. Arrastrar un Script Global o varios recursos juntos: se rechaza sin modificar `scriptId`.
6. Crear desde el comando de Juego: mostrar Assets, nombrar recurso y no abrir automáticamente el editor.
7. Probar Undo/Redo de asignación, renombrado, guardar y reabrir proyecto.
8. Iniciar Play: script asignado ejecuta callbacks una vez por nodo; sin doble ejecución Global/Nodo.
9. Abrir Ayuda → Documentación: consultar scripts, creación y arrastre.
10. Compilar con `npm run build`, probar Editor Electron y Player exportado.

**Restricción:** no se modificaron archivos protegidos de eventos, física ni runtime de scripting.

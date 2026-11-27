# LF-EDITOR-CONSOLE-SCRIPT-OUTPUT-CORR-G001-CORR-001 — QA

## Estado vigente: aprobado y cerrado

La repetición local solicitada ya fue recibida: Node 33/33 PASS y Electron 1/1 PASS con 35 comprobaciones WebGL2. El usuario indicó «Aprobado. Sigamos.». CORR-001 y su Gate parent G001 quedan cerrados documentalmente en LF-MESH-EDIT-INTEGRATION-CORR-G001, con las seis hojas del ledger actualizadas. Evidencia final: `docs/qa/evidence/LF-MESH-EDIT-INTEGRATION-CORR-G001/console-approval.md`. No se solicita otra repetición de Consola.

## Historial conservado: estados anteriores al cierre

**IMPLEMENTADO · NODE 33/33 PASS · FOCAL 319/319 PASS · ELECTRON NO VERIFICADO · QA DE CORRECCIÓN PENDIENTE · NO CERRADO.**

## Evidencia anterior recibida del usuario

`docs/qa/evidence/LF-EDITOR-CONSOLE-SCRIPT-OUTPUT-CORR-G001-CORR-001/usuario-g001.txt` conserva íntegramente la salida aportada. El usuario aprueba funcionalmente con salvedad explícita de tests fallidos.

| G001 en equipo del usuario | Resultado |
| --- | --- |
| Node | 30 PASS, 0 FAIL, 0 SKIP |
| Electron | 1 FAIL: CON-E01, «Dos scripts de nodo, dos salidas» |
| Comprobaciones anteriores al fallo | 13 PASS; incluye WebGL2 y disponibilidad Jolt WASM |
| Comprobaciones posteriores | NO EJECUTADAS |
| Compilación Editor/Player | Ambas satisfactorias |
| Aprobación funcional/QA manual | Declarada por usuario; cierre técnico pendiente por CON-E01 |

Este fallo de fixture pertenece a G001 y es distinto de los 11 fallos históricos de la regresión ampliada. No se convierte la disponibilidad de Jolt WASM en una prueba completa de física.

## Ejecuciones de CORR-001

Todos los archivos siguientes están bajo `docs/qa/evidence/LF-EDITOR-CONSOLE-SCRIPT-OUTPUT-CORR-G001-CORR-001/`.

| Comprobación | Resultado y archivo |
| --- | --- |
| Suite Node completa | 33 PASS, 0 FAIL, 0 SKIP; node.log |
| Regresión focal, 17 suites existentes | 319 PASS, 0 FAIL, 0 SKIP; focal.log |
| Regresión negativa | Propietario raw vs proxy: guard rechaza ambos scripts, cero salidas, dos errores |
| Regresión positiva | Identidad canónica: dos salidas con niveles correctos, Signals, limpieza y reentrada válidas |
| Cobertura Electron | 33 checks originales preservados + 2 nuevos; mínimo 35; comparison.json |
| Sintaxis de fixture | node --check del módulo extraído: PASS; syntax.log |
| Documentación | gen-docs --check PASS; docs.log |
| Comparación de producción | Ningún archivo src cambiado; comparison.json |
| Ledger | Seis hojas, sin cambios inesperados de contenido ni errores de fórmula; ledger-validation.json |
| Electron en autoría | Se intentó; Missing X server or $DISPLAY antes de ejecutar fixture; electron.log |

No se repiten builds de producción ni pruebas ajenas a esta corrección: código de producción y dependencias conservados byte a byte. Los builds G001 ya están verificados mediante la evidencia del usuario. No se atribuye una compilación nueva a CORR-001.

## Repetición local necesaria

En la raíz de la entrega corregida, con dependencias instaladas:

```bash
node --test scripts/test-editor-console-script-output-corr-g001.mjs
node --test scripts/test-editor-console-script-output-electron-corr-g001.mjs
```

Esperado: Node 33/33 PASS; Electron 1/1 PASS y 35 comprobaciones completas. La aserción «Dos scripts de nodo, dos salidas» debe pasar y el runner debe alcanzar también UI, error de Vue, historial lleno, scroll, Limpiar, sesiones y Player.

No necesitas repetir el QA manual de Consola ni Terreno ya aprobado. Devuelve la salida de Electron. Si falla, devuelve el JSON completo y la comprobación fallida. No modificar producción ni omitir la comprobación: primero determinar si se trata de otro defecto de fixture o de una causa productiva fuera de este alcance.

La corrección y el cierre técnico de G001 quedan pendientes de ese resultado y de aceptación del usuario.

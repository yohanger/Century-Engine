# LF-MESH-EDIT-INTEGRATION-CORR-G001 — QA

## Evidencia local posterior recibida

El usuario aportó Node 11/11 PASS, Electron 1/1 PASS con 29 comprobaciones WebGL2 y builds Editor/Player satisfactorios. La sonda registra tres capturas confiables válidas y cero errores en esa secuencia. Archivo original: `docs/qa/evidence/LF-MESH-EDIT-NUMERIC-SIGN-CORR-G001/usuario-mesh-integration.txt`. Se registra durante Numeric Sign en las seis hojas del ledger. No solicitar repetir esas suites. El adjunto no incluye aprobación explícita del QA manual ni acredita reparado el InvalidStateError histórico; esos estados no se infieren.

## Historial de autoría anterior a esa evidencia

IMPLEMENTADO. TEST NODE PASS. COMPILADO Editor/Player. ELECTRON NO VERIFICADO. QA LOCAL PENDIENTE. NO APROBADO PARA CIERRE. NO CERRADO.

Evidencia bajo `docs/qa/evidence/LF-MESH-EDIT-INTEGRATION-CORR-G001/`.

| Verificación | Resultado | Evidencia |
| --- | --- | --- |
| Suite nueva sobre baseline, antes del parche | 11 FAIL: métodos originales ausentes | node-before.log |
| Suite nueva tras parche | 11 PASS, 0 FAIL/SKIP | node-after.log |
| Integración final, suite nueva + Consola | 44 PASS, 0 FAIL/SKIP; incluye Shift previo y durante gesto | integration-final.log |
| Regresión malla y modales, 17 suites | 335 PASS / 1 FAIL, 0 SKIP | regression.log, regression-suites.json |
| Fallo CG-11 aislado sobre baseline aprobado | Misma aserción estática `/pointerMove\(\{ x:/`; 11 PASS / 1 FAIL | baseline-cg.log |
| Consola Node conservada | 33 PASS | console-regression.log |
| Build Editor + Player | Exit 0, ambos compilados; warnings de chunks/externalización | build.log |
| Documentación generada | Al día | docs.log |
| Sintaxis fixture, helper y runner | node --check satisfactorio | validation.json |
| Electron embebido en autoría | Intento fallido antes de fixture: Missing X server or $DISPLAY; cero checks ejecutados | electron.log |
| Alcance e inventario | Solo dos archivos src; sin eliminados ni cambios inesperados | comparison.json |
| Ledger | Seis hojas sincronizadas; historial conservado | ledger-validation.json |

CG-11 pertenece al material preexistente. La suite inspecciona texto del archivo session.js y no encuentra el patrón que espera; falla igual en el baseline aprobado. No se modifica ni relaja. La regresión anterior de 1.379 pruebas y sus 11 fallos históricos se conserva; este Gate no la convierte en PASS ni afirma haberla repetido íntegramente.

## Cobertura nueva y límites

Node carga por Vite los módulos productivos reales: prototipo de pintura, constructor/salida/reentrada, G/R/S y Snap, Shift previo/durante, cancelar y confirmar, pintura y Escape/salida, Undo/Redo, recursos vinculados, materiales/UV y serialización JSON. No inyecta el helper ni el mixin. DOM/viewport/disco de Node son colaboradores de prueba, no prueba visual ni guardado físico.

Electron prepara 29 comprobaciones con WebGL2, sesión real y sonda de puntero nativo. Sus métodos modales se invocan directamente; la secuencia nativa corresponde al diagnóstico de navegación/captura. No acredita por sí sola atajos del Editor completo. No se afirma PASS hasta recibir salida local. setPointerCapture permanece solo en diagnóstico, sin causa raíz ni corrección productiva.

## QA local requerido para este Gate

Desde la raíz corregida:

```bash
node --test scripts/test-mesh-edit-integration-corr-g001.mjs
node --test scripts/test-mesh-edit-integration-electron-corr-g001.mjs
node scripts/gen-docs.mjs --check
npm run build
npm run electron
```

Esperado: 11/11 Node PASS; Electron 1/1 PASS, 29 checks y JSON `LF_MESH_EDIT_INTEGRATION` con capturas nativas. Editor/Player deben compilar. Devolver salida completa del test Electron, incluyendo JSON o error completo. No repetir Consola/Terreno ya aprobados.

En una copia de un proyecto del usuario, no sobre su único original:

1. Entrar con Tab a Edit Mode de una malla y salir/reentrar varias veces. No debe fallar `_cancelPaintStroke`; selección y controles deben recuperarse.
2. Probar G/R/S con restricciones X/Y/Z, confirmar y cancelar. Snap activo; mantener Shift antes del gesto y cambiarlo durante él. Sin ReferenceError ni saltos al cambiar Shift; ajustes persistentes sin cambios.
3. Activar pintura, cancelar con Escape y salir durante un trazo. No deben persistir pesos cancelados. Confirmar otro trazo y verificar Undo/Redo sin perder UV/materiales.
4. Probar recurso de malla vinculado y objeto no vinculado: el cambio confirmado alcanza solo sus consumidores previstos; materiales particulares se conservan.
5. Guardar, cerrar/reabrir el proyecto y comprobar geometría, pesos, UV y materiales. Abrir Play y verificar la misma malla. Exportar una copia y abrir Player; comprobar visualmente geometría/material y ausencia de errores nuevos. La compilación no verifica estos pasos.
6. Navegar con botones derecho/central dentro y fuera de Edit Mode. Si aparece InvalidStateError, aportar stack completo y pasos exactos, herramienta, botón y cambio de foco. Un PASS de la sonda no declara reparado el fallo histórico.

Devolver resultado de estos puntos y aprobación solo si pasan. Ante otro defecto productivo, delimitar causa y alcance antes de corregir. No cerrar hasta evidencia y aceptación.

Consola G001/CORR-001 queda APROBADA y CERRADA documentalmente por la evidencia recibida y «Aprobado. Sigamos.», registrada en console-approval.md y en las seis hojas del ledger.

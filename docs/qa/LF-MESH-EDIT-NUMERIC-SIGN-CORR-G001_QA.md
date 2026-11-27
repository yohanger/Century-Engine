# LF-MESH-EDIT-NUMERIC-SIGN-CORR-G001 — QA

IMPLEMENTADO. TEST NODE PASS. COMPILADO Editor/Player. ELECTRON NO VERIFICADO. QA LOCAL Y ACEPTACIÓN PENDIENTES. NO CERRADO.

Evidencia: `docs/qa/evidence/LF-MESH-EDIT-NUMERIC-SIGN-CORR-G001/`.

| Verificación | Resultado | Archivo |
| --- | --- | --- |
| Suite nueva antes del parche | 8 PASS / 10 FAIL de 18; reproduce ruta Numpad y + ausente | node-before.log |
| Suite nueva después | 18 PASS, 0 FAIL/SKIP | node-after.log |
| Integración final: signos + malla + Consola | 62 PASS, 0 FAIL/SKIP | integration-final.log |
| Regresión focal, 22 suites | 415 PASS / 1 FAIL, 0 SKIP | regression.log, regression-suites.json |
| CG-11 | Fallo preexistente; mismo patrón estático ya reproducido sobre baseline en Gate anterior | ../LF-MESH-EDIT-INTEGRATION-CORR-G001/baseline-cg.log |
| Build Editor y Player | Exit 0, ambos compilados; warnings conservados | build.log |
| Documentación generada | Al día | docs.log |
| Sintaxis JS y módulo HTML | Satisfactoria | validation.json |
| Electron embebido | Intento fallido antes de fixture: falta X/$DISPLAY | electron.log |
| Comparación y ledger | Dos src; sin borrados/inesperados; seis hojas, historial/estilos/tablas conservados | comparison.json, ledger-validation.json |

Los 11 fallos históricos de la colección anterior no se declaran corregidos ni repetidos íntegramente. CG-11 no se elimina ni relaja. Compilación no acredita QA visual. Node usa colaboradores de plataforma y no acredita teclas nativas.

## Prueba local necesaria

En una sesión gráfica normal, desde la raíz de esta entrega:

```bash
node --test scripts/test-mesh-edit-numeric-sign-corr-g001.mjs
node --test scripts/test-mesh-edit-numeric-sign-electron-corr-g001.mjs
node scripts/gen-docs.mjs --check
npm run build
npm run electron
```

Esperado: Node 18/18 PASS; Electron SIGN-E01 1/1 PASS, 48 comprobaciones y JSON `LF_MESH_NUMERIC_SIGN` con 42 eventos nativos confiables. Verifica ubicación Numpad, dispatcher real, signos, confirmar/cancelar, Undo/Redo, guardas y navegación fuera del gesto. Usa viewport/disco de prueba, no toda la aplicación visual.

QA manual en una copia del proyecto:

1. Entrar a Edit Mesh, seleccionar geometría y hacer G → X → 10 → −. El delta es −10. Otro − devuelve +10; + deja el valor positivo. Repetir con Y y Z.
2. Repetir con teclado principal y numérico, signos antes/después, cero y decimales con punto. Durante el gesto Numpad no debe cambiar vista, hacer zoom ni encuadrar. Backspace debe editar el número.
3. Enter confirma una transacción; Escape restaura geometría sin agregar Undo. Verificar Undo/Redo y conservar UV/materiales; si la malla es vinculada, comprobar sus consumidores.
4. Probar R con valor negativo/positivo. En S conservar límite actual: un factor negativo no se confirma; + debe recuperar el positivo. No se añade espejado por escala negativa.
5. Fuera del gesto verificar Numpad +/− para zoom, vistas numéricas y Decimal para encuadrar; campos de texto no deben iniciar transformaciones. Verificar Snap/Shift y bisel +/PageDown sin cambios.

Devolver la salida completa del test Electron, incluido su JSON o error, y el resultado de estos cinco puntos. Si pasa y se acepta, aprobar para cierre. No repetir las suites anteriores que ya aportaste.

## Evidencia local previa recibida

El adjunto original `usuario-mesh-integration.txt` acredita Node 11/11, Electron 1/1 con 29 checks, tres capturas válidas y builds Editor/Player del Gate Mesh Integration anterior. No contiene una aprobación manual explícita. Se actualizan los estados de automatización recibida sin atribuir cierre o reparación del InvalidStateError histórico.

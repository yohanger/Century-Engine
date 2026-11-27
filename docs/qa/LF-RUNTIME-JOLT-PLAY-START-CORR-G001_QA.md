# QA — LF-RUNTIME-JOLT-PLAY-START-CORR-G001

**Estado:** IMPLEMENTADO · TEST CON DOBLES PASS · RUNNER JOLT WASM REAL NO VERIFICADO · QA LOCAL PENDIENTE · NO CERRADO.
**Baseline:** `LevelForge_EDITOR_VIEWBAR_RENDER_SELECTOR_CORR_G001_SOURCE_BASELINE(1).zip`.

## Evidencia generada en la sesión

| Prueba | Resultado observado | Interpretación |
|---|---|---|
| Integridad del ZIP de entrada | PASS, 1.230 archivos | Baseline identificable |
| `npm run test:runtime-jolt-contract` | 105 PASS, 0 FAIL, 1 SKIP | Adaptador y contratos; NO Jolt real |
| S12 tornado + S12A destructivo | 101 PASS, 0 FAIL, 0 SKIP | Contrato de clima y VFX, NO física gráfica |
| `npm run test:runtime-jolt-wasm` | NO VERIFICADO; intento fallido por ausencia de `three`/`jolt-physics` | No computa como PASS o fallo funcional del producto |
| `npm ci` | No completado; resolución DNS de `registry.npmjs.org` no disponible (comprobada con curl) | Dependencias no descargables en el contenedor |
| `npm run build` | NO VERIFICADO en la entrega | Logs de compilaciones previas no validan este Gate |
| Electron y Player exportado | NO VERIFICADOS | QA local del usuario |

## QA local obligatorio — comandos

Desde la carpeta del proyecto: primero comparar CHANGE con cambios locales y respaldar el ledger, luego extraer CHANGE y ejecutar:

1. `npm ci`
2. `npm run test:runtime-jolt-wasm` — **se exige salida real PASS sin SKIP**; Jolt 1.1.0 y Three.js reales, sin mocks.
3. `npm run test:runtime-jolt-contract` — regresión con dobles; esperar 0 FAIL (los SKIP deben revisarse con dependencias instaladas).
4. `node --test scripts/test-weather-tornado-world-s12-g001.mjs scripts/test-weather-tornado-destructive-s12a-g001.mjs` — 0 FAIL.
5. `npm run build` — deben compilar Editor y Player, sin excepción WASM.
6. `npm run electron` — probar los escenarios de escena indicados abajo.

## Escenarios de Editor/Play y Player

- Escena vacía: Play/Stop normal.
- StaticBody3D + BoxShape3D, esfera, cápsula: colisión sólida y ausencia de `RuntimeError`.
- CollisionShape3D desplazada o rotada y compuesta de varias formas: un cuerpo por nodo, sin colisiones fantasmas.
- TriMeshShape3D con malla de origen real: colisión estática conservada.
- RigidBody3D: cae y colisiona; repetir Play/Stop varias veces sin aumentar el recuento de cuerpos ni duplicar formas.
- Area3D y CharacterBody3D: sensores y movimiento originales, sin desactivar Jolt.
- Simular datos inválidos en la escena de QA: error con nombre, ID y tipo, sin Play parcialmente activo; después corregir y volver a iniciar.
- En **Escena → Clima**, habilitar tornado. Con VFX3D enlazado a `.vfx` con movimiento meteorológico y espacio Mundo, la columna debe verse **desde el inicio**. Sin VFX asignado, el campo existe pero no aparece columna automática. Repetir con objetos dinámicos y observar reacción física; S12A destructivo/agua solo si está configurado.
- Cambiar de escena, Play/Stop, Film Maker y Player exportado: sin fallos WASM ni pérdida de escenas/recursos.

## Evidencia a devolver

Log completo de runner WASM, `npm run build`, grabación corta de Play con StaticBody3D/RigidBody3D, captura de las props de Clima y VFX3D, consola de DevTools si reaparece `null function` e indicación de qué tipo de forma lo reproduce. No aceptar un simple `npm run build` como certificación de física nativa.

**Bloqueo:** S13 no puede darse por integrado mientras el runner WASM real o QA local de Play no hayan aprobado.

## QA local recibida — 30 de octubre de 2026, revisión dentro del mismo Gate

**OBSERVADO (usuario):** `npm run test:runtime-jolt-wasm` **3 PASS, 9 FAIL, 0 SKIP**; `JW-01`, `JW-02` y `JW-03` pasan. **Primer fallo JW-04:** forma desplazada; `RuntimeError: null function or function signature mismatch` en `JoltWorld._body → BodyInterface.CreateBody`. `JW-05` arroja error de memoria en `JoltWorld.dispose`, y los casos posteriores fallan ya en la construcción de `JoltWorld` con errores de memoria o tabla WASM. Esos ocho fallos posteriores no prueban ocho causas independientes: pueden ser cascada de corrupción. No declarar la causa raíz confirmada sin volver a ejecutar el WASM real. `npm run test:runtime-jolt-contract`: 106 PASS, 0 FAIL, 0 SKIP en el ordenador del usuario.

**Corrección aplicada tras este QA, todavía NO verificada nativamente:** `ShapeSettings` hijo pasa a ser propiedad del `RotatedTranslatedShapeSettings`/`StaticCompoundShapeSettings` padre cuando la operación nativa tiene éxito. El código anterior hacía `J.destroy(parent)` y luego `J.destroy(child)` con doble liberación; el ejemplo `proper_cleanup.html` de JoltPhysics.js demuestra que `AddShape` transfiere la propiedad. `shapeResult.Clear()` libera su propia referencia tras tomar `shape.AddRef()` para que la propiedad del `Shape` quede explícita. Se añadió un doble que rechaza la destrucción repetida del mismo hijo.

**Regresión después de corregir:** `npm run test:runtime-jolt-contract` = **106 PASS, 0 FAIL, 1 SKIP** (el SKIP corresponde a dependencia Three.js ausente en el contenedor); S12/S12A tornado = **101 PASS, 0 FAIL, 0 SKIP**. El runner WASM real **NO VERIFICADO después de la corrección** en este entorno. No existe evidencia para declarar Play ni tornado visual PASS.

**Prueba local exigida primero:** ejecutar el caso aislado JW-04 desde el proyecto instalado, `node --test --test-name-pattern='JW-04' scripts/test-runtime-jolt-wasm-real-corr-g001.mjs`, y posteriormente `npm run test:runtime-jolt-wasm`, antes de cualquier evaluación del Editor. Resultado de cierre requerido del runner completo: **12 PASS, 0 FAIL, 0 SKIP**, sin fallos de liberación. Si persiste el error, devolver el log del primer caso que falla y detener las pruebas dependientes, sin ocultar excepciones ni modificar Jolt 1.1.0.

**ADVERTENCIA DE CONTINUIDAD:** el log del usuario se ejecutó desde `~/Desktop/LevelForge_WEATHER_TORNADO_DESTRUCTIVE_S12A_G001_SOURCE_BASELINE`, un nombre de carpeta correspondiente a un baseline anterior. Antes de aplicar una corrección, comparar esa instalación con el SOURCE_BASELINE actual, y no sobrescribir modificaciones locales ni trabajar contra el S12A sin confirmar que incluye las revisiones del Gate.

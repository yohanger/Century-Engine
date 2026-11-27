# Century Engine — Evidencia de Corte bucle por selección

**Gate:** `CENTURY-EDITOR-MESH-S01-G001-CORR-002-SELECTION-AWARE-LOOP-CUT`  
**Entrada:** `CENTURY-EDITOR-MESH-S01-G001-CORR-001-INTEGRAL-MESH-EDIT-AND-CONSOLE-STABILITY_SOURCE_BASELINE(1).zip`  
**Estado:** IMPLEMENTADO · TEST PASS · NO COMPILADO · QA ELECTRON NO VERIFICADO · NO APROBADO · NO CERRADO.

## QA ejecutado

| Prueba | Resultado | Log |
|---|---|---|
| `node scripts/qa-suite.mjs mesh-loopcut-selection` | **65/65 PASS**, incluye 15 casos nuevos | `directed-runner.log` |
| `node --test scripts/test-mesh*.mjs scripts/test-trimesh-reference-integrity.mjs` | **285 PASS, 53 FAIL; 338 total** | `mesh-regression.log` |
| Regresión equivalente sobre el SOURCE_BASELINE anterior | **270 PASS, 53 FAIL; 323 total** | `mesh-baseline-regression.log` |
| `node scripts/qa-suite.mjs smoke` | **29 PASS, 1 FAIL**, mismo caso que baseline | `smoke.log`; `baseline-smoke.log` |
| `npm run build` | **EXIT 127: `vite: not found`** | `build.log` |
| `node --check` en JS/MJS afectados y catálogo JSON | **PASS** | comprobación directa |

Se compararon los nombres de los fallos de regresión con los del baseline: **ningún fallo nuevo**. Entre los fallos anteriores hay harnesses sintéticos que no inyectan dependencias existentes de los modales y del historial; no se modificaron esos harnesses ajenos al mecanismo de selección para hacerlos aparentar PASS.

## Cobertura dirigida

1. Sin selección de caras, conservar el anillo global.
2. Una cara seleccionada: recortar únicamente esa región, previsualizar las mismas líneas y mantener volumen/topología cerrada.
3. Dos caras vecinas: respetar sus límites con múltiples cortes y deslizamiento.
4. Arista ajena a selección: rechazar preview y operación sin alterar geometría.
5. Caras seleccionadas desconectadas: no cortar caras remotas.
6. Selección no cuadrangular: rechazar operaciones inválidas sin modificaciones.
7. Wrapper `loopCutOp()` y serialización real de `PolyMesh`.
8. Congelar selección del modal; seleccionar, deslizar y confirmar una única transacción.
9. Cancelar sin modificar geometría ni registrar historial; fuera de selección no fijar anillo.
10. 32 cortes locales, comportamiento global de modo Arista y selección completa.
11. Reconciliación de UV, colores, pesos y persistencia tras el corte local.

## QA local pendiente

- Abrir editor Electron con una malla que tenga varios cuadriláteros conectados.
- Seleccionar una sola cara, activar Corte bucle, mover el cursor a una arista de esa cara y verificar preview y corte local.
- Seleccionar dos caras contiguas y luego caras desconectadas; verificar que el corte termina al salir de la región y no se aplica a regiones remotas.
- Mover el cursor a una arista completamente externa a la selección y confirmar que no aparece preview ni se permite fijar anillo.
- Deseleccionar caras; comprobar Loop Cut global en modo Cara y Arista.
- Probar 1 y 32 cortes, desplazamiento, Escape, clic derecho, Undo/Redo, selección resultante, guardado y reapertura.
- Comprobar que sombras, colisiones y Edit Mesh permanecen operativos en Player/Play.
- Compilar con dependencias disponibles; la copia recibida no incluye Vite y no se realizó instalación de paquetes.

Todos los logs de prueba están bajo `docs/qa/evidence/CENTURY-EDITOR-MESH-S01-G001-CORR-002-SELECTION-AWARE-LOOP-CUT/`. No se ejecutaron operaciones Git.

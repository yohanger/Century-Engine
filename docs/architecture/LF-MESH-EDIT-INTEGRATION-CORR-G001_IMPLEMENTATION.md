# LF-MESH-EDIT-INTEGRATION-CORR-G001 — Implementación

Base: `LevelForge_EDITOR_CONSOLE_SCRIPT_OUTPUT_CORR_G001_CORR_001_SOURCE_BASELINE.zip`, 1.677 archivos. Autorización exacta registrada en el contrato de este Gate. Dependencias y proyectos se conservan; no se crea otro motor ni editor.

## Diagnóstico y cambio productivo

| Hallazgo observado | Causa raíz confirmada | Corrección |
| --- | --- | --- |
| Constructor real de EditSession falla al invocar `_cancelPaintStroke`; seis métodos de pintura ausentes del prototipo | `paintInputMethods` ya estaba importado, pero no estaba compuesto sobre `EditSession.prototype` | Añadir el mismo `Object.assign` utilizado por los otros mixins. Los seis nombres no colisionaban con el prototipo existente |
| Cuatro usos de `snapModalValue` en session-modal.js sin import | Referencia léxica no resuelta en el módulo productivo; el helper existente sí estaba exportado en editor/snap.js | Añadir ese nombre al import existente |

Solo cambian `src/core/mesh/session.js` y `src/core/mesh/session-modal.js`. No se modifica algoritmo de Snap, pintura, geometría, historial, navegación, render, Signals, Terreno, física ni exportación. Sin cambios de dependencias. Sin refactor.

La suite nueva carga `EditSession` y sus dependencias reales mediante Vite SSR. No elimina imports ni inyecta el helper o los métodos que faltaban. Antes del parche, 11/11 pruebas fallaron al construir la sesión o comprobar su prototipo. Después pasan las 11 y la integración final con Consola alcanza 44/44. El defecto de import se confirmó además en el código real; el primer fallo de constructor impedía alcanzarlo en el baseline sin corregir pintura.

## Límites de las pruebas

La fixture compartida emplea THREE real, PolyMesh real, store reactivo, commit, recursos vinculados e historial Undo/Redo real. Node sustituye únicamente DOM mínimo y colaboradores de viewport/sincronización/disco. No verifica GPU, Tab despachado por la aplicación, guardado físico, carga completa de proyecto ni Player en ejecución.

La comparación de cancelación verifica todos los datos geométricos y atributos serializados salvo `rev`: `PolyMesh.toJSON()` genera una revisión nueva para invalidar cachés. No se exige identidad de ese contador al cancelar, ni se elimina la comparación de pesos, UV o geometría.

La fixture Electron reutiliza el escenario real, renderer WebGL2 y OrbitControls oficial ya instalado. El runner existente `scripts/qa-electron-webgl.cjs` incorpora una opción acotada `__lfNativePointerSteps`: mueve/pulsa/suelta el ratón mediante el debugger del Electron embebido. La ruta anterior de DnD permanece intacta. La opción no actúa si una fixture no la solicita. No hay navegador externo, otro harness ni dependencias nuevas.

Three.js instalado y fijado en el proyecto: 0.186.1, licencia MIT comprobada en package.json y LICENSE. Se usa `three/addons/controls/OrbitControls.js`; no se copia ni reinventa. Renderer de prueba de 480×360 y controles se liberan al terminar. Esta sonda solo afecta QA; no hay cambio de coste de render productivo. Rendimiento visual/GPU local aún NO VERIFICADO.

## Captura de puntero: diagnóstico pendiente

OBSERVADO: existen varias llamadas productivas a `setPointerCapture`; la auditoría está en `docs/qa/evidence/LF-MESH-EDIT-INTEGRATION-CORR-G001/pointer-audit.md`. El intento Electron en autoría terminó antes de cargar la fixture por falta de X/$DISPLAY. No hay una traza del InvalidStateError histórico que identifique llamada, evento y secuencia.

INFERENCIA: el nombre de la excepción por sí solo no permite atribuirla a navegación, pintura, selección, controles numéricos o UV. Que una secuencia futura pase tampoco prueba reparada toda captura del Editor.

CAUSA RAÍZ: NO DETERMINADA. No se modifica ninguna llamada productiva ni se añaden catches para ocultar el fallo. La fixture registra stack, pointerId, botones, `isTrusted` y error real. Si la captura falla, vuelve a lanzar el error. Su secuencia acotada usa navegación derecha y OrbitControls con botón central; no sustituye QA del Editor completo.

## Estado

IMPLEMENTADO y COMPILADO Editor/Player. TEST NODE PASS. Regresión ampliada 335 PASS / 1 FAIL preexistente (CG-11 también falla en el baseline). Electron, QA local de malla y aceptación pendientes. Gate NO CERRADO. Los 11 fallos históricos de la regresión anterior permanecen diferidos; no se declara que este Gate los haya resuelto.

Consola G001/CORR-001: cierre documental por evidencia local y aprobación ya recibidas, sin repetir su QA aprobado.

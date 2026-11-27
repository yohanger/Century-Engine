# LF-MESH-EDIT-NUMERIC-SIGN-CORR-G001 — Implementación

Base: LevelForge_MESH_EDIT_INTEGRATION_CORR_G001_SOURCE_BASELINE.zip, íntegro, 1.700 archivos. Copia previa sin diferencias. Autorización exacta registrada en el contrato. Solo dos archivos de producción cambian; sin dependencias nuevas ni cambios en proyecto/runtime.

## Diagnóstico

OBSERVADO: `modalKey()` ya invierte el signo completo al pulsar `-`; no hay que recrearlo. La tecla `+` se consume sin modificar el texto en G/R/S. En `_bindKeys()`, `_numpad()` se ejecuta antes de `this.edit.onKey()`: los dígitos cambian vistas, +/− hacen zoom y Decimal encuadra en vez de entrar al gesto.

CAUSA RAÍZ CONFIRMADA: prioridad incorrecta de navegación durante un modal activo de Edit Mesh y ausencia de la operación explícita de signo positivo. La suite nueva ejecuta el dispatcher real y EditSession real; antes del parche da 8 PASS / 10 FAIL. No usa una copia del parser ni elimina sus imports. El teclado principal con `-` ya pasa antes del cambio.

## Corrección

- `src/core/editor/keys.js`: la navegación Numpad se aplica cuando no existe un modal activo de Edit Mesh. Durante el gesto las teclas continúan por la ruta existente a `edit.onKey()`. Fuera del gesto se conserva el orden anterior; las guardas de campos editables, bloqueo y Play siguen primero.
- `src/core/mesh/session-modal.js`: `+` elimina el signo negativo en G/R/S y actualiza la vista previa. No añade caracteres, no confirma, no crea Undo. `-` conserva su implementación. El `+` de bisel sigue aumentando segmentos; PageDown mantiene su función. Los límites positivos de escala siguen vigentes: `S 2 -` es inválido; `+` permite recuperar `2` antes de confirmar.

G X 10 − representa un desplazamiento de −10 en el eje elegido, no una coordenada absoluta X = −10. Confirmación/cancelación, geometría, UV/materiales, recursos vinculados e historial se resuelven por los métodos originales. No se cambian algoritmos ni transformaciones.

## QA y runner

Se extiende la fixture común `edit-session-integration-corr-g001.mjs` con enlace al `keysMethods` productivo y colaboradores de viewport que registran navegación. El DOM mínimo Node previamente local a la suite anterior se comparte allí sin duplicarlo. La suite anterior conserva sus once casos y aserciones. La fixture restablece el modo de selección por escenario para evitar contaminación entre casos.

Node sustituye únicamente el acceso de plataforma a escuchas globales por EventTarget; ejecuta el callback registrado por `_bindKeys()` y la sesión real con historial real. No prueba `isTrusted`, GPU ni el Editor completo. Se verifican teclado principal y Numpad, ejes X/Y/Z, signo previo/posterior, vacío/cero/decimales, Backspace, Enter/Escape, giro, escala inválida/recuperación, texto editable, bloqueo/Play, Snap/Shift, bisel, Undo/Redo y recurso compartido.

El runner Electron existente incorpora una ruta opcional `__lfNativeKeySteps`: 42 pulsaciones mediante el debugger del Electron embebido y comprobación posterior a cada una en la fixture. No envía eventos sintéticos `dispatchEvent` como evidencia nativa. La fixture exige eventos confiables y ubicación Numpad, con renderer WebGL2 y dispatcher real. Conserva las rutas anteriores de ratón y DnD. Sin navegador externo ni otro harness.

Los colaboradores de navegación/disco y host del editor en la fixture están acotados. No se prueba la composición visual completa de App.vue ni guardado físico. El comportamiento real en el Editor se comprueba en QA del usuario.

## Resultados y pendientes

18/18 pruebas nuevas PASS. Integración final con las suites de malla y Consola: 62/62 PASS. Regresión focal de 22 suites: 415 PASS / 1 FAIL, CG-11 preexistente, ya demostrado en el baseline anterior. No se modifica ni relaja. Editor/Player compilados con exit 0. Documentación generada y sintaxis satisfactorias.

Electron intentado en autoría: no alcanza fixture por falta de X/$DISPLAY. Sus 48 comprobaciones están preparadas, NO VERIFICADAS aquí. QA local y aceptación pendientes; Gate NO CERRADO.

La evidencia local recibida del Gate anterior se registra íntegra sin inventar aprobación manual. Menús, logo, etiquetas del visor, gizmos y docking permanecen PENDIENTES PLANIFICADOS en backlog. No están implementados en esta entrega. La captura de puntero histórica conserva su estado sin causa determinada.

# LF-NODE-SIGNALS-GODOT-UX-S04-G001_CORR-001 — Implementación y auditoría

**Fecha:** 2026-11-02 · **Estado:** IMPLEMENTADO · NODE 409/409 PASS · ELECTRON/BUILD NO VERIFICADOS · QA LOCAL PENDIENTE.

## Cambios de producción

- `SignalConnectionsPanel.vue` elimina botón genérico, campo de nombre editable y datalist. El origen del modal aparece como texto/firma de señal, sin cambio manual del identificador.
- `connectableSignals` deriva los nombres desde el catálogo nativo del **tipo seleccionado** y descubrimiento conservador de scripts del **emisor seleccionado**. No se deducen nuevos emisores desde conexiones guardadas.
- `openNew(name)` exige una señal emitible y contexto editable; las conexiones históricas no confirmadas permanecen visibles pero no crean una nueva conexión con ese mismo nombre.
- `openEdit(c)` vincula temporalmente el diálogo al `emitterId` y `signal` original. `save` verifica que el emisor no cambió, que la conexión editada todavía existe y que una nueva señal sigue estando disponible. El registro serializado mantiene `emitterId`, `signal`, `receiverId`, `method` sin otras propiedades.
- El modal enfoca primero la búsqueda de nodo receptor; el método es visible y debe publicarse mediante `node.expose()` en Play. No se introdujo otro sistema de validación/autoría.

## Regresión y compatibilidad

Las pruebas históricas S04 se adaptaron a la eliminación contractual del input `#lf-sig-name`, pasando a leer el identificador de origen desde un bloque fijo. Las fixtures Vue históricas se actualizaron a la semántica nueva; nueva suite CORR-001 verifica tipos de nodo, nombres inventados, señales antiguas, colisiones, permisos, selección y conservación del esquema. No se tocó el runtime ni `InspectorDock.vue`.

**Limitación visible:** una Custom Signal estática detectada no es prueba de emisión en Play, tal como establece S03. Los nombres antiguos que ya no tienen declaración siguen visibles y editables únicamente para conservar el historial. `animation_finished` permanece donde existe emisor real de animación de claves; no es un error por el mero nombre del nodo.

**Pendiente:** test Electron Vue, WebGL2, Jolt WASM y compilación en Linux del usuario; comparación visual del diálogo. Los ensayos de Electron y compilación en este entorno no pueden ejecutarse porque Vite no está instalado.

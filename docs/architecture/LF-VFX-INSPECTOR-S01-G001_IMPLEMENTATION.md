# LF-VFX-INSPECTOR-S01-G001 — Implementación

**SOURCE_BASELINE:** `LevelForge_EDITOR_HUB_FEEDBACK_CORR_G001_SOURCE_BASELINE(1).zip` (1.241 archivos, CRC PASS).
**Autorización:** `Listo. LF-VFX-INSPECTOR-S01-G001 autoriza comenzar`.
**Amendment:** `LF-VFX-INSPECTOR-CA-001` vincula esta corrección editorial a S00/S03.
**Estado:** IMPLEMENTADO · NODE PASS · VITE/WEBGL/PLAYER QA LOCAL PENDIENTE · NO CERRADO.

## Auditoría

- **OBSERVADO:** `VfxEditor.vue` montaba `FloatingEditorWindow`; `App.vue` lo exponía mediante `store.modal === 'vfx'`; `core/state/vfx.js` mantenía `vfxEditId` como selección adicional. `ProjectPanel.vue` activaba la ventana desde Assets.
- **OBSERVADO:** `InspectorDock.vue` ya edita Profile, Material, Liquid y GameManager como recursos; `store.projSel` identifica la selección compartida de Assets. `VfxPreviewSession` utiliza el viewport original y restaura cámara, visibilidad, frames y renderer al hacer `dispose()`.
- **CAUSA RAÍZ del defecto UX:** definición previa de una ventana exclusiva VFX y estado modal duplicado para un recurso que corresponde al Inspector. No es un problema de serialización ni render de partículas.

## Implementación concreta

1. `VfxEditor.vue`: mismo archivo original convertido en vista especializada de Inspector con `vfxId` (prop). Conservar las cinco categorías (Emisión, Nacimiento, Movimiento, Apariencia y Evolución), controles `NumberField`, `ResourceDropSlot`, curvas y el commit/Undo existente. Sin ventana flotante.
2. `InspectorDock.vue` monta `VfxEditor` en la cadena de recursos del tab Inspector; `ProjectPanel.vue` incluye `.vfx` en los recursos que abren el Inspector en selección simple; el doble clic utiliza la misma API pública `openVfxEditor`.
3. `core/state/vfx.js` conserva API y CRUD/validación, y redirige `openVfxEditor` a `store.projSel + rightTab`; `closeVfxEditor` confirma gestos pendientes y quita selección. `state.js` deja de almacenar `vfxEditId`. `App.vue` deja de montar la ventana VFX. `objects.js` permite regresar al Inspector de escena al seleccionar un objeto.
4. Previsualización desactivada por defecto; al solicitarse crea `VfxPreviewSession` temporal en el viewport existente. Limpieza al cerrar, cambiar pestaña/recurso, bloquear, modificar escena o entrar en Play. Mantiene pausa, paso, reinicio y restauración.
5. `tornadoFlow` permanece en esquema/serialization/runtime para los proyectos anteriores (sin nueva opción de autoría meteorológica). El contrato S12 se actualiza a CA-001 sin suprimir la comprobación de legado.
6. QA automatizado: **232/232 Node PASS**, nuevo runner con pruebas de contrato/instancia UI, harness de navegador Vue/Vite/WebGL S03 adaptado al Inspector, regresiones históricas con aserciones de ubicación actualizadas.

## Límites

- La edición de `tornadoFlow` ya no está expuesta en la interfaz; el flujo completo de configuración de un tornado nuevo requiere S02, que tendrá su propia corrección aprobada del clima/scripting. No se promete que S01 haya automatizado el tornado.
- El harness Vue/WebGL requiere Vite, Chromium y WebGL reales. En el entorno de implementación sin `node_modules`, su ejecución queda NO VERIFICADA; los tests Node con dependencias sustituidas no acreditan el comportamiento visual.
- Jolt WASM sigue pendiente de verificación, por lo que la compatibilidad Player exige evidencia separada. No se modifica ni se oculta ese estado.

## Siguiente acción

Usuario ejecuta `npm ci`, `npm run test:vfx-inspector`, `npm run test:vfx-inspector:ui`, `npm run build`, `npm run electron`; compara QA visual, devuelve logs/capturas; solo entonces aprobar y cerrar S01. Continúa S02 tras nueva declaración de Gate.

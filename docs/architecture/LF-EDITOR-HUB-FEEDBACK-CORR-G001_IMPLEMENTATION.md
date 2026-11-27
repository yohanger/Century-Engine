# LF-EDITOR-HUB-FEEDBACK-CORR-G001 — Notificaciones propias del HUB

**Autorización exacta:** `Listo. LF-EDITOR-HUB-FEEDBACK-CORR-G001 autoriza comenzar`.
**SOURCE_BASELINE de entrada:** `LevelForge_EDITOR_VIEWBAR_NAV_DEVICE_CORR_G001_SOURCE_BASELINE.zip`.
**Contratos vinculantes:** `LF-EDITOR-HUB-S02-G001_CONTRACT.md`, `LF-EDITOR-HUB-POLISH-G001_CONTRACT.md`, protección de proyecto abierto y formatos actuales.
**Estado:** IMPLEMENTADO · TEST NODE PASS · QA LOCAL NO VERIFICADO · NO CERRADO.

## Diagnóstico

- **OBSERVADO:** `WelcomeScreen.vue` trataba excepciones con un `toast` temporal, no revisaba falsos resultados y no recuperaba la bandera `loading` si fallaba `db.listProjects` o `db.getLoc`.
- **OBSERVADO:** `toast()` en `src/core/state/state.js` duplicaba el mensaje en `store.log` independientemente de que el Editor estuviera bloqueado por el HUB.
- **OBSERVADO:** `openRecent` y `openLfprojDialog` comunican algunos rechazos mediante `toast()` y retorno `false`, mientras `duplicateProject` devolvía `undefined` cuando el registro había desaparecido.
- **CAUSA RAÍZ:** faltaba una representación de error propia de la vista y la separación de notificaciones operativas durante `store.locked`.

## Mecanismo implementado

1. `WelcomeScreen.vue` conserva los flujos de proyectos existentes, la seguridad de borrado y los controles del HUB. Añade `hubNotice` **local** y un banner persistente con `role=alert`, mensaje específico de operación, detalle devuelto por la capa original, cierre accesible y actualización de lista únicamente cuando corresponde.
2. `guard()` distingue excepciones, `false`, avisos `error/warn` realmente nuevos de la operación y cancelaciones. No convierte un diálogo cancelado en error, no declara éxito si hay excepción o retorno explícito fallido y restablece `busy` en `finally`.
3. `refresh()` controla `loading` en `finally`, conserva los proyectos anteriores si falla, comunica la causa y permite reintentar sin duplicarlos.
4. `toast()` sigue alimentando `store.toasts`; solo evita la incorporación a `store.log` cuando `store.locked` es verdadero. Los avisos del Editor desbloqueado y las excepciones técnicas (`console.error` / DevTools) se conservan. No se crea otro logger.
5. `duplicateProject` indica explícitamente `false` ante proyecto inexistente y `true` al concluir; mantiene los efectos y su API para consumidores que ignoran el valor. No se ha modificado la base de datos, las rutas ni los formatos.

## Límites y verificación

- La comunicación utiliza la información existente: no diagnostica automáticamente permisos que la capa de disco silencie ni reconstruye archivos corruptos.
- El HUB muestra un aviso persistente por operación fallida. No convierte un cierre voluntario del selector o de la confirmación en fallo.
- Las pruebas ejecutan el script real del componente con dependencias simuladas, además de tests estructurales y de contratos; no equivalen a verificar render Vue, clics reales de Electron, accesibilidad mediante lector de pantalla o disco nativo.
- El QA visual/funcional local y la compilación Vite siguen pendientes si no se pueden ejecutar en el entorno de entrega.

Ver `docs/qa/LF-EDITOR-HUB-FEEDBACK-CORR-G001_QA.md`.

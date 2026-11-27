# QA — LF-EDITOR-HUB-FEEDBACK-CORR-G001

**Estado:** IMPLEMENTADO · TEST AUTOMATIZADO PASS · QA LOCAL PENDIENTE · NO CERRADO.

## Evidencia automatizada

- `node --test scripts/test-editor-hub-feedback-corr-g001.mjs`: **26/26 PASS**, 0 FAIL, 0 SKIP. Incluye ejecución del código de `WelcomeScreen.vue` con dependencias controladas, errores persistentes, cancelaciones, errores devueltos por `toast`, refresco con fallo y recuperación, avisos duplicados y protección de proyectos.
- `npm run test:editor-hub-feedback`: regresión de HUB S02, pulido UX, plantillas y seguridad, junto al Gate actual. **91/91 PASS, 0 FAIL, 0 SKIP**, ejecutado sobre el SOURCE_BASELINE de trabajo.
- El control `store.locked` se prueba con la función `toast()` extraída del código original; la prueba exige que el HUB no escriba `store.log` y que el Editor desbloqueado sí lo haga.
- Compilación Vite/Electron y QA visual local: **NO VERIFICADOS** hasta contar con evidencias de ejecución.

## QA local obligatorio

1. Iniciar HUB en Electron y comprobar que la lista aparece sin quedarse en «Cargando…».
2. Intentar abrir un proyecto recientemente eliminado o inaccesible: el aviso permanece visible, explica el rechazo y no requiere DevTools.
3. Seleccionar una carpeta sin `project.lfproj`, un archivo `.lfproj` inválido y un JSON corrupto; confirmar que cada mensaje corresponde a su operación y que el HUB sigue operativo.
4. Denegar permisos a la ubicación del proyecto; comprobar aviso explicativo y ausencia de cambio de proyecto.
5. Cancelar selector de carpeta, selector de archivo, selección de ubicación para crear y confirmación para quitar: **no debe aparecer un error falso**.
6. Provocar o simular fallo de lectura de la biblioteca; la lista anterior permanece y aparece **Actualizar lista**. Reintentar tras recuperarse sin duplicar proyectos.
7. Duplicar o eliminar un proyecto ausente, y tratar de eliminar el proyecto activo: el HUB muestra causa y respeta protección.
8. Abrir un proyecto válido, crear uno, importar correctamente y quitar uno inactivo; no debe aparecer un error de éxito falso.
9. Abrir la consola del Editor: errores operativos del HUB no deben contaminar `ConsolePanel`; errores del Editor y diagnósticos en DevTools deben conservarse.
10. Comprobar banner con teclado, botón Descartar aviso, ancho de ventana reducido y estilos del HUB existentes. Registrar capturas, logs y resultado compilado.

**Cierre:** únicamente tras compilación y QA local real con aprobación explícita. Los tests con dependencias simuladas no prueban IO de archivos, accesibilidad real o recuperación de todos los errores posibles.

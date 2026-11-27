# LF-EDITOR-SPLASH-CORR-G001-RUNTIME-ONLY — Ejecución y QA

**Fecha:** 2026-11-16  
**Autorización:** `Listo. LF-EDITOR-SPLASH-CORR-G001-RUNTIME-ONLY autoriza comenzar`  
**Fuente de trabajo:** `levelforge_sourcebaseline.zip` recibido en la conversación.  
**Resultado contractual:** IMPLEMENTADO en fuentes; TEST ESTÁTICO PASS; COMPILADO/QA ELECTRON/QA RUNTIME: NO VERIFICADOS; aprobación/cierre: PENDIENTES.

## Objetivo acotado

- Eliminar el branding inicial del Editor cuando un usuario crea o abre un proyecto desde el Hub, manteniendo su progreso visible.
- Retirar de Electron Editor la superficie exclusiva `lf:editor-splash`, `window.lf.editorSplash`, su configuración `[splash]` y el texto obsoleto en Preferencias.
- Mantener inalterada la implementación del splash de Runtime, su exportación AppImage, la imagen de marca, y el flujo de las escenas del juego.
- No modificar `editor.toml` personales preexistentes: se aceptan sus claves `[splash]` como datos inertes y no se reescriben.

## Implementación concreta

1. `App.vue`: retiró `BrandingSplash`, lectura de imagen por IPC y variables asociadas; conserva la gestión de montaje/desmontaje y `LoadingScreen` con `showArtwork=false`.
2. `core/editor/project-loading.js` y `core/state/project.js`: retiraron la espera de 850 ms y el argumento `brand`, sin tocar fases de progreso y limpieza de estado.
3. `components/LoadingScreen.vue`: parámetro opcional `showArtwork` (default `true`) para conservar presentación gráfica de Runtime sin desplegarla en el Editor.
4. `electron/editor-config.cjs`, `editor.toml`, `main.cjs`, `preload.cjs`, `PreferencesModal.vue`: sin configuración ni IPC de splash en el Editor; apariencia restante preservada.
5. `scripts/test-editor-startup-config.mjs`: expectativas actualizadas sobre la configuración del Editor. Los tests del splash que ahora quedan en ese runner comprueban utilidades compartidas del Runtime.
6. `scripts/test-editor-splash-runtime-only-g001.mjs`: runner estático autocontenido nuevo.
7. `docs/qa/LevelForge_DB_Ledger.xlsx`: se añadieron entradas de seguimiento en las seis hojas, sin borrar el historial.

## Evidencia disponible

- `node --test scripts/test-editor-splash-runtime-only-g001.mjs`: **4 PASS, 0 FAIL**. Incluye Editor sin branding, carga de proyecto sin espera de splash, retiro IPC/config editorial, y permanencia de Runtime.
- `node --check` de `electron/editor-config.cjs`, `electron/main.cjs`, `electron/preload.cjs`, `src/core/editor/project-loading.js`, `src/core/state/project.js`, `scripts/test-editor-startup-config.mjs`, `src/engine/runtime/loading-progress.js`, `src/runtime-app/storage.js`, `electron/runtime/main.cjs`: **PASS (9 comprobaciones sintácticas, no compilación)**.
- Revisión estática: `RuntimeApp.vue`, `electron/runtime/main.cjs`, `electron/appimage.cjs`, `BrandingSplash.vue` y `beginBrandSplash()` siguen presentes y conservan sus referencias funcionales.

## Pruebas no realizadas y bloqueos

- `npm ci --ignore-scripts --no-audit --no-fund --prefer-offline` se intentó, pero la red no resolvió `registry.npmjs.org`: errores `EAI_AGAIN` en los registros npm. Se detuvo la instalación; `node_modules` incompleto no constituye evidencia de instalación satisfactoria.
- `node --test scripts/test-editor-startup-config.mjs`: **BLOQUEADO**, error `ERR_MODULE_NOT_FOUND` para `vue` por la instalación incompleta. El test funcional no ha pasado ni fallado por motivos de código de esta corrección: **NO VERIFICADO**.
- `npm run build`, empaquetado Electron, apertura/creación de proyecto en Electron, arranque de Runtime exportado, carga con imagen personalizada y QA visual: **NO EJECUTADOS / NO VERIFICADOS**. No se ha generado AppImage.

## QA local requerido antes de cerrar

1. Restaurar dependencias (`npm ci`) en el entorno del usuario; ejecutar `node --test scripts/test-editor-startup-config.mjs scripts/test-editor-splash-runtime-only-g001.mjs`.
2. `npm run build`; `npm run electron`; verificar apertura/creación desde Hub: progreso sin logo y sin espera artificial, Editor funcional.
3. Verificar `editor.toml` previo con `[splash] enabled = true`: Editor sigue sin splash; las preferencias personales permanecen intactas.
4. Exportar juego Runtime con splash configurado y sin él; verificar imagen, progreso y transición, sin diferencias de comportamiento respecto a baseline. Revisar consola de Electron por errores.
5. Registrar resultados reales y pedir aceptación del usuario; **no declarar APROBADO ni CERRADO sin evidencia**.

**Observación:** `dist-runtime/` se mantiene byte a byte según ZIP de origen; no hay rebuild en el entorno de preparación. La salida de build no debe incorporarse al CHANGE ZIP sin requerimiento explícito.

# LF-EDITOR-MENUS-UX-S01-G001-INTEGRAL · Plan QA para usuario

## Preparación

Extraer `SOURCE_BASELINE` como proyecto completo en un directorio de trabajo **nuevo**. No sobrescribir escenas, proyectos locales, cachés del usuario ni una instalación modificada sin comparación previa. Si se elige aplicar `CHANGE` a la copia exacta de `lf(6).zip`, extraer las rutas relativas en la raíz del proyecto, reemplazando únicamente las rutas enumeradas en el inventario. Mantener el SOURCE_BASELINE actualizado como entrada del siguiente Gate.

El proyecto excluye `node_modules`, builds locales y caches. En Linux, desde la raíz del proyecto:

```bash
npm ci
node --test scripts/test-editor-menus-ux-s01-g001-integral.mjs scripts/test-editor-menubar-ux-g001.mjs scripts/test-editor-menubar-ux-g001-corr-001.mjs scripts/test-add-menu.mjs scripts/test-editor-add-menu-corr-g001.mjs scripts/test-editor-addmenu-categories-corr-g001.mjs
node --test scripts/test-editor-menus-ux-s01-g001-integral-electron.mjs
npm run build
npm run electron
```

El runner Electron necesita servidor Vite (lo inicia el runner), instalación Electron, pantalla local y GPU/WebGL conforme al equipo. No usa Brave ni Chromium externo. Los tests Node deben marcar 62 PASS/0 FAIL/0 SKIP si el entorno coincide. La compilación debe terminar sin exit distinto de cero. Para abrir el editor, `npm run electron`; `Ctrl+C` detiene el proceso.

## Prueba manual (devolver PASS/FAIL por caso)

- M01: sin logotipo geométrico en barra, pero Archivo/Editar/Añadir/Ver/Juego/Ayuda siguen visibles y accesibles.
- M02: abrir Archivo, cambiar a Editar mediante hover, seleccionar acciones válidas y volver a cerrar. Reabrir y cerrar la misma etiqueta con un segundo clic.
- M03: submenús a derecha e izquierda cerca de bordes, sin recortes, sin velo azul y sin bloquear la UI cuando se cierra por clic exterior.
- M04: flechas arriba/abajo e Inicio/Fin recorren opciones; Derecha abre rama, Izquierda regresa, Intro/Espacio ejecuta la opción, Escape cierra. Los elementos deshabilitados no deben ejecutarse.
- M05: Shift+A en vista normal; categorías, búsqueda con tildes, nodos anidados y creación real. Comprobar preferencia «Siempre dentro del seleccionado» y modo Edit Mesh sin alterar creación.
- M06: respuesta visual al abrir/cerrar, selección gris sin parpadeos, texto y atajos legibles; comprobar a 1366×768 y 1024×600, y si procede, movimiento reducido.
- M07: menús vía clic derecho en jerarquía, Inspector, Assets y viewport; un clic fuera debe cerrar sin dejar capas o comandos enganchados.
- M08: proyecto existente abre, guarda y funciona en Play; no debe haber cambios de contenido de escenas/Player respecto de la base.

## Evidencia requerida para cierre

Resultado de comandos Node, Electron y build (salidas/errores completos), capturas visuales de barra, submenú abierto y Añadir, y resultados M01–M08 con cualquier fallo reproducible. Tras QA local exitoso y aprobación expresa, se actualizará el ledger y podrá declararse cerrado. Antes: **NO VERIFICADO / NO CERRADO**.

## Incidencia local MENU-E01 y corrección en el mismo Gate

El usuario ejecutó el runner Electron el 2026-11-02: **0/1 PASS, 1 FAIL**. Pasaron cinco comprobaciones previas; falló «Aparición activa» por una aserción de igualdad exacta del nombre de animación. Se ha corregido el fixture de QA, **no** la UI productiva. La salida del runner ahora informa los valores calculados de las dos animaciones (incluido `reducedMotion`), para distinguir nombres scoped de ausencia real de animación. **La reejecución Electron sigue pendiente; no se puede registrar PASS.**

Comandos de revalidación: ejecutar el mismo `node --test scripts/test-editor-menus-ux-s01-g001-integral-electron.mjs` sobre el SOURCE_BASELINE corregido. Debe superar **18 checks**. Devolver la salida completa, especialmente el objeto `animations` que muestra `animationName`, `animationDuration` y `reducedMotion` de Menú y Añadir. Después ejecutar `npm run build` y verificar M01–M08 visualmente. Si vuelve a fallar, enviar los campos `detail` del check fallido. Conserva copia de tu proyecto anterior; no extraigas CHANGE sobre un proyecto con modificaciones locales sin comparación.

## Cierre por evidencia posterior · 2026-11-02 (incorporado en S02)

Se conserva íntegramente el fallo `MENU-E01` y la corrección histórica del fixture. La reejecución aportada por el usuario sobre **S01 CORR-001** registra **Electron 1/1 PASS, 18/18 verificaciones**, `menu-appear-fd307f1c` (0.115 s) y `add-menu-appear-f9c41c94` (0.13 s), con `reducedMotion=false`. El log aportado confirma `npm run build` **Editor PASS (819 módulos)** y **Player PASS (414 módulos)**. Las advertencias de chunks e imports mixtos no bloquean la compilación. `npm run electron` aparece iniciado, sin registro automático de render GPU. El usuario declaró «Aprobado. Sigamos», que se registra como QA LOCAL PASS declarado y APROBADO, sin afirmar capturas o mediciones visuales no recibidas. Ruta: `docs/qa/evidence/LF-EDITOR-MENUS-UX-S01-G001-INTEGRAL/electron-user-pass-build.log`.

**Estado S01 tras esa evidencia:** APROBADO, QA LOCAL PASS declarado, cierre documental registrado en el ledger al comenzar S02. La incidencia histórica sigue rastreable y no se reescribe como si nunca hubiese ocurrido.

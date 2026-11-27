# LF-EDITOR-UX-G001-HUB-RETURN-AND-VIEWPORT-GIZMOS — Evidence & QA

**Fecha:** 2026-11-16
**Autorización literal:** `Listo. LF-EDITOR-UX-G001-HUB-RETURN-AND-VIEWPORT-GIZMOS autoriza comenzar`
**Baseline de entrada:** `LF_EDITOR_SPLASH_CORR_G001_RUNTIME_ONLY_SOURCE_BASELINE.zip`
**Estado:** IMPLEMENTADO · TEST NODE PASS · COMPILACIÓN Y QA LOCAL NO VERIFICADOS · PENDIENTE DE APROBACIÓN

## Objetivos y contrato

1. Archivo → **Volver al Hub**: reutiliza `file.close` → `lockEditor()`; si hay carpeta asociada, confirma con `saveAll()` (disco + IndexedDB), y si el proyecto es solo IndexedDB conserva el guardado `saveNow()` sin forzar selector de carpeta. Si el guardado falla, se mantiene el Editor abierto. Se detiene Play y se cierra pintura con el flujo ya existente.
2. Viewport, borde derecho de la barra de escena → **Gizmos**: interruptor global y visibilidad por categorías (Cámaras, Luces, Audio, Colisiones y físicas, Triggers y volúmenes, Otros auxiliares). Reutiliza `store.menu`, `ContextMenu` y `MenuList`. Persistencia en las preferencias locales existentes.
3. La visibilidad afecta solamente a auxiliares de autoría existentes; Mover, Rotar, Escalar, la selección, el modelo de objetos, proyectos y Runtime conservan sus responsabilidades.

## Implementación

- `src/core/commands.js`: etiqueta y disponibilidad de `file.close`.
- `src/core/state/project.js`: `lockEditor()` confirma disco/IndexedDB si existe carpeta, sin modificar el cierre existente para proyectos solo IndexedDB; no se crea un flujo duplicado.
- `src/components/ViewBar.vue`: botón en barra de escena, menú contextual reutilizado, checks globales/categorías y acciones `keep`.
- `src/core/editor/gizmo-visibility.js`: catálogo y evaluación central de categorías sin dependencias gráficas ni serialización en escena.
- `src/core/state/state.js` y `src/components/PreferencesModal.vue`: preferencias locales, valores predeterminados y restablecimiento.
- `src/core/editor/selection.js`: aplica máscaras a `editorGizmos`, iconos editoriales, ayudas de navegación y handles de colisión; no modifica los TransformControls.
- `src/core/editor/keys.js`: observación de preferencias y repintado inmediato sin reconstruir objetos.
- `src/core/editor.js`: reaplica máscaras tras el `applyView` heredado, para que otros controles no reactiven ayudas ocultas.
- El icono/frustum de `Camera3D` se filtra en `selection.js`, sin modificar el constructor de nodos ni el código Runtime.
- `scripts/test-editor-ux-hub-gizmos-g001.mjs`: pruebas del Gate.

## QA reproducible (en la máquina del usuario)

```bash
node --test scripts/test-editor-ux-hub-gizmos-g001.mjs scripts/test-editor-splash-runtime-only-g001.mjs scripts/test-editor-viewbar-ux-g001.mjs scripts/test-editor-viewbar-nav-device-corr-g001.mjs scripts/test-editor-hub-s02-g001.mjs scripts/test-project-safe.mjs
npm run build
npm run electron
```

**Node:** 62/62 PASS (10 nuevas del Gate + 52 regresiones existentes). Ejecutado aquí con Node v22.16.0; comando y salida conservados en esta evidencia.
**Sintaxis:** `node --check` en los módulos JS editados: PASS.
**Build:** NO VERIFICADA: faltan dependencias instaladas y caché local Vite.
**Electron embebido:** NO VERIFICADO; el usuario debe validar visualmente navegación y estado del proyecto.
**AppImage/Runtime exportado:** NO VERIFICADO; no se ha sustituido ni eliminado su splash ni su renderizador.

### Lista visual de aceptación

- Abrir proyecto, modificarlo y usar Archivo → Volver al Hub: el guardado debe confirmarse, el Editor debe desmontarse y el Hub debe mostrarse; el proceso Electron permanece abierto.
- Provocar fallo de guardado: no abandonar el Editor. Un proyecto solo IndexedDB no debe abrir un selector de carpeta al salir.
- Abrir otro proyecto: observar jerarquía, Inspector y viewport reconstruidos normalmente.
- En Escena, desplegar Gizmos y desactivar «Mostrar gizmos»: desaparecen los iconos y guías auxiliares disponibles, pero las mallas renderizables y el control Mover/Rotar/Escalar siguen funcionando.
- Activar global y desactivar, por separado, Cámara, Luz, Audio, Colisiones, Triggers y Otros; comprobar selección y restablecimiento.
- Con gizmos desactivados alternar rejilla/luz/vistas: la máscara no debe reaparecer.
- Salir a Hub/reabrir proyecto y reiniciar Editor: preferencias de gizmos persistentes.
- Entrar en Play y detener: sin cambios en visuales del juego, cámara ni física, con restitución editorial.

**Conclusión:** el código y las pruebas automatizadas están entregados; QA visual, compilación y cierre del Gate requieren pruebas y aprobación del usuario.

## Resumen de salida Node (ejecutada)

```
1..62
# tests 62
# suites 0
# pass 62
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 181.704184
```

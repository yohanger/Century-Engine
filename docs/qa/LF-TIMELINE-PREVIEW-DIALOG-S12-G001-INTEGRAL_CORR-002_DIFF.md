# LevelForge — S12-G001 CORR-002 · DIFF y mecanismo

## Problema de producción — montaje reactivo de App.vue

**Antes:** `<DialogPreview v-if="!store.play.on && timelinePlayback.active && timelinePlayback.dialog.value" ...>`.

`timelinePlayback.active` consulta `events.active` (dato no reactivo). En un render inicial falso evita leer `dialog.value`; Vue no registra esa dependencia y puede no dibujar la interfaz al llegar el mensaje.

**Después:** `<DialogPreview v-if="!store.play.on && timelinePlayback.dialog.value" ...>`.

Se utiliza el `ref` real de sesión y la protección original `!store.play.on`. `TimelineEventPreview` y `playback-session` siguen siendo dueños del transporte y de la limpieza. Cuando el mensaje se borra, Vue desmonta `DialogPreview` y `UiRoot` sin mantener residual el cuadro del Editor. No se cambia el `linger` del Runtime ni Player.

## Problema de QA — fixture no equivalente al Editor

**Antes:** la fixture montaba permanentemente `DialogPreview` y verificaba ausencia inmediata del `data-role="dialog"` tras Seek; por ello chocaba con `UiManager.linger`.

**Después:** la fixture monta el mismo componente solo cuando `dialog.value` es verdadero, comprobando inicio sin overlay, montaje al llegar texto, texto real y color `C[2]`, Pause/Resume, desmontaje después de Seek y también Stop durante un nuevo diálogo activo.

## Prueba histórica adaptada, sin ocultar fallos

En `scripts/test-timeline-preview-dialog-s12-g001.mjs`, caso **S12-G001-05**, una sola expresión que requería el guard no reactivo `timelinePlayback.active` pasa a exigir el guard `timelinePlayback.dialog.value`. La cobertura de sesión única, registro de contexto y enlace al reloj se conserva. La evidencia de esa prueba desactualizada se conserva en los logs de CORR-002.

## Fuera de alcance

No se cambian UiManager, UiRoot, `DialogPreview.vue`, Player, proyectos ni Assets. No se modifica el runner, no se incorporan scripts de verificación `.sh`, no se crean managers nuevos ni nuevos canvases.

# LF-TIMELINE-PREVIEW-DIALOG-S12-G001-INTEGRAL — Implementación

Fecha de generación: 2026-11-07. Base: SOURCE_BASELINE G006 aprobado por el usuario.
Estado: IMPLEMENTADO EN FUENTES; QA ELECTRON/COMPILACIÓN/QA VISUAL NO VERIFICADOS. Gate no cerrado.

## Objetivo y contrato

Cuando se ejecuta un comando seguro `text` desde Timeline Preview, mostrarlo en el viewport del Editor mediante el **mismo** `UiManager` y `UiRoot` que presenta el Player y la vista previa de comandos del editor. No crear caja de texto específica del Timeline. Preservar la sesión única en Editor, Undo/Redo, datos del proyecto y aislamiento de los comandos.

## Recorrido

- `TimelineEventPreview.start()` conserva el intérprete `Game` aislado; el `host.say` emite `onDialog` con `speaker`, `text` ya resuelto, `pos` y `anim`. `onCaption` histórico permanece como callback de compatibilidad, pero ya no genera UI dentro del panel.
- `createTimelinePlayback()` mantiene `dialog` reactivo en la sesión única del Editor con instante `at` vinculado al Runner. Stop/Seek, reinicio y fin limpian la representación; cambio de pestañas no destruye la sesión.
- `App.vue` monta `DialogPreview.vue` en modo `inline` encima del viewport, nunca encima de las pistas. El modo modal original del inspector sigue disponible.
- `DialogPreview.inline` reutiliza `UiManager`, `UiRoot`, las interfaces de diálogo del proyecto o sistema, tema, textcodes y recursos visuales ya resueltos. La escritura avanza según `timelinePlayback.time`, por lo que Pause no sigue escribiendo.
- Solo se activan los roles Canvas `dialog` y el slot de diálogo. El modo inline desactiva la interacción y el código `setup` de los documentos UI (`UiManager.host.previewReadOnly`), sin alterar su ejecución en Player.
- Se retira la caja auxiliar y su CSS de `TimelinePanel.vue`.

## Límites

La simulación no usa la máquina de avance interactivo del Player (`await say` requeriría la entrada del jugador, contraria al Preview de transporte automático). Los diálogos se presentan visualmente y conservan sus parámetros; una clave nueva sustituye la anterior. `voice` sigue bloqueado por la whitelist por no ser aislable.

Ninguna migración, escritura de escena, modificación persistente, assets nuevos, sustitución de UI, reproducción de scripts, cambio de AudioEngine/Player, efectos, zoom ni recorte de audio.

## Verificación y deuda

Suite S12: 10 PASS / 0 FAIL.
Regresión focal compatible: 123 PASS / 4 SKIP / 0 FAIL (127 pruebas).
Regresión ampliada: 123 PASS / 4 SKIP / 1 FAIL de carga (`vue` ausente en entorno de generación), que no demuestra un defecto de producción.
Electron embebido: fixture nueva preparada, no iniciada (`vite` no instalado). Build Editor/Player: NO VERIFICADO (`vite: not found`).
QA de usuario, Canvas personalizado real y Player real: NO VERIFICADOS. El cierre G006 fue incorporado como aprobación declarada del usuario, sin elevar a PASS los tests faltantes.

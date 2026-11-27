# LevelForge · S13-G008-G001 CORR-002 · Cierre visual de Timeline e Inspector

**Autorización literal:** `Listo. LF-TIMELINE-VISUAL-UX-S13-G008-G001-INTEGRAL_CORR-002 autoriza comenzar`.
**SOURCE_BASELINE de entrada:** `LF_TIMELINE_VISUAL_UX_S13_G008_G001_INTEGRAL_CORR001_SOURCE_BASELINE.zip`, validado antes de los cambios.
**Contrato:** G008-G001 visual integral, CORR-001 CSS fixture, UX global de Inspector y separación entre Timeline y Cinematics de FilmMaker. Ningún cambio al modelo de clips o al Player.

## Evidencia y diagnóstico

**Observado en QA del usuario:** Node 23/23 PASS; fixture Electron 54/54 PASS, WebGL activo; `npm run electron -- --build` compila Vite 848 módulos en producción, con advertencias no bloqueantes. La captura del usuario aún muestra el encabezado «Cinemática» encima del indicador de plegado y un párrafo documental al final del Inspector; las superficies de controles/pistas de Timeline continúan con grises de estilo anterior.

**Código auditado:** `src/styles.css` establece `.sect > header` con `padding-left:22px` y posiciona la flecha a `left:8px`. La regla scoped de `TemporalResourceInspector.vue` imponía `padding:7px 9px`, invadiendo el espacio reservado. El párrafo instructivo pertenecía a la rama `part === 'resource'`. En `TimelinePanel.vue` persisten reglas de mayor especificidad como `.pinned-row:nth-child(even) .head` y `.pinned-row .head.on` y fondos grisáceos de modos/controles, que prevalecen sobre los tokens añadidos al final de G008-G001.

**Causa raíz:** sobrescritura CSS de la reserva de flecha y coexistencia de estilos heredados con reglas de tema. No se detecta un defecto del modelo temporal, persistencia, audio ni selección.

## Implementación autorizada

1. En `TemporalResourceInspector.vue`, conservar la estructura `.sect > header` y reservar `22px` en la izquierda. El encabezado sigue siendo plegable, con min-height 28px y superficie `var(--g-800)`.
2. Retirar exclusivamente el párrafo informativo «Selecciona una pista o clave…» de la rama de recurso Timeline/animación; no se eliminan parámetros, eventos ni avisos de cámara, validación y recurso ausente.
3. En `TimelinePanel.vue`, sobrescribir solo superficies heredadas: columna fija, filas pares, selección de pistas, modos de edición, botón Añadir pista, Vista previa, Snap y scrollbar de toolbar con los tokens `--g-*`, `--hair`, `--blue`, `--blue-wash` y `--text-*` del editor. El resaltado de selección permanece distinguible.
4. Conservar las coordenadas de la regla, el cabezal, Snap, el tiempo cero y los segmentos. No se trasladan clips, se manipulan datos ni se instancian gestores nuevos.
5. Añadir prueba Node focal `VIS-CORR002-01..14` y fixture Electron embebida de **19 comprobaciones nuevas** en Inspector y Timeline reales. Conservar sin cambios la fixture Electron anterior de **54 verificaciones**.

## Límites técnicos y deuda diferida

No se modifica Player, `src/core/timeline`, audio, Timeline playback, Cine/FilmMaker, Assets, InspectorDock, ParamForm, Icon ni `src/styles.css`. No se reemplaza el título semántico «Cinemática» en esta corrección. El padding real de tiempo cero, orden LIFO persistente, recorte dual de audio, anchos temporales y automatización multipista requieren Gates funcionales separados.

**Estado del Gate:** IMPLEMENTADO, Node PASS, Electron y build de este cambio NO VERIFICADOS en preparación por falta de Vite. QA local usuario PENDIENTE; no declarar FIXED/READY/CERRADO.

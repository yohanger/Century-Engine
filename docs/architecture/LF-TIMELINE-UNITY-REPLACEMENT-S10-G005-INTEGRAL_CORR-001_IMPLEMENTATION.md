# LF-TIMELINE-UNITY-REPLACEMENT-S10-G005-INTEGRAL_CORR-001

Estado: **IMPLEMENTADO EN FUENTES; QA LOCAL PENDIENTE**.

## Baseline, autoridad y alcance

- Fuente: `LF_TIMELINE_UNITY_REPLACEMENT_S10_G005_INTEGRAL_SOURCE_BASELINE.zip` (G005 no aprobado).
- Autorización exacta: `Listo. LF-TIMELINE-UNITY-REPLACEMENT-S10-G005-INTEGRAL_CORR-001 autoriza comenzar` (2026-11-07).
- La declaración CORR-001 revisada sustituye íntegramente a la propuesta anterior. Responsive First es condición de aceptación.
- No se modifica FilmMaker, Player, Inspector externo ni el evaluador de animación. Se conserva el único Timeline, el historial `commit()` y los IDs de pistas, clips y claves.

## Cambios

1. `TimelinePanel.vue`: se suprime la etiqueta interna redundante; el selector permanece y `Vista previa` se ubica arriba. La toolbar utiliza un único `overflow-x:auto`, con foco y scrollbar. Los controles de Snap/zoom no desaparecen en paneles estrechos.
2. `TimelinePanel.vue`: el cuerpo de cada clip real arrastra el intervalo; una asa exterior independiente redimensiona su extremo derecho. Todos los segmentos de pistas animadas muestran un asa para redimensionar (si son editables). Las claves de cámara/nodo se apartan a una franja superior para reducir interferencia. El fin del Timeline se representa con un punto amarillo accesible mediante teclado, no una barra completa.
3. `TimelineCurveEditor.vue`: doble clic **cerca de una curva** inserta una clave en el canal y tiempo del cursor; Snapping respetado. La pose de los demás canales proviene del evaluador compartido. La clave se selecciona, actualiza el Inspector y se guarda por el historial existente.
4. `curves.js`: `insertTimelineCurveKey()` valida pista editable, intervalo entre claves, duplicados, duración, escala y FOV; inserta en `track.keys` con `newKey()/sortKeys()`. No genera una representación separada.
5. `TimelineCurveEditor.vue`: eliminación por Supr sobre una clave enfocada o botón «Eliminar clave». Reutiliza `deleteTimelineSelection()`, que protege las referencias `clip.from`/`clip.to`.
6. `TimelineCurveEditor.vue`: dimensiones reales del SVG por `ResizeObserver`, geometría de ejes/ticks y escalas dinámica. En pantalla estrecha, las herramientas siguen accesibles; la gráfica y los controles Bézier se reorganizan verticalmente.

## Distinciones de contrato

- **Clip real:** intervalo persistente `track.clips` con `duration`, modificable. **Segmento derivado:** tramo entre dos claves; se redimensiona mediante su clave final. **Evento discreto:** comando/naturaleza/método sin intervalo de clip propio, por lo que no se inventa duración redimensionable. **Física horneada:** solo lectura.
- Insertar en un tramo no convierte claves ni recrea clips; las referencias por ID existentes sobreviven. El usuario puede editar valores de claves usadas como fuente sin desplazar su tiempo, según G005.
- La línea interpolada y los puntos no constituyen un nuevo evaluador: son una visualización del runtime de Timeline. La inserción requiere una proximidad de 12 unidades de la curva y un tiempo interior a un segmento.
- No se crea un estado de selección persistente ni manager adicional. Los proyectos existentes no requieren migración.

## QA y límites

- Suite nueva: 11 PASS, 1 SKIP (compilador Vue ausente).
- Regresión ejecutable focalizada: 182 PASS, 9 SKIP, 0 FAIL. El test S10-G001 se ajustó únicamente para reconocer la clase `preview-toggle title-preview` sin exigir un nombre de clase exacto.
- `npm ci --offline` bloqueado por `zip-stream@4.1.1` (ENOTCACHED); **compilación Vue/Vite y QA visual Electron NO VERIFICADOS**.
- No se dispone de evidencia visual real para el arrastre con ratón, clip mínimo, grafos con muchos canales ni paneles acoplados/desacoplados. El usuario debe realizar ese QA.

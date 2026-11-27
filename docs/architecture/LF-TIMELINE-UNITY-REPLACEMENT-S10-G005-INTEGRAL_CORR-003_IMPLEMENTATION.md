# LF-TIMELINE-UNITY-REPLACEMENT-S10-G005-INTEGRAL_CORR-003 — Indicador global `]`

**Gate literalmente autorizado:** `Listo. LF-TIMELINE-UNITY-REPLACEMENT-S10-G005-INTEGRAL_CORR-003 autoriza comenzar`.
**Baseline de entrada:** `LF_TIMELINE_UNITY_REPLACEMENT_S10_G005_INTEGRAL_CORR002_SOURCE_BASELINE.zip` (archivo adjunto con sufijo de transporte `(1)`; contenido utilizado sin recrearlo).
**Estado:** IMPLEMENTADO EN FUENTES · QA LOCAL PENDIENTE · NO CERRADO.

## Hallazgos observados antes del cambio

En `src/components/TimelinePanel.vue` existían dos indicadores visuales autónomos para el mismo fin de Timeline:

- `button.duration-grip` dentro de la regla, de solo 24 px de altura.
- `div.duration-boundary` absoluto dentro de `.inner`, con una línea que no incluía el remate inferior.

La columna izquierda utiliza `.pinned-column` separada de `.scroll`; el tiempo y las pistas comparten un único scroll nativo en `.scroll`. Una barra insertada solo dentro de `.inner` se desplazaría verticalmente junto con el contenido y no garantizaría remates visibles con scroll vertical. La altura del dock también cambia al abrir Curvas.

## Implementación exacta

Solo se modificó el componente original `src/components/TimelinePanel.vue`:

1. Se eliminaron el botón pequeño dentro de `.ruler` y el elemento `duration-boundary`; **ninguno permanece**.
2. Se incluyó un único `button.duration-grip`, dentro de la capa visual `duration-overlay`, **hermana** del contenedor `.scroll` en `.main`. Es un solo control con borde vertical completo y pseudoelementos `::before/::after` como remates superior e inferior. Se mantiene `role=slider`, `aria-valuenow`, `aria-valuemin`, `beginDurationResize` y `durationKeydown`.
3. `duration-overlay` comienza exactamente después del ancho dinámico `headerWidth` de la columna fija; tiene `overflow:hidden` y `pointer-events:none`. El único botón acepta punteros en un corredor estrecho de 15 px (`pointer-events:auto`), sin crear una capa interactiva sobre el resto de las pistas.
4. La coordenada X deriva de `timeline.duration * zoom - scroller.scrollLeft` mediante `durationBoundaryX`; `durationScrollX` registra únicamente el desplazamiento editorial del scroll nativo y **no** duplica el estado de duración.
5. La altura de la capa utiliza `scroller.clientHeight`, que excluye la barra de desplazamiento horizontal. El `ResizeObserver` que ya medía el viewport ahora actualiza también `durationViewportHeight`. El corchete se mantiene en el área visible y conserva sus dos remates al desplazar verticalmente las filas, tener menos filas que espacio disponible o abrir/cerrar Curvas.
6. Las clases históricas del indicador se consolidaron para evitar estilos enfrentados; no hay segunda línea independiente, runtime adicional ni recurso nuevo.

## Autoridades y exclusiones

Se conserva el código existente de arrastre, Snap, duración mínima, zoom, teclado, Undo/Redo, edición de clips y cabeceras fijas (G001–G005). No se modificaron el modelo, Inspector, Player, FilmMaker, Cinematics, formatos de proyecto ni recursos de usuario.

La cuestión de duración independiente de Comandos, Naturaleza y Métodos heredada de CORR-002 sigue bloqueada por el contrato G003 y **no** se trata en este Gate.

## Verificación disponible

- Pruebas específicas CORR-003: **11 PASS / 1 SKIP / 0 FAIL**; el único SKIP requiere compilador Vue ausente.
- Regresión de 18 suites S04–S10, incluidas G001–G005 y CORR001/002/003: **256 PASS / 12 SKIP / 0 FAIL**.
- Cuatro pruebas de harness histórico de medición/scroll fueron adaptadas para aportar el nuevo estado *visual* y comprobar además su sincronización; otra prueba histórica pasó a leer el template completo porque el control ahora está después de un `</template>` anidado. No se cambiaron las expectativas de reproducción ni temporización.
- `npm ci --offline --ignore-scripts --no-fund --no-audit`: **BLOQUEADO** por `zip-stream@4.1.1` no disponible en caché.
- Compilación Vue/Vite/Electron, scroll visual, Player real, persistencia y docking: **NO VERIFICADOS LOCALMENTE**. Se exige QA del usuario y aprobación expresa antes de cerrar.

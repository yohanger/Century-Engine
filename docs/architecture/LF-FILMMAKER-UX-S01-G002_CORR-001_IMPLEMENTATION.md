# LF-FILMMAKER-UX-S01-G002_CORR-001 — Corrección de responsividad y timeline

Fecha: 2026-10-29. Estado: **AUTORIZADO, IMPLEMENTADO; NO APROBADO NI CERRADO**. Fuente de continuidad: `LevelForge_FILMMAKER_UX_S01_G002_REBASED_SOURCE_BASELINE.zip` (1.055 archivos). Autorización exacta: «Listo. LF-FILMMAKER-UX-S01-G002_CORR-001 autoriza comenzar».

## Evidencia de la incidencia

Captura aportada: ventana Nether Film Maker de aproximadamente 1024×768, con jerarquía a la izquierda, monitor reducido en el centro e Inspector a la derecha. En el timeline el área de pistas ocupa poco espacio horizontal y aparece un gran bloque oscuro/azulado sin utilidad aparente a su derecha, además de una pequeña barra azul de desplazamiento abajo.

**Causa raíz comprobada en código:** `NleTimeline.vue` mostraba siempre `<aside class="props">`, de ancho fijo **230 px**, incluso con `sel === null`. El CSS solo ocultaba el panel vacío en modo `compact` móvil, no en escritorio. Al mismo tiempo, el NLE usa `width >= 600 px` para su contenido, así que un scroll horizontal nativo con un thumb muy pequeño aparecía dentro del viewport comprimido. En `FilmApp.vue` ambos docks laterales eran simultáneos incluso en 1024 px de ancho; el monitor se adaptaba al hueco restante sin un modo de concentración intermedio. Estas causas explican la captura sin atribuir funciones desconocidas al cuadro azul.

## Implementación en módulos existentes

### FilmApp.vue

- Ancho de ventana medido reactivamente. Móvil se conserva bajo 820 px; escritorio compacto se aplica entre 820 y 1219 px.
- En escritorio compacto **se muestra un único dock lateral a la vez**. Por defecto permanece Inspector; dos controles reales «Escena» y «Inspector» permiten intercambiarlo u ocultarlos. Mostrar un dock oculta el otro, liberando espacio al monitor y al timeline. A partir de 1220 px se mantienen ambos docks como antes.
- Las anchuras de docks se limitan proporcionalmente al espacio disponible. La altura del timeline se acota según el `ResizeObserver` del workspace para preservar al menos 205 px para el monitor cuando la geometría lo permite.
- Se conserva el sistema de redimensionamiento `Splitter`, el inspector real, el árbol de **nodos** (NO ECS) y todas las acciones de rodaje, reproducción y grabación.

### NleTimeline.vue

- El panel lateral de propiedades deja de ocupar espacio cuando no hay selección. Al seleccionar un clip aparece una **hoja contextual superpuesta** a la derecha con título, controles originales y botón de cierre; no reduce el ancho de las pistas.
- El desplazamiento horizontal deja de depender de un thumb azul ambiguo: la barra nativa horizontal queda oculta y se muestra «Desplazar tiempo ↔» con un control de rango accesible **solo cuando realmente hay desbordamiento**. El desplazamiento del contenido sigue siendo el del scroller original; también se admite Shift + rueda y se conserva Ctrl/Meta + rueda para zoom.
- Las cabeceras se sincronizan verticalmente al desplazarse por las pistas. Un `ResizeObserver` y un watcher del ancho de la secuencia recalculan el máximo de desplazamiento. El playhead sigue usando la misma posición y el mismo loop de reproducción.
- No cambia la representación de clips, operaciones de montaje, transiciones, audio, keyframes ni el formato `.nfm`.

### film-ux.css

- Media queries de escritorio compacto (820–1220), controles más condensados a 820–970, baja altura (hasta 640) y las reglas móviles anteriores intactas.
- Barra superior flexible (hasta dos filas únicamente si el ancho realmente lo exige), estados activos evidentes, foco visible y controles accesibles.

## Alcance y dependencias

No se han modificado `src/filmmaker/film.js`, `frame.js`, `session.js`, renderers Three.js, Editor, Player ni nodos VFX3D. No se agrega ningún nuevo sistema de paneles o dependencias externas. Se reutilizan `Splitter`, `ResizeObserver`, el store existente, los controles de montaje y el CSS de Filmmaker.

## Evidencia automatizada

- Tests nuevos `scripts/test-filmmaker-ux-s01-g002-corr001.mjs`: **10/10 PASS**; prueba además la semántica del selector de docks y el scroll real a través de funciones aisladas con dobles.
- Regresión acumulada anterior: **109/109 PASS**; total **119/119 PASS**, 0 fallos.
- `npm run build`: **NO VERIFICADO** (Vite no instalado en el contenedor: `sh: 1: vite: not found`). No se declara QA real Vue/Chromium.
- La captura del usuario documenta la incidencia anterior, no constituye prueba del resultado corregido.

**Pendiente:** compilación en equipo del usuario y QA visual/funcional a 1440×900, 1280×720, 1024×768, pantallas más estrechas y timeline con clips seleccionados, sin selección y con muchas pistas; después, su aprobación expresa.

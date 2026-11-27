# LF-FILMMAKER-UX-S01-G002 — Rediseño profesional de Nether Film Maker

Fecha: 2026-10-29. Estado: **IMPLEMENTADO; QA gráfico PENDIENTE; no aprobado/cerrado**.

## Fuente de verdad y corrección de continuidad

La intervención anterior de este mismo Gate se basó provisionalmente en `lf(3).zip` y ofrecía un integrador para modificar las fuentes en la máquina del usuario. Esa entrega **queda sustituida por esta versión**. El usuario adjuntó el SOURCE_BASELINE real `LevelForge_FILMMAKER_FRAME_S01_G001_SOURCE_BASELINE(1).zip` (1.050 entradas, CRC PASS). Se extrajo directamente, se aplicó la interfaz sobre los archivos definitivos y se verificó que no cambia el módulo de encuadre G001.

La jerarquía sigue siendo **un árbol de nodos**, no ECS. Ninguna arquitectura de nodos, recursos o eventos fue modificada.

## Comparación con el mockup

Se adoptó la dirección visual, NO las herramientas ficticias que aparecen en el mockup:

- Barra superior: jerarquía compacta, iconos SVG vectoriales y transporte real. Se añadió acceso funcional al panel **Película / Encuadre** ya disponible en G001, con información de ancho y alto. Funciona en escritorio y móvil.
- Monitor: fondo negro, borde tenue, título discreto, encuadre y bandas provistos por `FilmApp.vue` G001. Conserva el único viewport y sus overlays dentro del encuadre. No añade un nuevo renderer.
- Dock izquierdo: las pestañas reales **Jerarquía de nodos, Actor y Cámara**, con iconografía unificada y estados activos.
- Dock derecho: Inspector, Color, Atmósfera y Película; controles densos, legibles, foco y separadores consistentes.
- Timeline: permanecen pistas y operaciones reales: planos, actor, texto, efectos y audio. Los botones existentes reciben SVG; se corrigen contraste de clips, playhead y reglas de pista sin alterar gestos ni datos.
- Layout: puntos de ajuste a 1320px, 1130px y alturas de 750px; la hoja de paneles móvil no se elimina.
- Bienvenida: tipografía, fondo y acciones sobrios.

**Excluido:** exportación MP4/WebM, miniaturas reales no existentes, waveforms inexistentes, pistas de VFX adicionales, menú ficticio de presets y nuevos sistemas de docking.

## Modificaciones directas sobre G001

- `src/filmmaker/FilmApp.vue`: iconos SVG, acceso a formato, pestañas con `aria-pressed` y CSS sobre el DOM ya existente. Conserva el montaje `.film-frame` de G001, ResizeObserver, el estado `quality` y todos los handlers del transporte.
- `src/filmmaker/NleTimeline.vue`: iconografía SVG en acciones y cabeceras. No altera funciones de edición.
- `src/filmmaker/FilmGlyph.vue` **nuevo**: iconos vectoriales autocontenidos sin dependencias.
- `src/filmmaker/film-ux.css` **nuevo**: tokens y ajustes **solo** para `.fm`, sin afectar editor principal ni Player.
- `src/filmmaker/main.js`: importa la hoja de estilo local.
- `scripts/test-filmmaker-ux-s01-g002.mjs` **nuevo**: 10 tests de contrato visual y continuidad.
- Documentación de implementación, QA y las seis hojas del ledger modificadas.

**No cambia:** `src/filmmaker/film.js`, `src/filmmaker/frame.js`, `src/filmmaker/panels/FilmPanel.vue`, `session.js`, el motor ni la documentación y pruebas de FRAME-G001. En particular, `.nfm` versión 2, calidad y resoluciones siguen intactos.

## Evidencia real

- Batería Node: **109/109 PASS** (10 UX nuevos, 10 FRAME G001 y 89 regresión previa), 0 FAIL.
- Integración: cambios realizados **directamente** en los archivos del SOURCE_BASELINE aportado, **sin integrador adicional**. Se comparará automáticamente cada archivo contra el ZIP original antes de empaquetar.
- Vite / compilación de Filmmaker / Player / Electron real / QA visual en Chromium: **NO VERIFICADOS**. La caché de npm no permite `npm ci` offline (`zip-stream@4.1.1` ausente en pruebas previas).

## Reglas de cierre

La prueba Node no certifica fidelidad al mockup. Usuario debe validar el diseño visual a 1440×900, 1280×720, 1024×768, encuadres 16:9, 4:3 y vertical, navegación con teclado, paneles, reproducción y timeline. Solo después de QA y aprobación explícita se podrá declarar cerrado el Gate.

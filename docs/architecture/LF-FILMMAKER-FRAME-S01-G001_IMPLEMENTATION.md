# LevelForge — LF-FILMMAKER-FRAME-S01-G001 · Implementación

Fecha: 2026-10-29 · Estado: **IMPLEMENTADO; QA gráfico y aprobación pendientes**.

## Autoridad y fuente

- Autorización exacta: «Listo. LF-FILMMAKER-FRAME-S01-G001 autoriza comenzar».
- SOURCE_BASELINE: `LevelForge_ROAD_MATERIAL_S01_G001_SOURCE_BASELINE.zip`.
- Contrato: resolución del recurso `.nfm`, encuadre cinematográfico, calidad independiente, compatibilidad y sin exportación de vídeo.
- El ROAD-G001 anterior fue aprobado expresamente por el usuario; su evidencia de QA gráfico continúa pendiente.

## Modificaciones

- `src/filmmaker/frame.js` (nuevo): presets 1920×1080, 1280×720, 1440×1080, 2048×858, 1080×1920 y 1080×1080; normalización estricta de dimensiones enteras 64–8192 y función de ajuste del monitor sin estiramiento.
- `src/filmmaker/film.js` (extendido): `.nfm` versión 2 con `frame: {width,height}`. Película nueva: 1920×1080. Película heredada versión 1 sin `frame`: `frame:null` y monitor adaptable, sin conversión visual implícita. El esquema sigue utilizando `format:'nfm'` para el tipo de archivo. `packNfm` y `unpackNfm` reutilizan su normalización ya existente.
- `src/filmmaker/panels/FilmPanel.vue`: selector de formato, edición de ancho y alto con validación, y aclaración de que la resolución de la vista (calidad 100/75/50/35 %) es distinta de la resolución de encuadre.
- `src/filmmaker/FilmApp.vue`: el monitor `.film-frame` centra el viewport existente dentro de bandas negras. `ResizeObserver` observa la zona de escena para recalcular su rectángulo cuando cambian docks, tamaño de ventana o relación de aspecto. No crea renderer ni RAF nuevos; `Viewport.resize()` y `_fitCameras()` actualizan cámara perspectiva, ortográfica y cámara activa del Player. Los overlays, PiP y herramientas permanecen dentro del área ajustada.
- `scripts/test-filmmaker-frame-s01-g001.mjs` (nuevo): 10 pruebas Node de esquema, compatibilidad, presets, rechazos, encuadre y contrato de integración.
- `scripts/test-filmmaker-frame-ui-s01-g001.mjs` y `scripts/fixtures/filmmaker/frame.html` (nuevos): harness Vue/Chromium con WebGL real y round-trip JSZip. Quedan pendientes de ejecución por ausencia de Vite.

## Invariantes y límites

- FOV, posición, rotación y keyframes no se recalculan ni se modifican al cambiar el formato. La cámara solo actualiza su proyección al tamaño del viewport.
- Los planos, audio, timeline y archivos de escena no cambian cuando se edita `frame`.
- La resolución almacenada describe el encuadre de trabajo; el framebuffer interactivo se ajusta al panel y al porcentaje de calidad, no produce un vídeo a resolución final.
- No se implementa exportación MP4/WebM, formatos independientes por plano ni rediseño de FilmMaker (siguiente Gate).
- No se modifican los sistemas de eventos, VFX, Carretera ni el renderer global.

## Evidencia

- `node --test` con FILM 10 + regresión previa 89: **99/99 PASS**, 0 FAIL.
- `npm run build`: **NO VERIFICADO**; `vite: not found` en el contenedor de prueba (dependencias incompletas).
- Harness Chromium + JSZip real, compilación Filmmaker/Player, entorno Electron y QA del usuario: **PENDIENTE**.
- Sin afirmación de APROBADO o CERRADO para este Gate.

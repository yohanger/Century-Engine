# LevelForge — S12-G004 · Creación de pistas y Bootstrap Icons

Gate autorizado literalmente: `LF-TIMELINE-COMMAND-MENU-ICONS-S12-G004-INTEGRAL`, 2026-11-08.
Base: `LF_TIMELINE_ZOOM_WAVEFORM_S12_G003_INTEGRAL_SOURCE_BASELINE.zip`.

## Auditoría original

- `TimelinePanel.vue` usaba un único menú `+ Pista` con crear grupo, cinco tipos de pista y cinco atajos de Naturaleza.
- Los atajos llamaban a `addWeatherCue()`, que creaba claves `commands` y eventualmente una pista ordinaria llamada «Naturaleza». No existía otro tipo `TRACK_KINDS`.
- `TRACK_KINDS` declaraba un glifo Unicode por tipo, presentado en el menú. Las cabeceras de pistas ya usaban `Icon.vue` SVG y no requerían cambios.
- `COMMANDS.weather`, `COMMANDS.weatherLightning` y `COMMANDS.weatherThunder` están definidos en `cmd-world.js` y reunidos en `commandDefs.js`; el editor de comandos sigue disponible desde el Inspector de claves `commands`.

## Modificación autorizada

- `TimelinePanel.vue`: `+ Pista` queda como menú de creación de grupo y de los cinco tipos editables (Cámara, Nodo, Audio, Comandos, Métodos de nodo). Se retiran solo los cinco atajos meteorológicos y su función ya sin uso. `TRACK_KINDS`, IDs, serialized keys y catálogo de comandos permanecen intactos.
- `Icon.vue`: se agregan seis formas SVG oficiales Bootstrap Icons v1.13.2 usando el renderizador SVG existente, con ruta de 16×16, relleno `currentColor` y trazados originales. El modo de trazo 24×24 restante no cambia.
- Accesibilidad: el popup usa controles `<button>` nativos, `role=group`, foco visible, foco inicial al abrir y retorno al disparador con Escape. El menú conserva el `Teleport`, anchura y posicionamiento existentes.
- Licencia: `docs/licenses/BOOTSTRAP_ICONS_1.13.2_MIT.txt` incluye autoría, licencia MIT y enlaces a la fuente de los seis iconos.

## Exclusiones

No se alteran `TRACK_KINDS`, `COMMANDS`, mecanismos meteorológicos, runtime, Editor/Player exportados, Assets, Cinematics ni AudioEngine. No se instala Bootstrap, fuentes, CDN o CSS global.

## Estado de evidencia

Node focal 11 PASS/0 FAIL. Selección compatible 109 PASS/2 SKIP/0 FAIL. Una regresión más amplia contiene dos errores en herramientas históricas sin dependencias o aislamiento de módulos. Electron y build NO VERIFICADOS por `vite: not found` en el entorno de entrega. QA visual del usuario PENDIENTE; no declarar Gate aprobado ni cerrado.

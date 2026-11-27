# LF-CINEMATICS-FILMMAKER-TIMELINE-S07-G001-INTEGRAL · Integración en fuentes

**Estado:** GATE AUTORIZADO · IMPLEMENTACIÓN EN FUENTES · QA LOCAL PENDIENTE · NO CERRADO (2026-11-05).

## Autoridad y continuidad

- SOURCE_BASELINE de partida: `LF_FILMMAKER_S02_CA002_SOURCE_BASELINE.zip`, con CA-002 ratificado. No se incorporaron versiones al esquema `.nfm`.
- FilmMaker conserva la autoría; Cinematics consulta recursos con `filmMaker` verificable; Timeline de gameplay conserva su editor separado.
- Se mantiene el requisito aprobado: audio, scripts, métodos y comandos **no** se ejecutan durante el scrub de Edit Mode. Para reproducción completa se utiliza el **PlayMode y TimelineRunner existentes**; no hay otro motor de reproducción.
- El Sprint S02 de cámaras no se declara cerrado. El monitor móvil continúa pausado.

## Auditoría observada

1. `src/core/state/filesystem.js:importFiles()` almacenaba `.nfm` como Asset genérico, sin registrar el recurso en `project.timelines`.
2. `src/core/state/film.js:importFilm()` sí generaba pases y montaje con `filmMaker`, pero también aplicaba overrides y valores de escena, render y audio persistentemente. Esto era incompatible con importar para **consulta**.
3. `src/components/CinematicsPanel.vue` solo ofrecía catálogo y deslizador sin representar pistas, claves o cortes; la vista previa segura ya existía en `TimelinePreview`.
4. El Player ya usaba `TimelineRunner` para ejecutar audio, métodos, comandos, cámara y física, y ya protegía contra escenas equivocadas.
5. No se entregó un `.nfm` real del usuario para esta auditoría; su contenido y la causa concreta de cada archivo no pudieron verificarse binariamente aquí.

## Cambios de integración

- `src/core/state/film.js`: `importFilm(..., { applyScene:false })` utiliza el importador único, conserva las pistas y assets requeridos, evita overrides, cambios persistentes de ambiente/render/audio y duplicados verificables. Rechaza los recursos que no producen tomas o montaje. Mantiene el API histórico `applyScene:true` para consumidores explícitos.
- `src/core/state/film.js`: `importFilmDialog()` usa el modo de consulta; `runFilmCinematic()` utiliza el `PlayMode` existente, que inicia antes de `timelinePlay()` y valida la escena activa.
- `src/core/state/filesystem.js`: la importación general de `.nfm` delega en ese mismo importador, sin registrar archivos como Assets genéricos en adelante.
- `src/components/CinematicsPanel.vue`: reconoce `.nfm` ya presentes como Assets genéricos al abrir el panel; los valida contra el archivo real de IndexedDB, sin borrarlos y sin reimportarlos múltiples veces durante la sesión. Muestra Timeline por pistas con regla, zoom, cabezal y segmentos, además de ejecución completa **en modo Juego** y previsualización segura en Edit Mode. No crea herramientas de autoría.
- `src/core/timeline/model.js`: `readonlyTimelineLanes()` construye geometría consultiva desde las pistas reales. No se añade ninguna colección persistente ni se duplica el reloj. Los límites de plano se **derivan** de claves de cámara exportadas y cortes `ease:'cut'`; no se inventan pistas ausentes.

## Limitaciones no ocultas

- El editor cinematográfico original sigue siendo FilmMaker. Cinematics no ofrece modificación de pistas, planos, cámara ni clips.
- El scrub de Edit Mode evalúa cámara, transformaciones de nodos y física mediante `TimelinePreview`. Audio, scripts y comandos se ejecutan **solo en Play/Player**. La acción «Reproducir en Juego» inicia esa sesión existente.
- La duración de un clip de audio sin `duration` explícita no puede deducirse de la clave. Su marca visual es indicativa del **inicio**, no una medición del archivo de audio.
- Las clases de efectos que FilmMaker **no exporte** al Timeline de LevelForge no pueden representarse o ejecutarse legítimamente: no se inventan eventos.
- No se verificaron compilación Vite/Electron, almacenamiento real IndexedDB, ejecución real de JSZip, sonido, vídeo, Jolt ni QA visual.

## Reglas de propiedad

- No se añadió `project.cinematics`, variante `.nfm`, nueva escena, renderer ni Player.
- `project.timelines` conserva procedencia y mantiene las funciones ya existentes de empaquetado en Player.
- El archivo `.nfm` original no es reescrito por la consulta.
- El menú «Archivo → Importar película», el botón de Cinematics y la importación de Assets usan el mismo flujo de consulta.

## Corrección CORR-001 tras QA de usuario (2026-11-05)

La primera representación no acreditó la lectura del montaje original y tenía un área temporal demasiado reducida. La corrección mantiene el mismo Gate integral, añade una descripción editorial limitada bajo `filmMaker.reel`, enriquece recursos ya importados mediante reimportación idempotente y presenta planos/cámaras/tomas/capas reales junto con pistas ejecutables existentes. El `.nfm` no se reescribe, y las capas no se transforman en pistas ejecutables duplicadas. Véanse el contrato de corrección y el QA `...CORR-001.md`.

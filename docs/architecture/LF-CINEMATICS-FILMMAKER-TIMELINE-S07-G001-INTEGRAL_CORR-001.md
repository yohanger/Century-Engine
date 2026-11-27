# LF-CINEMATICS-FILMMAKER-TIMELINE-S07-G001-INTEGRAL — CORR-001

**Estado:** implementado en fuentes; QA visual y reproducción real pendientes. No cierra ni autoriza un nuevo Gate.

## Evidencia y diagnóstico

- Captura de usuario: `Timeline` mostraba un recurso «Cinemática» sin pistas visibles. Ese recurso genérico no prueba procedencia FilmMaker.
- Captura de usuario: Assets informó que `Escena 1 - pelicula.nfm` no contenía tomas ni montaje reproducible. El usuario aprobó **ese rechazo**. No se modifica ni relaja la validación.
- Código: `CinematicsPanel.vue` tenía una Timeline de solo lectura con nombres de segmentos genéricos, altura máxima 290 px y poco espacio para el montaje real.
- Código: `montageTimeline()` convierte cámara, comandos, audio y movimiento a pistas ejecutables, pero descarta al importar los nombres de planos, cámaras, tomas de actor y capas de texto/efectos. `readonlyTimelineLanes()` no podía recuperar información ya descartada.
- No se ha recibido un `.nfm` real del usuario que contenga un montaje válido; su contenido binario es **NO VERIFICADO**.

## Mecanismo, sin motor paralelo

1. `src/filmmaker/montage.js`: `cinematicReel()` deriva una descripción acotada de los planos y overlays **del montaje real** (`sequence(film)`), con ID, nombre, cámara, actor, rango temporal y transición. Para un pase concreto consulta únicamente ese pase.
2. `src/tools-register.js`: expone ese cálculo en la herramienta FilmMaker ya registrada; no añade un servicio global ni un importador nuevo.
3. `src/core/state/film.js`: agrega al marcador verificado `filmMaker` los metadatos consultivos al importar pases o montaje. Reimportar una película registrada solo actualiza esos metadatos si faltan o cambiaron, sin duplicar pistas ni tocar transformaciones de la escena.
4. `src/core/timeline/model.js`: conserva los metadatos bajo `filmMaker.reel` al normalizar el recurso, valida sus límites y compone carriles de consulta para planos, actuaciones y capas con los carriles de reproducción **existentes**. No se agregan pistas ejecutables ni un reloj nuevo.
5. `src/components/CinematicsPanel.vue`: reutiliza el evaluador y el reproductor existentes. La vista ocupa el espacio disponible, tiene control de zoom/ajuste, transporte compacto, regla, carriles agrupados, cortes reconocibles, cabezal y accesibilidad por teclado; mantiene catálogo y reproducir en Juego. No habilita autoría.

El marcador `filmMaker.reel` contiene solo descripciones para la vista, no claves adicionales de ejecución ni una película editable duplicada. El estado ejecutable sigue residiendo exclusivamente en `timeline.tracks`.

## Reglas que se preservan

- `.nfm` mantiene un formato único, sin constantes de versión ni migradores.
- Cinematics solo consume películas FilmMaker con procedencia verificable; Timeline gameplay no se reclasifica.
- Una película sin pasadas ni montaje reproducible sigue siendo rechazada; no se inventa contenido.
- Edit Mode consulta poses, sin ejecutar scripts, comandos ni audio. La ejecución integral sigue usando Play/Player originales.
- El archivo `.nfm`, los datos locales, Editor/Player y los trabajos móviles no se modifican por la mera consulta.
- Si una pista no fue exportada de FilmMaker, la vista no la fabrica.

## Validación pendiente

Se debe compilar en el Electron del usuario y comprobar al menos una película **realmente montada** con planos, cámara y pistas relevantes. La captura previa `Escena 1 - pelicula.nfm` no fue certificada como montaje válido. QA del usuario obligatorio antes de aprobar/cerrar el Gate.

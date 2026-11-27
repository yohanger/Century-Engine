# QA — LF-FILMMAKER-FRAME-S01-G001

Estado: IMPLEMENTADO · TEST NODE **99/99 PASS** · BUILD **NO VERIFICADO** · QA LOCAL **PENDIENTE** · APROBADO **NO** · CERRADO **NO**.

## Preparación

1. Asegurar que CHANGE se aplica sobre el SOURCE_BASELINE de ROAD-S01-G001 sin sobrescribir cambios locales divergentes.
2. `node --test scripts/test-filmmaker-frame-s01-g001.mjs scripts/test-road-material-s01-g001.mjs scripts/test-editor-safety-s01-g001.mjs scripts/test-editor-safety-s01-g002.mjs scripts/test-vfx-editor-s03-g001.mjs scripts/test-vfx-simulation-s02-g001.mjs scripts/test-project-safe.mjs scripts/test-resource-history-corr-g001.mjs`
3. `node --test scripts/test-filmmaker-frame-ui-s01-g001.mjs` (requiere Vite, Three.js y Chromium; `LF_FILM_BROWSER` opcional).
4. `npm run build` y `npm run filmmaker`.

## Casos manuales del usuario

- FILM-01: nuevo `.nfm`: por defecto 1920×1080 (16:9).
- FILM-02: alternar 720p, 4:3, 2.39:1, vertical y cuadrado; el contenido no se estira ni se corta.
- FILM-03: el monitor queda centrado con letterbox/pillarbox y conserva posición, rotación y FOV de cámara.
- FILM-04: editar resolución personalizada (64–8192, solo enteros); rechazar datos inválidos sin cambiar la última configuración válida.
- FILM-05: cambiar calidad de la vista 100/75/50/35 % no altera resolución de producción.
- FILM-06: grabar, pausar, reproducir una pasada y montar planos en distintos formatos; no se alteran keyframes, sonido ni efectos.
- FILM-07: guardar `.nfm`, cerrar y abrir; mismo ancho/alto y encuadre.
- FILM-08: abrir `.nfm` versión 1: mantiene el monitor adaptable; tras elegir un formato, lo guarda.
- FILM-09: revisar PiP, overlays, gizmos y controles en el monitor con 1280×720 y 1024×768 de ventana y en móvil.
- FILM-10: comprobar Editor/Player de LevelForge sin regresiones y que no aparece opción ficticia de exportar vídeo.

## Evidencia pendiente

Devolver logs de tests, de compilación y de `npm run filmmaker`, más capturas del monitor en 16:9, 4:3 y vertical. No se ha ejecutado el harness gráfico ni una compilación real en este contenedor; `npm ci` no concluyó y `npm run build` reportó `vite: not found`.

Resultados de la batería Node, ejecutados en esta entrega: 10 nuevos + 89 anteriores = **99 PASS, 0 FAIL**. El harness gráfico no forma parte de esa cifra.

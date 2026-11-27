# QA local — LevelForge S17-G003-AO-G002

## Instalación

1. Extraer el SOURCE_BASELINE de G002 en una carpeta NUEVA con `package.json` en la raíz. No aplicar CHANGE encima del baseline nuevo; CHANGE aplica solo sobre copia intacta del SOURCE_BASELINE AO-G001.
2. Conservar el SOURCE_BASELINE AO-G001 y los proyectos locales sin reemplazarlos. Este Gate no elimina archivos.
3. En la raíz: `npm ci`, `node --test scripts/test-performance-s17-g003-ao-g002-optimization.mjs`, `node --test scripts/test-performance-s17-g001-profiler-contract.mjs scripts/test-performance-s17-g002-spatial-reconstruction.mjs scripts/test-performance-s17-g003-diagnostics.mjs scripts/test-performance-s17-g003-ao-g001-cost-diagnosis.mjs scripts/test-performance-s17-g003-ao-g002-optimization.mjs`, `npm run build`, `npm run electron`.
4. Resultados esperados Node: **12 PASS** nuevo y **54 PASS** focal. La compilación y el QA real NO se han ejecutado en el entorno de desarrollo asistido.

## Protocolo experimental (Intel UHD 605)

1. Usar una escena realista con perfil **Alto** y AO > 0 (radio e intensidad constantes), cámara fija mirando al terreno; fijar resolución del canvas, escala de render, FOV, luces, sombras, niebla y ventana. No cambiar de escena entre modos. Dejar estabilizar durante 10 s.
2. Abrir Stats (F3), registrar GPU · pasadas, AO · total, AO · G-buffer, AO · oclusión, AO · denoise, AO · composición, FPS, p50/p95, draw calls y resolución visible.
3. En «AO · resolución experimental», comparar **100 % referencia**, **75 % experimental**, **50 % experimental**. En cada variante, reiniciar medias y recoger **tres corridas de 60 segundos**. Guardar captura PNG de cada modo con la cámara inmóvil; comprobar contactos entre geometrías, bordes finos, hierba, grietas y movimiento lento de cámara.
4. Repetir mirando al cielo; los resultados de distintas orientaciones NO se comparan como un benchmark A/B de cámara fija. Hacer además una prueba separada con AO desactivado para aislar el coste total, restaurándolo inmediatamente.
5. Cerrar Stats, reabrirlo y comprobar que el modo vuelve a **100 %**. Redimensionar ventana con Stats activo y verificar que no hay parpadeo, recortes ni texturas estiradas. Alternar Alto/Medio/Alto y confirmar que no hay uso de pase destruido o error WebGL.
6. Exportar un AppImage con NGME-STATS activo, abrirlo con `Ctrl+Shift+F3` y repetir prueba A/B. Exportar un AppImage normal sin diagnósticos y comprobar que no ofrece Stats ni el selector. No habilitar DevTools innecesariamente.
7. Validar que la escena y los proyectos guardados mantienen exactamente el mismo AO de siempre al reiniciar la aplicación. No declarar mejora hasta cotejar imágenes, p50/p95 y costes GPU por fase.

## Criterios

- El **100 %** debe reproducir el comportamiento de AO-G001, sin migraciones ni ajustes de calidad.
- 75 % / 50 % son experimentos deliberadamente visibles; cualquier halo, pérdida de detalle o ahorro insuficiente obliga a **DESCARTAR o corregir** la propuesta, no imponerla por defecto.
- Reportar (por cada variante) resolución física, temperatura/carga si es posible, AO · total, AO oclusión/denoise, FPS, p50/p95 y capturas comparables. Añadir salida Node, Vite, Electron y exportación AppImage. Un resultado sin imágenes no constituye QA visual PASS.
- Tras recibir evidencia: analizar, corregir bajo el Gate activo si procede y solicitar aprobación explícita para cerrar; actualizar las seis hojas solo con hechos verificados.

# QA · LF-CINEMATICS-FILMMAKER-TIMELINE-S07-G001-INTEGRAL

**Estado:** implementación en fuentes. No hay evidencia de compilación ni QA local y el Gate **NO ESTÁ CERRADO**.

## Pruebas automatizadas disponibles

Desde la carpeta raíz que contiene `package.json`:

```bash
node --test scripts/test-cinematics-filmmaker-timeline-s07-g001-integral.mjs
node --test scripts/test-cinematics-viewer-s05-g002.mjs scripts/test-cinematics-player-integration-s05-g004.mjs scripts/test-cinematics-legacy-cleanup-s05-g003.mjs
node --test scripts/test-filmmaker-anim-s02-g002-corr001.mjs scripts/test-filmmaker-camera-direction-s02-g001-integral.mjs scripts/test-filmmaker-edit-workspace-s01-g002-integral.mjs
npm run filmmaker -- --build
```

La compilación del Editor con `npm run filmmaker -- --build` verifica FilmMaker + Vite en Electron, pero **no sustituye** el QA real de LevelForge. No ejecutar los comandos dentro de una carpeta nueva del SOURCE_BASELINE: utilizar el proyecto existente actualizado mediante CHANGE.

## QA del usuario — Editor en Electron

1. Respaldar proyecto `.lfproj` y el `.nfm` original antes de las pruebas. Comparar cambios locales antes de aplicar CHANGE.
2. Abrir el proyecto con la escena destinataria cargada. Activar Cinematics.
3. Comprobar que el `.nfm` que estaba almacenado como Asset genérico aparece en Cinematics tras ser validado. Si no aparece, registrar nombre, escena activa y mensaje de error.
4. Importar otro `.nfm` desde el botón Cinematics y desde Assets; comprobar que ambos usan el catálogo y no duplican la película si se importa nuevamente.
5. Comprobar que importar **no altera persistentemente** poses, clima, render ni audio de la escena.
6. Seleccionar película y comprobar que aparecen pistas reales, cámara/cortes cuando existan, audio, comandos, nodos y bake según lo que el `.nfm` haya exportado.
7. Probar acercar/alejar Timeline, scroll horizontal, clic en regla, búsqueda hacia adelante y atrás, pausa y detener.
8. Comprobar que Edit Mode restaura poses y que no dispara scripts/audio/comandos durante el scrub.
9. Usar «Reproducir en Juego» y comprobar audio, cortes, actores, efectos y métodos en la escena correcta. Comprobar pausa, reanudación, seek y stop desde el panel.
10. Detener Play, guardar el proyecto, cerrarlo y reabrirlo. Verificar catálogo y Timeline sin duplicados.
11. Exportar paquete y comprobar la reproducción por ID mediante Player. No confundir una compilación exitosa con Play/Player PASS.
12. Probar escena diferente: la película debe impedir reproducción sobre nodos de otra escena hasta que se active la escena correcta.

**Evidencias a devolver:** salida de las pruebas, salida de Vite, capturas de Cinematics con pistas, observaciones de la importación del `.nfm` original, vídeo o descripción reproducible del Player cuando corresponda.

**Estado de aceptación:** PENDIENTE QA USUARIO. No registrar PASS visual, de JSZip ni de Player sin pruebas locales.

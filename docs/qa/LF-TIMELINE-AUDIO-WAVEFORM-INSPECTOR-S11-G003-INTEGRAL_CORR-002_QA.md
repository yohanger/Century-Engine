# Corrección visual de forma de onda · S11-G003 CORR-002

Gate `LF-TIMELINE-AUDIO-WAVEFORM-INSPECTOR-S11-G003-INTEGRAL_CORR-002`

Autorización literal el 7 de noviembre de 2026. «Listo. LF-TIMELINE-AUDIO-WAVEFORM-INSPECTOR-S11-G003-INTEGRAL_CORR-002 autoriza comenzar».

Base `LF_TIMELINE_AUDIO_WAVEFORM_INSPECTOR_S11_G003_INTEGRAL_CORR001_SOURCE_BASELINE.zip`. G002 se conserva como último Gate aprobado. G003 y sus correcciones están en QA.

## Diagnóstico y cambio

- **Observado.** El usuario rechazó el resultado visual. En la captura se distingue una línea horizontal dentro del clip MP3.
- **Causa reproducida.** La escala anterior dibujaba cada amplitud respecto a la escala completa del PCM dentro de una franja de pocos píxeles. En un MP3 sintético de pico −42.37 dBFS, el contorno ocupaba 0.22 de las 32 unidades verticales del SVG. La captura identifica el síntoma. La comprobación con el archivo del usuario sigue pendiente.
- **Mecanismo.** Se conservan los mínimos y máximos de las muestras del tramo. Su pico determina la escala vertical de todo el clip y el piso gráfico de −80 dBFS limita la ampliación de residuos. El silencio digital conserva la línea central. Zoom y desplazamiento conservan la escala del contorno.
- **Presentación.** Se aumentó el contraste del dibujo dentro del botón original del clip. La escala se aplica al dibujo. El Inspector conserva los valores absolutos de pico y RMS, y el audio conserva su volumen. La regresión de selección durante Play sigue incluida en la fixture de Electron con el reloj controlado de CORR-001.

## Aplicación

En la raíz de LevelForge con `package.json`, compara y respalda tus cambios locales antes de aplicar `LF_TIMELINE_AUDIO_WAVEFORM_INSPECTOR_S11_G003_INTEGRAL_CORR002_CHANGE.zip` sobre CORR-001. Aplica los archivos en sus mismas rutas y conserva tus proyectos, escenas y Assets. Para una prueba aislada, extrae `LF_TIMELINE_AUDIO_WAVEFORM_INSPECTOR_S11_G003_INTEGRAL_CORR002_SOURCE_BASELINE.zip` en una carpeta nueva e instala dependencias allí.

```bash
node --test scripts/test-timeline-audio-waveform-inspector-s11-g003.mjs scripts/test-timeline-preview-runtime-s11-g001-corr001.mjs scripts/test-project-safe.mjs
node --test scripts/test-timeline-audio-waveform-inspector-s11-g003-electron.mjs
```

Salida esperada. **37 pruebas Node PASS y 1 prueba Electron PASS con 22 comprobaciones internas**. Si la prueba Electron falla, devuelve su salida completa y el bloque `observed`.

Tras el PASS, ejecuta `npm run build && npm run electron`. Abre tu mismo MP3. Los tramos con señal deben mostrar picos y valles, incluidos después de mover el scroll y cambiar el zoom. El silencio conserva la línea central. Comprueba la estabilidad de las mediciones al cambiar zoom y el avance de cabezal, audio y comandos al seleccionar clips durante Play. Devuelve el resultado y una captura del mismo clip.

## Evidencia de generación

- **37 PASS** en suites focales y de continuidad. Se añadieron dos casos de escala, silencio y residuos.
- En Node, el MP3 sintético decodificado por FFmpeg pasó de 0.22 a 29.98 unidades de contorno vertical. El Inspector debe mostrar el pico de la fuente, aproximadamente −42.37 dBFS para esa prueba. Electron decodifica el mismo MP3 mediante Web Audio en la fixture.
- Regresión Node de Timeline, Cinematics y Audio. **504 PASS y seis fallos preexistentes** de 510. CORR-001 obtuvo 502 PASS y los mismos seis fallos de 508.
- Electron embebido ejecutado en pantalla virtual Xorg. **1 PASS con 22 comprobaciones**, incluida la decodificación del MP3 con Web Audio y la continuidad del transporte con voces simuladas.
- Editor y Player compilados. **Gate abierto para QA local visual y auditivo con el MP3 del usuario.**

Los logs están en `docs/qa/evidence/` con el prefijo `LF_S11_G003_CORR002_`.

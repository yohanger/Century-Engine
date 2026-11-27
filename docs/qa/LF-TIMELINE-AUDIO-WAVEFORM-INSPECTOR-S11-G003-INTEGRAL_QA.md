# QA de forma de onda e Inspector

Gate `LF-TIMELINE-AUDIO-WAVEFORM-INSPECTOR-S11-G003-INTEGRAL`

## Aplicación

En la raíz de LevelForge con `package.json`, compara los archivos de `LF_TIMELINE_AUDIO_WAVEFORM_INSPECTOR_S11_G003_INTEGRAL_CHANGE.zip` con tu copia de G002 aprobada y respalda tus ediciones antes de aplicar en las mismas rutas. Para una prueba aislada, extrae `LF_TIMELINE_AUDIO_WAVEFORM_INSPECTOR_S11_G003_INTEGRAL_SOURCE_BASELINE.zip` en una carpeta nueva. Conserva tus proyectos, Assets, escenas y ambos ZIP hasta la aprobación.

```bash
npm ci
node --test scripts/test-timeline-audio-waveform-inspector-s11-g003.mjs scripts/test-timeline-preview-runtime-s11-g001-corr001.mjs scripts/test-project-safe.mjs
node --test scripts/test-timeline-audio-waveform-inspector-s11-g003-electron.mjs
npm run build
npm run electron
```

Salida esperada con CORR-002 en Linux con sesión gráfica. Node informa 37 PASS. Electron debe informar 22 comprobaciones con WAV y MP3 reales, reloj controlado y salida de voces simulada. Consulta [el QA visual de CORR-002](LF-TIMELINE-AUDIO-WAVEFORM-INSPECTOR-S11-G003-INTEGRAL_CORR-002_QA.md). Vite compila Editor y Player.

## Casos locales

1. Importa un WAV con tramos de silencio y señal y otro audio admitido por tu Electron. Crea dos claves que compartan el WAV y asigna un offset distinto a una. Las ondas deben diferir y conservar el nombre del recurso y las asas existentes.
2. Cambia offset, pitch, duración y repetición desde el Inspector. La onda sigue el tramo de la fuente y queda vacía después del final cuando el clip se prolonga sin repetición. Con duración 0, la ventana del carril conserva su tamaño editorial y el Inspector indica la duración completa.
3. Compara un WAV mono con uno estéreo. El Inspector debe informar canales, duración, frecuencia del PCM analizado y niveles de la fuente. Un WAV silencioso debe mostrar −∞ dBFS. Cambiar el volumen de la clave o del bus conserva esas mediciones.
4. Selecciona claves mientras Play ejecuta audio y comandos seguros. Verifica avance del cabezal, audio continuo y ejecución de comandos. Cambia de pestaña a Mixer, vuelve al Timeline y detén. Comprueba que el arrastre efectivo y Stop mantienen el comportamiento de G002.
5. Verifica un archivo que falte y un WAV corrupto. El Inspector debe distinguir ambos estados. Reabre el proyecto y comprueba que el análisis se reconstruye y que las claves conservan sus datos. La fixture verifica también reemplazar bytes del WAV bajo el mismo ID.
6. En un Timeline con varios clips, desplázate y cambia el zoom. La onda debe aparecer al entrar a la vista y los botones deben seguir seleccionables. Comprueba la respuesta del Editor con tus audios habituales.

Devuelve la salida de ambas pruebas y el resultado de los seis casos. Si falla la selección durante Play, adjunta un vídeo corto con audio y el tiempo aproximado de la interrupción.

## Evidencia de la entrega inicial de G003

- Gate, continuidad y persistencia local en Node con 35 PASS, de los cuales ocho pertenecen a G003.
- Regresión Node de Timeline, Cinematics y Audio con 502 PASS y seis fallos preexistentes de 508. La base aprobada arrojó 494 PASS y esos mismos seis fallos de 500.
- Editor y Player compilados con `npm run build`. Los logs conservan los avisos de Vite.
- Electron se detuvo antes de abrir la fixture por ausencia de servidor X o `DISPLAY`. La validación visual y auditiva en sesión gráfica sigue pendiente.

Logs bajo `docs/qa/evidence/` con prefijo `LF_S11_G003_`. CORR-002 tiene evidencia propia de 37 pruebas Node, 22 comprobaciones en Electron embebido y compilación de Editor y Player.

# LF-FILMMAKER-MOBILE-CAMERA-MONITOR-S03-G001-INTEGRAL · Implementación

Fecha: 2026-11-05. **Autorización literal S03 recibida. CA-MC-002 ratificado sin modificaciones por el usuario. IMPLEMENTADO EN FUENTES; Vite S03 PASS aportado por usuario; APK y QA real S03 NO VERIFICADOS; NO CERRADO.**

## Contratos y punto de integración

- S01 diagnosticó Z2473 y se cerró. S02 fue probado y aprobado localmente por el usuario; CA-MC-002 se ratificó expresamente el 2026-11-05. Su cierre se registra sin fabricar logs de compilación ni benchmark.
- `CA-MC-001` y MC-09…MC-11 siguen vinculantes. S01A sigue abierto (posición 6DoF no acreditada). S04 colisiones, S05 grabación y S06 integración final **no están autorizados**.
- Extiende `src/filmmaker/mobile-live-bridge.js` y `mobile-live-monitor.js`; no añade otro renderer, servidor, APK, rig, reloj ni sistema de física.
- La sesión y vídeo existentes (`canvas.captureStream(10)`, WebRTC DTLS/SRTP, señalización LAN del S02) se conservan; el teléfono solo recibe el vídeo del PC.

## Calidad de monitor independiente

- Archivo de responsabilidad única `src/filmmaker/mobile-monitor-quality.mjs`: perfiles **Ahorro** 350 kb/s, 5 fps y escalado 2×; **Equilibrado** 850 kb/s, 10 fps, 1×; **Detalle** 1600 kb/s, 10 fps, 1×. Valores **LÍMITES SOLICITADOS**, no throughput garantizado.
- La aplicación se hace **en el sender WebRTC** usando `getParameters()/setParameters()`, `encodings[0].maxBitrate/maxFramerate/scaleResolutionDownBy`, sin `renderer.setSize`, sin cambiar `film.frame`, escenas, tomas o `.nfm`.
- Chromium puede ignorar o rechazar algunos parámetros. El panel muestra error/estado explícito y el usuario debe contrastar el valor **medido** en el teléfono y PC; no se inventa éxito por seleccionar un perfil.
- Comportamiento ante desconexión: libera encoder/video/sensor, evita aplicar resultados asíncronos a una sesión nueva y requiere emparejamiento nuevo.

## Telemetría medida y límites

- **PC:** `electron/main.cjs`, IPC accesible solo desde la ventana propietaria de FilmMaker; `app.getAppMetrics()` ofrece CPU agregada de **todos los procesos Electron** y memoria residente agregada en MiB. No es uso de CPU/RAM de todo el PC ni medida aislada del renderer.
- **Android:** `MobileCapabilitiesPlugin.monitorResources` informa tiempo de CPU del proceso, uptime, PSS del proceso y RAM libre del **sistema**. Muestras espaciadas cada 2 segundos; porcentaje de CPU calculado como delta tiempo CPU / delta reloj. No cuantifica el uso de todo Android, GPU ni hardware decodificador.
- **Vídeo PC:** FPS enviados y bitrate del outbound-rtp de WebRTC, medidos periódicamente.
- **Vídeo móvil:** fotogramas presentados en `requestVideoFrameCallback` (o tiempo de vídeo creciente como alternativa); FPS de presentación, bitrate recibido (`inbound-rtp`), dimensiones de vídeo y edad de la última imagen. Los contadores nunca certifican una imagen particular o una tasa garantizada.
- **Latencia:** RTT p50/p95 del canal de control; p50/p95 de latencia de vídeo **estimada** únicamente si WebView aporta `metadata.captureTime` fiable. Si no hay metadatos, los valores quedan `—` y NO se declaran medidos. El reloj del móvil no gobierna películas.
- Imagen de más de **2500 ms** sin nuevo fotograma deja de ser fresca. El móvil deja de enviar orientación y el PC bloquea su aplicación; DataChannel cerrado libera sensor y recursos.
- El `video` conserva `object-fit: contain`, permitiendo barras negras sin recorte. S03 no cambia FOV ni parámetros de producción.

## Licencias y compatibilidad

- Se utilizan únicamente Electron, Chromium WebRTC y Android APIs del proyecto. MDN documenta `RTCRtpSender.setParameters()`, incluidos sus límites de compatibilidad; las métricas de Electron están documentadas como CPU por proceso y workingSetSize en KiB.
- No se añaden dependencias ni subproyectos, no se habilita internet ni se modifica la seguridad del enlace S02.

## Evidencia y cierre

- Suite acumulada S01/S01A/S02/S03: **60 tests, 58 PASS, 2 SKIP, 0 FAIL** en contenedor sin dependencias Electron/Vite y esbuild. Los SKIP no son PASS.
- **NO VERIFICADO:** compilación Vite/Android, recepción y calidad real del monitor S03, CPU/RAM N5030–Z2473, latencias reales, 2 minutos de estabilidad y reconexión después de corte.
- Ejecutar `docs/qa/LF-FILMMAKER-MOBILE-CAMERA-MONITOR-S03-G001-INTEGRAL_QA.md`; usuario valida localmente y devuelve métricas/incidencias; cerrar solo tras aprobación expresa.

## Corrección QA CORR-001 — ciclo de vida de Electron (2026-11-05)

**OBSERVADO en evidencia usuario:** `TypeError: Object has been destroyed` en `electron/main.cjs`, eventos `second-instance` y acceso al `webContents` destruido. **La captura de error procede de una carpeta S01 anterior y mezclada**; el log de S03 limpio confirma compilación Vite pero no demuestra que Electron haya abierto. No atribuir el error original a S03 sin reproducción.

**RIESGO REAL AUDITADO EN SOURCE_BASELINE S03:** `closed` leía `win.webContents.id` después de la destrucción; `second-instance` consultaba `win.isMinimized()` aunque la ventana pudiera haber sido destruida. La corrección usa el ID del renderer guardado durante creación, libera sesión y listeners sin acceder al objeto destruido, y en segunda instancia enfoca una ventana aún válida o crea una nueva. También evita enviar respuestas del enlace a una ventana destruida. No altera el protocolo, la grabación ni el monitor.

**QA CORR-001:** dos pruebas nuevas S03-15/16 ejecutan la creación/cierre y segunda instancia reales de `electron/main.cjs` contra un doble de Electron que lanza `Object has been destroyed` al consultar `webContents` de una ventana destruida. Suite acumulada: **62 tests, 60 PASS, 2 SKIP, 0 FAIL**. SKIP por `esbuild` y Electron/Vite no instalados en contenedor. `node --check electron/main.cjs` PASS. **Build Vite S03 aportado por usuario: PASS** (836 módulos); la salida termina con descarga binaria de Electron, no demuestra ejecución del binario. **APK S03 / QA de cámara / cierre limpio real: PENDIENTES.**

La instancia antigua debe cerrarse después de guardar cualquier película antes de probar el SOURCE_BASELINE CORR-001; Electron usa bloqueo de instancia única y una ventana antigua puede recibir el evento aunque se ejecute una carpeta nueva.

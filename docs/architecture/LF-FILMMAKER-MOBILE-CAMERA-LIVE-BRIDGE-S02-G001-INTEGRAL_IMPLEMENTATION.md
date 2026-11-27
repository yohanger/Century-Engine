# S02-G001-INTEGRAL · Enlace LAN, orientación 3DoF y monitor virtual

Fecha: 2026-11-04. **Autorización literal recibida. QA local PC–Z2473 aprobado por el usuario; CA-MC-002 ratificado el 2026-11-05. Cierre documental registrado en S03 con las evidencias disponibles.** Documento asociado: `LF-FILMMAKER-MOBILE-CAMERA-LIVE-BRIDGE-S02-G001-INTEGRAL_CA-MC-002.md` (ratificado sin modificaciones el 2026-11-05).

## Auditoría de integración y cambios

- `src/filmmaker/FilmApp.vue` reutiliza el editor 3D existente, cuya escena sigue residente únicamente en Electron.
- `src/filmmaker/operator.js` añade entrada `remote` al `OperatorRig` existente: cuaterniones Android normalizados, calibración relativa respecto a la orientación inicial y posición **congelada**. No utiliza joystick, paso, posición del usuario ni movimiento extrapolado.
- `src/filmmaker/session.js` añade una **previsualización sin grabación**, iniciada por la apertura del DataChannel y eliminada al desconectar; no crea ni altera tomas/clips/archivos `.nfm`.
- `src/filmmaker/mobile-live-bridge.js` obtiene el canvas WebGL del editor, `captureStream(10)`, genera oferta WebRTC sin STUN externo, envía vídeo, recibe orientación únicamente cuando el teléfono confirma fotogramas recientes, rechaza mensajes inválidos y registra métricas de vídeo; cleanup al cambiar película, cerrar/salir, error o desconectar.
- `electron/filmmaker-mobile-bridge.cjs`, `electron/main.cjs` y `electron/preload.cjs` implementan señalización IP privada, 12 dígitos, HMAC-SHA256 y ticket temporal; un solo emparejamiento por sesión; IPC controlado por la ventana FilmMaker (no Player ni ventana de LevelForge).
- `src/filmmaker/MobileCapabilities.vue` y `src/filmmaker/mobile-live-monitor.js` añaden monitor WebRTC real al APK existente, informe de RTT/fotogramas, campos IP/PIN, pausa por pantalla oculta y control del ciclo de vida del sensor Android.
- `MobileCapabilitiesPlugin.java` añade eventos limitados a orientación 3DoF continua, con inicio y liberación nativos. `AndroidManifest.xml` conserva INTERNET y habilita HTTP claro únicamente para el canal de **señalización**; audio/vídeo y control se transmiten por WebRTC cifrado. Android no carga proyecto 3D.
- El cliente cancela escuchas asíncronas obsoletas y ofrece error de reconexión si el canal no se abre tras 15 segundos. La UI muestra alternativas de IP privada si el PC tiene varias interfaces; una IP VPN o Docker podría no ser alcanzable por Wi-Fi.

## Seguridad, ciclo de vida y limitaciones

1. PIN solo local, generado criptográficamente. La solicitud pair usa HMAC sobre nonce; la respuesta ofrece SDP con prueba HMAC; el answer incluye ticket temporal y HMAC. TTL de sesión y límite de intentos; **no usar redes públicas ni publicar puerto fuera de LAN**. La señalización utiliza HTTP claro, aunque el PIN no se transmite directamente; un atacante activo en LAN podría causar denegación de servicio. No es protección equivalente a TLS.
2. WebRTC con `iceServers: []` exige conectividad directa de red. AP/routers con aislamiento de clientes, VPN, NAT distinto o firewall impedirán emparejar. No hay relay TURN ni servidor en Internet.
3. `canvas.captureStream(10)` solicita 10 fps, no garantiza FPS, latencia, ancho de banda ni calidad. Los valores válidos solo se obtienen mediante QA con teléfono y PC reales.
4. Enlace de orientación solamente: no se acredita posición 6DoF, colisiones, control remoto de grabación ni sincronía de claves. S01A calibración/marcadores conserva sus estados pendientes.
5. No se guarda el vídeo en el móvil. No se añade software de servidor permanente ni se modifican Cinematics, Timeline, Player o el formato `.nfm`.
6. No hay pruebas de carga prolongada ni de exportación AppImage independiente; dependencias futuras se mantienen planificadas.

## Pruebas ejecutadas

- `node --test` de S01+S01A+S02 (incluido runner Electron opcional): **46 pruebas, 44 PASS, 2 SKIP, 0 FAIL** en el entorno actual.
- Los dos SKIP están justificados por falta de dependencias de Node instaladas aquí (esbuild/Electron+Vite); **no son PASS**.
- El test de señalización activa el servidor HTTP local y valida par autenticado, HMAC, rechazo y límites. El test Electron usa el runner **embebido** y queda pendiente hasta `npm ci`.
- **NO VERIFICADO:** build Vite FilmMaker, Gradle APK S02, reproducción WebRTC real en N5030 y Z2473, sensor/rotación visual, latencia, calidad, reconexión y performance.

## QA y cierre

Seguir `docs/qa/LF-FILMMAKER-MOBILE-CAMERA-LIVE-BRIDGE-S02-G001-INTEGRAL_QA.md`. El usuario compila y prueba localmente; el asistente analiza la evidencia y corrige dentro del Gate. Cerrar solo tras PASS real y aprobación expresa; actualizar Excel según evidencia, no expectativas.

## Actualización posterior de QA (2026-11-05)

El usuario declaró «Aprobado» tras probar el enlace móvil–PC y la orientación en el Z2473. Se acepta como QA LOCAL PASS declarado por el usuario, no como telemetría cuantitativa ni prueba automática de Gradle en este entorno. Ratificó CA-MC-002 en una declaración independiente. La distribución de responsabilidades S02/S03 permanece vigente.

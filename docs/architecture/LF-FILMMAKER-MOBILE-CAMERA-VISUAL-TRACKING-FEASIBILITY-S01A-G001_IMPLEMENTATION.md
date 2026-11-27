# S01A-G001 · Implementación del experimento de seguimiento visual

Fecha: 2026-11-04. Gate autorizado literalmente: `LF-FILMMAKER-MOBILE-CAMERA-VISUAL-TRACKING-FEASIBILITY-S01A-G001`.

**Estado:** IMPLEMENTADO EN FUENTES; pruebas locales estructurales y prueba PnP sintética PASS; Android/Vite/QA físico Z2473 de S01A NO VERIFICADOS; **NO APROBADO, NO CERRADO**. El requisito de caminar con posición métrica continua permanece sin demostrar.

## Precedencia y cambios

S01 diagnóstico cerrado con aprobación local del usuario para scroll y permisos, sin deducir 6DoF. Se extendieron los puntos existentes `MobileCapabilitiesPlugin.java` y `MobileCapabilities.vue`; ningún nuevo producto móvil, servidor, player, sistema de escena o componente LAN fue incorporado.

- **Captura de fotografías:** `captureVisualReference` inicia el `MediaStore.ACTION_IMAGE_CAPTURE` de la aplicación nativa disponible; solicita lente trasera pero el OEM puede ignorar la preferencia. El usuario debe verificarla visualmente. Usa el FileProvider existente, JPG temporal en caché, retorno privado y limpieza del temporal al finalizar. Se limita a una captura a la vez, longitud máxima 1,2 MB, anchura/altura tras reducción máxima 1600 px. Orientación JPEG EXIF corregida para los casos admitidos. No hay cámara abierta en segundo plano ni streaming. **No se ha probado Android real para S01A**.
- **Óptica:** `rearCameraOptics` consulta Camera2 para la primera cámara trasera: `LENS_INTRINSIC_CALIBRATION` y presencia de distorsión (si están disponibles). **No convierte esos parámetros automáticamente en la calibración del JPEG posprocesado**, cuya resolución y recorte pueden diferir. Calibrar usando las fotos exportadas.
- **UI:** bloque específico «Viabilidad S01A» en diagnóstico existente. Selector de etapa, captura voluntaria, lista en memoria de como máximo 12 fotografías, exportación ZIP con `manifest.json` y eliminación de fotos temporales en memoria a solicitud. No afecta la exportación JSON S01; `saveBytes` existente conserva la transferencia al PC sin red propia. La exportación genera `LF_MOBILE_S01A_Z2473_CAPTURAS.zip`.
- **PC QA:** `scripts/filmmaker-mobile-visual-tracking-s01a.py` y `scripts/requirements-filmmaker-s01a.txt` usan OpenCV 4.13 (licencia Apache-2.0), diccionario **AprilTag 36h11** y `solvePnP` (`IPPE_SQUARE`); no integra la biblioteca AprilTag 3 ni promete su implementación. Se incluyen material de referencia SVG A4 imprimible para marcador 120 mm y tablero de 9x6 esquinas internas con cuadros de 18 mm.

## Limitaciones y riesgos explícitos

1. Es una **muestra discreta** de fotografías; no mide captura continua, sincronización por frames, seguimiento entre frames ni latencia PC↔teléfono.
2. El Intent Android no garantiza la lente trasera aun solicitándola. Si el usuario observa lente frontal, la sesión no sirve para evaluar la cámara trasera.
3. Los parámetros Camera2 de sensor NO son intrínsecos del JPEG nativo; se exige calibración óptica con el tablero, 8 o más vistas útiles con misma resolución/zoom.
4. PnP ofrece pose de cámara relativa al **centro del marcador ID 0** cuando es visible y se conoce la longitud física. No se usa la orientación del sensor como posición absoluta. Si el marcador deja de verse, no se inventa traslación.
5. El PNG de la cámara se exporta comprimido en JPG; se debe medir el marcador impreso (120 mm) y no reescalarlo al imprimir.
6. No hay garantías de estabilidad, realismo de filmación ni rendimiento para el N5030/4GB y Z2473 antes de las pruebas físicas.
7. **No se ha tocado el runtime de FilmMaker, la película .nfm, la cámara virtual del PC ni los subsistemas de colisión, exportación, Player, LAN, Cinematics o scripts de usuario.**

## Dependencias/autoridad externa

- Android Camera2: https://developer.android.com/reference/android/hardware/camera2/CameraCharacteristics ; `LENS_INTRINSIC_CALIBRATION` es opcional y requiere permiso CAMERA.
- Capacitor 8 Android custom plugins: https://capacitorjs.com/docs/plugins/android ; `@ActivityCallback` permite retornar actividad externa.
- OpenCV ArUco/AprilTag: https://docs.opencv.org/4.10.0/d5/dae/tutorial_aruco_detection.html ; estimación de pose con marcador conocido.
- OpenCV licencia Apache-2.0: https://opencv.org/license/ ; PyPI ruedas CPU-only de OpenCV contrib headless: https://pypi.org/project/opencv-contrib-python-headless/4.13.0.92/ . Una sola variante `cv2` en entorno virtual aislado; ninguna dependencia OpenCV en APK.

## Criterio de siguiente cierre

El usuario compila la APK, instala sobre versión anterior sin perder datos, imprime marcadores a escala, obtiene fotos de calibración y desplazamiento, devuelve ZIP real; se ejecuta la medición de pose y se evalúa precisión/repetibilidad/oclusión. Se documenta si `VIABLE`, `VIABLE CON RESTRICCIONES` o `NO VIABLE`, sin hacer equivaler pose discreta con seguimiento continuo de producción. No avanzar automáticamente a S02.

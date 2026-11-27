# Nether Film Maker — proyecto Android existente (Capacitor)

Gate en fuentes: `LF-FILMMAKER-MOBILE-CAMERA-MONITOR-S03-G001-INTEGRAL` (**implementado, QA real S03 pendiente, NO CERRADO**). S02 enlace LAN y orientación fue aprobado en QA local por el usuario; CA-MC-002 ratificado sin modificaciones el 2026-11-05. S01 diagnóstico está aprobado/cerrado; S01A fotografía/pose sigue abierto. La base preserva el mismo `appId`, `MainActivity`, paquetes, almacenamiento local y compatibilidad de proyectos anteriores. No desinstales el APK existente si guarda películas `.nfm` que todavía necesitas; **desinstalar puede borrar los datos de la aplicación**.

En S02 la actividad Android abre directamente **Cámara móvil de FilmMaker**, con monitor WebRTC de la escena del PC y diagnóstico S01/S01A desplegable. El diagnóstico verifica sensores, cámaras, permisos, memoria física comunicada por Android, versión de WebView, disponibilidad de ARCore y, solo donde sea compatible, una sesión local temporal que obtiene posición/orientación. El enlace LAN/monitor S02 tiene **QA local PASS declarado por el usuario**. S03 añade perfiles de calidad de monitor WebRTC y medición de FPS, bitrate, latencia disponible, CPU/RAM Android/PC; esos nuevos extremos todavía requieren QA local. Android **no ejecuta el editor completo** ni carga la escena; el PC renderiza el encuadre. El enlace solo aplica orientación 3DoF, no posición 6DoF, colisiones ni grabación remota. CA-MC-002 quedó ratificado sin modificar sus términos.

## Construcción en Linux (equipo del usuario)

Se necesita Node/npm, JDK **21**, Android SDK (plataforma **API 36**, build-tools y platform-tools) y acceso inicial a los repositorios npm/Google Maven para descargar dependencias. Usar el Android SDK local con `ANDROID_HOME` (o `local.properties` de tu entorno, sin incluirlo en la entrega). Este proyecto conserva Capacitor **8.5.3**, Android Gradle Plugin **8.13.0** y Gradle wrapper **8.14.3**.

Desde la raíz del SOURCE_BASELINE nuevo:

```bash
npm ci
cd filmmaker-mobile
npm ci
npm run sync
cd android
bash ./gradlew assembleDebug --max-workers=2
```

Resultado esperado, si SDK y dependencias están instalados: `filmmaker-mobile/android/app/build/outputs/apk/debug/app-debug.apk`.

El build ejecuta `vite build`, `cap sync android` y `./gradlew assembleDebug`. No borres datos o películas para reinstalar. Instala la actualización **sobre el mismo identificador de paquete** `com.levelforge.netherfilmmaker` si la firma de debug es compatible. Si Android rechaza la actualización por firma distinta, **no desinstales**; conserva el APK y los datos actuales e informa del conflicto para decidir una migración segura.

Para instalar con USB y depuración Android (opcional, si ya está configurada):

```bash
adb devices
adb install -r filmmaker-mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

## QA real en ZTE Blade A56 Z2473

1. Abre **Nether Film Maker**. Debe mostrarse **Cámara móvil de FilmMaker** y el monitor remoto. El diagnóstico está dentro de «Diagnóstico y pruebas S01 / S01A».
2. Pulsa **Actualizar inventario**. Comprueba que muestre modelo, Android, WebView, cámaras y sensores. La cifra de memoria física debe leerse del informe JSON, no sumarse a una ampliación RAM virtual.
3. Pulsa **Medir orientación (4 s)** y gira suavemente el móvil. Deben generarse muestras XYZW. Este resultado solo acredita **3DoF**.
4. Pulsa **Solicitar permiso cámara**. Puedes denegarlo para verificar que no se intente abrir ARCore sin permiso; si lo concedes, repite el inventario.
5. Revisa el estado ARCore: `UNSUPPORTED_*`, `UNKNOWN_*`, `SUPPORTED_NOT_INSTALLED`, `SUPPORTED_APK_TOO_OLD` o `SUPPORTED_INSTALLED`. No interpretes `SUPPORTED_INSTALLED` como prueba de seguimiento efectivo.
6. Si Android indica soporte y servicio instalado, ejecuta **Probar pose AR (5 s)**, en espacio despejado, apuntando a una superficie con textura y desplazando ligeramente el móvil. No camines mirando la pantalla. Si está soportado pero no instalado, la instalación solo ocurre tras pulsar el botón correspondiente y aceptar el diálogo de Android.
7. Pulsa **Guardar/compartir informe JSON**. Conserva el archivo `LF_MOBILE_S01_Z2473_DIAGNOSTICO.json` y envíalo para analizar los resultados, junto con cualquier error de instalación o ejecución. Comparte únicamente si estás conforme con la información técnica del dispositivo incluida.

**Evidencia imprescindible:** modelo/versión OS observados, inventario de sensores, cámaras y permisos, estado del servicio AR, muestras de orientación y, si se habilita AR, estados TRACKING/PAUSED y posiciones en metros. En equipo sin AR, la ausencia de muestra AR es un resultado informativo; no es una certificación universal de imposibilidad 6DoF mediante otras tecnologías.

El archivo JSON es local y voluntario. Los informes no se transmiten automáticamente por LAN. El monitor WebRTC funciona únicamente tras emparejamiento manual, no guarda vídeo ni reescribe `.nfm`. La comprobación de soporte ARCore se delega a Google Play Services y puede consultar sus servicios en línea según la implementación de Google. S01 ya tuvo QA local y cierre aprobados; S03 exige prueba real de calidad, frescura y rendimiento en N5030/Z2473. Procedimiento: `docs/qa/LF-FILMMAKER-MOBILE-CAMERA-MONITOR-S03-G001-INTEGRAL_QA.md`.

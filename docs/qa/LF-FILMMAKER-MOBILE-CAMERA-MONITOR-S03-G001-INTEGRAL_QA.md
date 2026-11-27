# S03-G001-INTEGRAL · QA local del monitor Z2473 y N5030

**Estado: IMPLEMENTADO EN FUENTES · QA REAL PENDIENTE · NO CERRADO.** CA-MC-002 ratificado 2026-11-05; S02 funcional aprobado por el usuario. No repetir S01 ni fingir seguimiento 6DoF.

## 1. Instalar en directorio nuevo

Extraer **SOLO** `...S03_G001_INTEGRAL_SOURCE_BASELINE.zip` en carpeta nueva bajo `~/Desktop/`; conservar el SOURCE_BASELINE S02 y no mezclar archivos. Trabajar desde la raíz del S03:

```bash
export JAVA_HOME="/usr/lib/jvm/java-21-openjdk-amd64"
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
npm ci
node --test scripts/test-filmmaker-mobile-monitor-s03-g001.mjs scripts/test-filmmaker-mobile-live-bridge-s02-g001.mjs scripts/test-filmmaker-mobile-live-bridge-s02-electron.mjs scripts/test-filmmaker-mobile-capabilities-s01-g001.mjs scripts/test-filmmaker-mobile-visual-tracking-s01a.mjs
npm run filmmaker -- --build
```

Esperado: **62 tests PASS** si existen esbuild/Electron+Vite; en entorno sin dependencias pueden existir 2 SKIP. Un SKIP no acredita Electron. FilmMaker debe abrirse en **Electron**, no en navegador externo.

Desde una **segunda terminal**, misma raíz:

```bash
export JAVA_HOME="/usr/lib/jvm/java-21-openjdk-amd64"
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
cd filmmaker-mobile
npm ci
npm run sync
cd android
bash ./gradlew assembleDebug --max-workers=2
adb devices
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Esperado: Vite y Capacitor sync correctos, `BUILD SUCCESSFUL`, teléfono `device`, instalación `Success`. Ante `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, **NO desinstalar ni borrar datos**.

## 2. QA operacional

| ID | Acción | Resultado requerido |
|---|---|---|
| S03-01 | Abrir película y activar Cámara móvil en PC, vincular desde Z2473 por Wi-Fi | Vídeo nuevo y rotación real como S02; nombre de escena coherente |
| S03-02 | Rotar entre vertical/horizontal sin cambiar escena | Sin deformar ni recortar imagen; bandas si la proporción difiere |
| S03-03 | En FilmMaker seleccionar Equilibrado, Ahorro y Detalle sucesivamente | UI muestra perfil solicitado o error explícito, sin caída de conexión; comparar FPS/bitrate/dimensiones **medidos**, no solo selector |
| S03-04 | Capturar pantalla de datos `film.frame`/configuración producción antes y después | Inalterados por calidad del monitor |
| S03-05 | Monitor encendido 2 minutos en escena representativa | Anotar en PC FPS/bitrate/CPU/RAM y en Z2473 FPS/bitrate/resolución/CPU/PSS/RAM libre; sin cierres |
| S03-06 | Revisar RTT p50/p95 y latencia estimada de vídeo | Si `captureTime` no existe debe aparecer `—`, no valor inventado |
| S03-07 | Pausar render o cortar Wi-Fi hasta superar 2.5 s | Indicar imagen obsoleta; no aceptar orientación cuando no hay fotogramas recientes |
| S03-08 | Cerrar DataChannel/desconectar manualmente | Sensor liberado y aviso de enlace perdido; nueva sesión requiere PIN renovado |
| S03-09 | Volver a emparejar y repetir cambio de perfil | Sin timers/callbacks de sesión antigua; métricas nuevas |
| S03-10 | Guardar/reabrir película, Editor y Player habituales | Sin modificación de `.nfm`, grabación, Cinematics o runtime |

**No asumir PASS** si el codificador WebRTC ignora el perfil. Algunas implementaciones permiten fijar bitrate, pero no escalado; registrar el mensaje exacto y la resolución real. **No afirmar 60 FPS** por el nombre del perfil: la fuente S02 solicita `captureStream(10)`.

## 3. Evidencias a devolver

- Resumen Node con tests PASS/FAIL/SKIP y final de Gradle.
- Captura del panel FilmMaker con selector en tres perfiles y cifras de FPS, bitrate, CPU y RAM.
- Captura del Z2473 en al menos dos perfiles con FPS, bitrate, dimensiones y PSS/RAM; indicar si la latencia de vídeo muestra `—`.
- Duración de prueba sostenida y si hubo pérdida de imagen, rotación bloqueada, reconexión correcta o algún error literal.
- No enviar el PIN ni fotografías privadas del entorno, salvo petición específica de diagnóstico.

## 4. Aceptación

El Gate puede marcarse **QA LOCAL PASS** únicamente si el usuario confirma recepción, fidelidad, perfiles/errores, reconexión y regresiones. Si un dispositivo no admite parámetros, registrar `NO SOPORTADO` como hecho y corregir o resolver contractualmente; no falsear el perfil. Cierre requiere evidencia, aprobación expresa y actualización de las seis hojas del ledger.

## 5. QA adicional CORR-001 — errores al cerrar / instancia única

**Antes de iniciar:** guardar el trabajo en cualquier FilmMaker/LevelForge abierto y cerrar de manera normal todas las instancias anteriores (especialmente carpetas S01 mezcladas). No desinstalar ni borrar datos. El bloqueo de instancia única en Electron puede enviar `second-instance` al proceso anterior, aunque el nuevo comando se ejecute desde S03.

1. Confirmar con `pwd` que la terminal está dentro del `...MONITOR_S03_G001_INTEGRAL_CORR_001_SOURCE_BASELINE` extraído **en carpeta nueva**.
2. Instalar dependencias con `npm ci`; ejecutar la suite acumulada de la sección 1: **62 pruebas** esperadas cuando dependencias disponibles. `node --check electron/main.cjs` debe terminar sin errores.
3. Ejecutar `npm run filmmaker -- --build` en Electron. Vite PASS **no demuestra** Electron PASS: la ventana debe abrir y mantenerse activa.
4. Abrir una película, cerrar FilmMaker normalmente, volverlo a abrir; realizar dos cierres sucesivos. No debe aparecer `Object has been destroyed`.
5. Mientras FilmMaker esté abierto, ejecutar el comando de lanzamiento una segunda vez desde otra terminal. La instancia existente debe recibir foco, sin crash ni sesiones duplicadas.
6. Probar vínculo con Z2473 y desconexión después de cerrar la ventana, confirmando que no quedan sesiones del monitor activas.
7. Continuar QA de perfiles y rendimiento de la sección 2. No marcar S03 aprobado si únicamente se eliminó el error de cierre.

**Evidencia:** última línea del build, inicio/cierre normal, segundo lanzamiento, y cualquier `electron/main.cjs:<línea>` nuevo. Para distinguir procesos, aportar `pwd` de ambas terminales. Android S03 sigue sin evidencia `BUILD SUCCESSFUL`.

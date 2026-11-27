# S02-G001-INTEGRAL · QA real PC–ZTE Z2473

**Estado: IMPLEMENTADO EN FUENTES · TEST NODE PARCIAL PASS · BUILD/QA LOCAL PENDIENTES · NO CERRADO.**

## 1. Preparación Linux — trabajar únicamente en el último SOURCE_BASELINE S02

Extraer el ZIP S02 en carpeta **nueva** bajo `~/Desktop/`. Conservar S01A y CORR004. En la raíz de esa carpeta:

```bash
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
npm ci
node --test scripts/test-filmmaker-mobile-live-bridge-s02-g001.mjs scripts/test-filmmaker-mobile-live-bridge-s02-electron.mjs scripts/test-filmmaker-mobile-capabilities-s01-g001.mjs scripts/test-filmmaker-mobile-visual-tracking-s01a.mjs
```

Esperado: **46/46 PASS** si esbuild y Electron/Vite funcionan; SKIP no equivale a PASS. Si Electron falla en el fixture WebGL, devolver el log exacto. No lanzar navegadores externos. En el PC continuar:

```bash
npm run filmmaker -- --build
```

La ventana Electron de Nether FilmMaker debe abrir una película/escena con el viewport real. En **Cámara → Cámara móvil · Enlace LAN**, pulsar «Activar enlace», copiar la dirección `IP:PUERTO` y el código de 12 dígitos. Mantener el proceso abierto. Si aparecen varias IP, elegir la de la red Wi-Fi local; no usar 127.0.0.1, VPN/Docker o Internet.

## 2. Preparación Android — otra terminal, misma raíz

```bash
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
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

Esperado Gradle `BUILD SUCCESSFUL`, ADB dispositivo `device`, instalación `Success`. **No desinstalar ni borrar datos** si hay conflicto de firma. No se ha compilado aquí y el usuario debe verificarlo.

## 3. Matriz QA física S02

| ID | Acción | PASS demostrable |
|---|---|---|
| S02-QA-01 | PC y Z2473 en misma red Wi-Fi, escena abierta | IP privada correcta; servidor listo; teléfono abre app existente |
| S02-QA-02 | Emparejar IP/PIN correcto | Sesión WebRTC conecta; monitor muestra **imagen real** del visor y nombre de escena; frames decodificados > 0 |
| S02-QA-03 | Rotar ZTE lentamente | El encuadre de FilmMaker gira en PC y en teléfono, con orientación coherente y sin saltos manifiestos |
| S02-QA-04 | Teléfono quieto | Imagen estable; contador de muestras y FPS coherente; sin movimiento de posición inventado |
| S02-QA-05 | Moverse físicamente sin marcadores/ARCore | **No** declarar traslación 6DoF ni usar joystick para sustituirla |
| S02-QA-06 | Desconectar manualmente y reconectar | PC y teléfono liberan sesión; nuevo PIN y vinculación válida, sin callbacks antiguos |
| S02-QA-07 | Bloquear pantalla o dejar app en segundo plano | Detiene sensor/control; no continúa aplicando orientación obsoleta |
| S02-QA-08 | Pérdida temporal de Wi-Fi o cortar la sesión | No se sigue enviando orientación; aviso de imagen perdida y recuperación mediante nueva sesión |
| S02-QA-09 | PIN erróneo y segundo teléfono (si disponible) | PIN inválido rechazado; solo una cámara vinculada |
| S02-QA-10 | Registrar FPS/RTT y fluidez durante 2 min | Reportar valores reales y cortes; ninguna tasa se presupone |
| S02-QA-11 | Abrir/guardar película normal, Editor y Player | Sin regresión de proyecto, `.nfm`, escenas, runtime y exportación |
| S02-QA-12 | Revisión contractual | No hay colisiones, traslación 6DoF ni grabación remota declaradas como PASS |

El test automático Electron comprueba un canvas y canales WebRTC simulados **dentro de Electron**, pero no sustituye S02-QA-02/03 en el teléfono real. Si no se puede establecer Wi-Fi local, registrar el bloqueo, **no** concluir que WebRTC funciona.

## 4. Evidencia a devolver

- Resumen del comando Node (PASS/FAIL/SKIP y mensajes de fallo), final Gradle `BUILD SUCCESSFUL` o error completo.
- Estado visible FilmMaker PC: `IP:PUERTO`, fase y FPS (puede ocultarse el PIN al compartir capturas, NO compartir el código de emparejamiento).
- En el teléfono: fase, `Fotogramas decodificados`, `Orientaciones enviadas`, RTT p50/p95; decir si la imagen y el giro funcionan realmente.
- Ante error, fecha/hora local, mensaje exacto, si teléfono y PC comparten Wi-Fi y si existen varias IP.
- No enviar vídeo, imágenes privadas de la habitación ni proyectos salvo necesidad expresa.

## 5. Cierre

El Gate **no** se declara PASS ni CERRADO por abrir el socket, compilar o ver un vídeo sintético. Exige imagen real de FilmMaker y orientación en el Z2473, prueba de caída de conexión, aprobación del usuario y resolución documental de CA-MC-002. S01A queda abierto para precisión 6DoF y S04 para colisiones; son asuntos distintos.

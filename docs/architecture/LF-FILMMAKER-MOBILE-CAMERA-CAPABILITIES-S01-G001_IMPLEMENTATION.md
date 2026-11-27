# Nether FilmMaker · capacidades de cámara móvil S01

Fecha: 2026-11-04. Gate `LF-FILMMAKER-MOBILE-CAMERA-CAPABILITIES-S01-G001`.

**Autorización literal recibida DESPUÉS de la declaración corregida:** «Listo. LF-FILMMAKER-MOBILE-CAMERA-CAPABILITIES-S01-G001 autoriza comenzar».

**Estado tras QA Java: IMPLEMENTADO EN FUENTES; 20 Node PASS + 1 SKIP sin esbuild; Vite y Capacitor Sync PASS en Linux del usuario sobre baseline S01 corregido; `:app:compileDebugJavaWithJavac` FAIL por `JSONException` no manejada en `MobileCapabilitiesPlugin.java:199`; corrección Java aplicada pero NO RECOMPILADA; QA DEL Z2473 PENDIENTE; NO APROBADO; NO CERRADO.** S00 y CA-MC-001 fueron aprobados documentalmente; SOURCE_BASELINE de cierre S00 permanece vinculante.

## Objetivo, mecanismos y alcance

El teléfono diagnostica exclusivamente capacidades locales necesarias para una futura cámara/control de FilmMaker. No se reutiliza como editor 3D, no se convierte en un servidor de seguimiento, no conecta al PC y no escribe claves de película. El diagnóstico se integra en `filmmaker-mobile/` con el mismo `appId`, actividad, paquetes Capacitor y almacenamiento de usuario. El editor de escritorio conserva su UI y sus funcionalidades.

- `MainActivity.java` registra `MobileCapabilitiesPlugin` antes de crear el Bridge existente.
- `MobileCapabilitiesPlugin.java` inspecciona Android/WebView, memoria notificada por ActivityManager (sin sumar RAM virtual), sensores disponibles, cámaras y permiso de cámara. Muestra orientación mediante `SensorManager.TYPE_ROTATION_VECTOR` o `TYPE_GAME_ROTATION_VECTOR` durante 4 segundos; emite cuaterniones XYZW sin atribuir traslación.
- Se incluye **ARCore Android SDK 1.54.0** para consultar `ArCoreApk.checkAvailabilityAsync` con `android:value="optional"`; no instala servicios AR ni abre cámara automáticamente. Un botón independiente solicita permiso y otro requiere acción explícita para intentar la instalación, solo cuando el servicio confirma soporte.
- Si el servicio está **SUPPORTED_INSTALLED** y el permiso está concedido, `ArPoseProbe.java` crea una sesión ARCore temporal y un `GLSurfaceView` mínimo con textura externa OpenGL, obtiene `Frame.getCamera().getPose()` y registra estados TRACKING/PAUSED y posición en metros durante cinco segundos. No renderiza la escena, no graba cámara, no anuncia 6DoF si no hay muestras. Se libera sesión/cámara/superficie al finalizar, fallar o suspenderse.
- `main.js` distingue la plataforma Capacitor al abrir la app: Android carga `MobileCapabilities.vue` y el PC carga `FilmApp.vue` junto a sus registros de editor habituales. El parámetro `?mobile-diagnostics` permite previsualizar en navegador el diseño, pero **nunca** genera datos simulados y muestra una advertencia.
- `mobile-capability-contract.mjs` clasifica el informe sin convertir orientación, ARCore instalado o poses inventadas en certificación 6DoF; genera JSON local. Usa `saveBytes` ya existente para guardar/compartir evidencia solo por acción expresa del usuario.

## Contraste con el contrato aprobado

| Requisito | Estado S01 |
|---|---|
| MC-01: APK especializado | Pantalla de diagnóstico en fuente implementada. Ejecución APK NO VERIFICADA. Vista definitiva de monitor corresponde a S03. |
| MC-02: autoridad PC | No se toca escena ni cámara del PC; no hay red. |
| MC-03: reutilizar lo existente | MainActivity, Capacitor, flujo `saveBytes` y entrada Vue extendidos; `OperatorRig`, `session`, `.nfm`, Player y Cinematics intactos. |
| MC-04: capacidades comprobadas | Instrumentación nativa y ARCore disponible en fuente. Resultados reales del Z2473 NO VERIFICADOS. |
| MC-05: referencia espacial | Se registra referencia cruda Android/ARCore, en metros, XYZW. No se calibra ni se mapea a LevelForge en S01; requiere S02/S05. |
| MC-06…MC-16 | Fuera del Gate; LAN, monitor, colisiones, grabación e integración no implementados. |

## Límites y salvaguardas

- `ARCore Availability.SUPPORTED_INSTALLED` indica una posibilidad, no una sesión exitosa. Una sesión puede fallar por servicios, permiso o cámara ocupada. `UNKNOWN_*` tampoco prueba incompatibilidad.
- La orientación del sensor es **3DoF** y el acelerómetro por sí solo no resuelve caminata posicional estable; ni las muestras locales de ARCore certifican precisión de rodaje continuo.
- Las poses se capturan en la referencia local de ARCore; **no** se transforman al sistema Y-up de la película ni se usan como autoridad de cámara.
- El overlay GL minimalista no presenta imagen del mundo real; el usuario no debe caminar mirando el teléfono durante la prueba. S01 no debe hacerse pasar por monitor remoto.
- El paquete de ARCore en formato AAR **no es Apache-2.0 genérico**: está sujeto a los *ARCore Additional Terms of Service*; el código de ejemplo publicado por Google usa Apache-2.0. Consultar términos antes de distribución comercial.
- No se modifican `src/filmmaker/operator.js`, `session.js`, `film.js`, `montage.js`, `.nfm`, exportación, Cine­matics, el puente VS Code o la física; no se crea segundo proyecto Android ni `capture-app` nuevo.

## Dependencias y fuentes verificadas

- Capacitor Native Android (registro de plugin en `MainActivity`): https://capacitorjs.com/docs/v6/android/custom-code
- ARCore opcional y comprobación de servicio: https://developers.google.com/ar/develop/java/enable-arcore
- `ArCoreApk.checkAvailabilityAsync`: https://developers.google.com/ar/reference/java/com/google/ar/core/ArCoreApk
- Sesión ARCore con `setCameraTextureName` y `update`: https://developers.google.com/ar/reference/java/com/google/ar/core/Session
- ARCore SDK 1.54.0 disponible como release; existe 1.56.0 más reciente, pero no se adopta en S01 para no ampliar el contrato de versiones: https://github.com/google-ar/arcore-android-sdk/releases
- Licencia de AAR y términos adicionales: https://github.com/google-ar/arcore-android-sdk/blob/main/LICENSE

**Dependencia de entorno**: esta sesión de trabajo dispone de JDK 21 pero no Android SDK, node_modules ni caché npm completa. No se generó APK; la compilación y el ensayo real del teléfono son el siguiente paso de QA. No atribuir a esta entrega soporte AR nativo confirmado ni resultado de seguimiento del Z2473.

## Ajuste QA S01 · Vite/esbuild sin top-level await

En el primer QA local el usuario obtuvo 18/18 pruebas Node PASS, pero la construcción de Vite falló con dos errores de `Top-level await` bajo el target es2020. El punto responsable era `src/filmmaker/main.js`, al resolver condicionalmente las entradas Vue. Se corrigió **dentro del mismo Gate S01**: `mountFilmMaker()` encapsula las importaciones `await` y se invoca sin esperar en el nivel superior. No cambia la selección de la pantalla Android ni el editor PC y no se modifica `vite.config.js`, `OperatorRig`, `.nfm`, ARCore ni dependencias. `scripts/test-filmmaker-mobile-capabilities-s01-g001.mjs` añade S01-19 (regresión estructural) y S01-20 (transpilación es2020 cuando existe `esbuild`).

Esta corrección **no ha sido compilada aquí**: 19 PASS y un SKIP por esbuild no instalado. Debe repetirse `npm ci`, `node --test ...`, `npm run apk` en el SOURCE_BASELINE corregido y entregar salida de compilación/diagnóstico físico. El error anterior queda registrado, no borrado ni marcado como resuelto con evidencia de compilación inexistente.

## Corrección QA S01 · checked JSONException de Android (2026-11-04)

**OBSERVADO EN EL SOURCE_BASELINE S01 CORREGIDO:** JDK 21, SDK Android API 36, Vite (`✓ built`) y Capacitor (`Sync finished`) funcionaron en Linux del usuario. Gradle ejecutó la compilación Java y falló en `MobileCapabilitiesPlugin.java:199` porque `JSONArray.put(double)` puede lanzar `org.json.JSONException`. Se obtuvo `BUILD FAILED`, no APK. El aviso de API obsoleta en `ArPoseProbe.java` es independiente y no detuvo la compilación. Los intentos previos con rutas antiguas, Java 17 o sin Android SDK quedan registrados como problemas anteriores de entorno, no como fallos actuales de código.

**CAUSA RAÍZ DEL BUILD FAIL ACTUAL:** la rama `SensorEventListener.onSensorChanged` serializaba cuatro componentes de cuaternión con `JSArray.put(double)` sin capturar la excepción comprobada exigida por Android. Los tests Node previos no compilaban Java y no detectaron ese error.

**CAMBIO LIMITADO DENTRO DEL GATE:** se importó `org.json.JSONException` y se capturó la excepción alrededor de la serialización de componentes XYZW; ante un valor no serializable se desregistra la escucha activa, se cancelan temporizadores, se rechaza la llamada de diagnóstico y no se exporta una muestra inválida. No se altera el orden del cuaternión, el sensor, ARCore, el flujo de la app ni la clasificación 3DoF/6DoF. Se añadió test estructural S01-21 para exigir el manejo de excepción.

**EVIDENCIA DE ESTA CORRECCIÓN:** `node-java-exception-correction.log`: **20 PASS, 1 SKIP** (esbuild no instalado en este entorno), 0 FAIL. La compilación Java de la corrección y el APK real **NO VERIFICADOS**. Se requiere repetir Gradle en el Zorin/Linux del usuario antes del QA físico Z2473.

## QA real Z2473 + corrección de permiso CORR-004 (2026-11-04)

El usuario ejecutó el APK en el Z2473, exportó el diagnóstico S01 y confirmó después «El scroll funciona». Evidencia en `docs/qa/evidence/LF-FILMMAKER-MOBILE-CAMERA-CAPABILITIES-S01-G001/user-z2473-diagnostic-scroll-pass-20261104.md`. No declarar S01 aprobado/cerrado: la aprobación integral no se ha recibido.

**OBSERVADO:** diagnóstico nativo Android 15, 44 entradas de sensores, dos cámaras, 40 muestras válidas de orientación 3DoF, `hasTranslation:false`, permiso `granted`, `diagnosticErrors:[]`; ARCore `UNSUPPORTED_DEVICE_NOT_CAPABLE`, sin sesión y sin pose métrica. **QA LOCAL SCROLL PASS** declarado por el usuario para CORR-003. El BUILD Android `SUCCESSFUL` anterior correspondía a CORR-002; no atribuirlo a las correcciones CORR-003 o CORR-004.

**DEFECTO:** Android serializa `PermissionState.GRANTED` como `granted` en el inventario; la UI comprobaba `GRANTED` literalmente al habilitar/deshabilitar los botones de permiso y AR. **CORR-004 dentro de S01:** se añade `cameraPermissionGranted` al contrato existente de diagnóstico y se reutiliza desde `MobileCapabilities.vue`. Reconoce ambos formatos, rechaza los demás; la condición independiente `SUPPORTED_INSTALLED` sigue bloqueando ARCore en el Z2473. Caso Node S01-23. No se modifican interfaces de FilmMaker PC, captura cinematográfica, código nativo, `.nfm`, Player ni LAN.

**EVIDENCIA LOCAL:** `node-permission-correction-004.log`, 22 PASS, 1 SKIP por ausencia de esbuild, 0 FAIL. **PENDIENTE:** build Android CORR-004, QA del estado de botones en Z2473, aprobación del usuario, cierre documental S01 y registro posterior en ledger. S01A `LF-FILMMAKER-MOBILE-CAMERA-VISUAL-TRACKING-FEASIBILITY-S01A-G001` fue autorizado literalmente, pero su implementación queda bloqueada hasta cierre S01 por prerrequisito del propio Gate.

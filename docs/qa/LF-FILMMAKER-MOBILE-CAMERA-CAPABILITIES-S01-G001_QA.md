# QA · Cámara móvil S01 (ZTE Blade A56 Z2473)

Fecha: 2026-11-04. Gate autorizado `LF-FILMMAKER-MOBILE-CAMERA-CAPABILITIES-S01-G001`.

**Estado actual: implementación Java corregida en fuentes; Node 20 PASS, 1 SKIP (esbuild ausente aquí), 0 FAIL. QA local del usuario: Vite y Capacitor Sync PASS en baseline S01 corregido; Java `:app:compileDebugJavaWithJavac` FAIL por `JSONException` antes de corregir. Nueva compilación Java, APK y Z2473 NO VERIFICADOS; NO APROBADO; NO CERRADO.**

## QA del usuario y corrección dentro del mismo Gate S01 (2026-11-04)

El usuario ejecutó los comandos desde `~/Desktop/LevelForge_VSCODE_EXTENSION_INTEGRATION_S03_G001_SOURCE_BASELINE`, **no desde la carpeta del SOURCE_BASELINE S01 entregado**. El contenido de ese directorio no está disponible para compararlo byte a byte. Esto es una desviación de baseline, no prueba de que haya perdido archivos.

**Observado en la salida proporcionada:** `npm ci` de raíz y móvil completaron; las 18 pruebas originales S01 dieron PASS; `npm run apk` detuvo el proceso durante `vite build` tras transformar 832 módulos. `esbuild` emitió dos errores de `Top-level await` para el target por defecto (`chrome87`, `edge88`, `es2020`, etc.), en los imports dinámicos de `src/filmmaker/main.js`. **Gradle no empezó; no se generó APK ni se inició QA real.** El warning `node:module` de `jolt-physics` y las vulnerabilidades de `npm audit` se registran por separado: no son la causa inmediata del build fallido; no autorizar una actualización masiva de dependencias.

**Corrección en S01 ya autorizado:** `src/filmmaker/main.js` introduce una función asíncrona `mountFilmMaker()` y ejecuta los `await` de imports dentro de ella. Conserva el comportamiento Android/PC y el target Vite vigente. El test S01-19 comprueba la estructura del arranque; S01-20 intenta `esbuild.transform` con `target: es2020` si esbuild está instalado. Aquí: **19 PASS, 1 SKIP**, sin fallos; la verificación real de `vite build`, `Gradle` y APK sigue pendiente de repetir en Linux del usuario.

Evidencia: `docs/qa/evidence/LF-FILMMAKER-MOBILE-CAMERA-CAPABILITIES-S01-G001/user-build-failure-20261104.md` y `node-build-correction.log`. Se conserva la evidencia histórica original `node-s01.log` (18/18 PASS) sin editarla.

## Evidencia previa ejecutada en este entorno

| Comprobación | Resultado real | Evidencia |
|---|---|---|
| Contrato de resumen, fuente nativa, orientación y muestras AR; guardas contra NaN/fuentes sintéticas | **18/18 Node PASS**, 0 FAIL | `evidence/LF-FILMMAKER-MOBILE-CAMERA-CAPABILITIES-S01-G001/node-s01.log` |
| `node --check` sobre `src/filmmaker/main.js` y contrato `mobile-capability-contract.mjs` | **Sintaxis PASS** | `node --check` ejecutado |
| Suites de regresión anteriores FilmMaker (`frame`,`anim`,`anim-zip`) | **20 PASS, 1 FAIL** por `ERR_MODULE_NOT_FOUND` en `test-filmmaker-anim-zip-s01-g001.mjs`; los 20 ejecutados pasaron | `evidence/.../node-baseline-attempt.log` |
| `npm ci --offline --ignore-scripts --no-audit --no-fund` en `filmmaker-mobile/` | **ENOTCACHED** (`yauzl`); dependencias no instaladas | `evidence/.../npm-offline-attempt.log` |
| Gradle / compilación APK / Vite / Electron | **NO EJECUTADOS**, Android SDK y node_modules no disponibles | Comprobación de herramientas del entorno |
| Z2473, sensores, permisos, ARCore, poses reales | **NO VERIFICADOS**; el teléfono no es accesible desde esta sesión | Pendiente de QA local del usuario |

Las suites Node verifican funciones puras y presencia de puntos de integración en el código. **No demuestran compilación Java, ejecución del plugin en Android, tracking 6DoF ni ausencia de fallos en la UI real**.

## Procedimiento de instalación y QA del usuario

1. Trabajar sobre `SOURCE_BASELINE` S01 extraído en una carpeta nueva, sin sobrescribir proyectos, películas o una instalación con datos.
2. Con Node/npm, JDK 21 y SDK Android API 36 ya configurados, desde la raíz del proyecto ejecutar:

   ```bash
   npm ci
   node --test scripts/test-filmmaker-mobile-capabilities-s01-g001.mjs
   node --test --test-concurrency=1 scripts/test-filmmaker-frame-s01-g001.mjs scripts/test-filmmaker-anim-s01-g001.mjs scripts/test-filmmaker-anim-zip-s01-g001.mjs
   cd filmmaker-mobile
   npm ci
   npm run apk
   ```

   Esperado tras `npm ci`: nuevas 20 PASS (incluido target es2020), regresión 21 PASS y `filmmaker-mobile/android/app/build/outputs/apk/debug/app-debug.apk` tras `BUILD SUCCESSFUL`. **Estas salidas son esperadas, NO comprobadas en este entorno**.
3. Instalar sobre el APK anterior **solo si la firma de instalación lo permite**. En Linux, con adb configurado: `adb install -r filmmaker-mobile/android/app/build/outputs/apk/debug/app-debug.apk`. Si se informa firma incompatible, **no desinstalar ni borrar los datos**; reportar el mensaje.
4. En el ZTE Z2473, abrir Nether Film Maker. Esperado: pantalla *Diagnóstico del teléfono*, no FilmApp/escena completa. Actualizar inventario y comprobar modelo, software `MyOs15.0.2_Z2473_LA2` si Android lo expone en `softwareBuild`, Android 15, WebView, RAM física comunicada por SO, sensores y cámaras.
5. Ejecutar la muestra de orientación durante cuatro segundos girando suavemente: verificar cuaterniones XYZW finitos, número de muestras y `hasTranslation:false`. **No** declarar caminata ni 6DoF con este resultado.
6. Denegar temporalmente el permiso de cámara y verificar que se bloquea la sesión AR. Concederlo voluntariamente, actualizar inventario; comprobar que no se abre cámara automáticamente.
7. Interpretar la disponibilidad ARCore exactamente como la comunica el SDK, sin suponer soporte oficial por modelo o versión Android. Si el servicio está ausente y la app muestra soporte, probar instalación solo con consentimiento. Si está instalado, ejecutar el muestreo AR durante cinco segundos sobre una superficie con textura, en un espacio seguro sin caminar mirando la pantalla.
8. Exportar `LF_MOBILE_S01_Z2473_DIAGNOSTICO.json`. Entregar ese JSON y cualquier error/Logcat del APK o de Gradle. Si la app falla al inicio, incluir modelo y Android y la excepción antes de autorizar modificaciones.

## Criterios de aceptación por tipo de resultado

| Resultado observado | Declaración permitida |
|---|---|
| Lista de sensores obtenida + muestras de `TYPE_ROTATION_VECTOR` | Orientación nativa **3DoF observada** en el Z2473; ninguna prueba de traslación |
| ARCore NO soportado / servicio no instalado / consulta ERROR | Registrar estado exacto. **Seguimiento AR no demostrado**; no declarar imposibilidad de otras técnicas |
| ARCore instalado pero sesión ERROR o TRACKING no observado | Sesión **no validada**; conservar error y pruebas para análisis |
| ARCore TRACKING con posición finita en metros y variación sensible | **Candidato 6DoF diagnosticado**, sujeto a validación de estabilidad, referencia, pérdida de tracking y QA del usuario; no certifica película ni calibración |
| APK no compila o firma incompatible | **QA BLOQUEADO**; no cerrar Gate, investigar código/entorno sin desinstalar datos |

Se solicita el informe real y la salida de compilación para evaluar el resultado. **S02 (LAN), S03 (visor), S04 (colisión), S05 (grabación) y S06 (integración) siguen NO AUTORIZADOS.** El Gate de arranque FilmMaker independiente permanece una incidencia separada.

## Iteración QA · compilador Java 21 (2026-11-04)

El usuario ya utiliza la carpeta correcta `LevelForge_FILMMAKER_MOBILE_CAMERA_CAPABILITIES_S01_G001_QA_CORRECTION_SOURCE_BASELINE`. En ella ejecutó `npm ci`, `npm run sync` y `bash ./gradlew assembleDebug --max-workers=2` con JDK 21 y Android SDK API 36. **OBSERVADO:** Vite transformó 832 módulos y completó el build, Capacitor Sync finalizó correctamente y Gradle llegó a `:app:compileDebugJavaWithJavac`; el compilador rechazó `MobileCapabilitiesPlugin.java:199`, `unreported exception JSONException; must be caught or declared to be thrown`. **BUILD FAILED, APK NO GENERADO.** Esto demuestra que la anterior corrección de top-level await permitió alcanzar Gradle, pero no acredita ningún éxito de Android/ARCore.

**CAUSA RAÍZ:** `JSONArray.put(double)` exige manejar `org.json.JSONException`, incumplido por el callback del sensor de orientación. **CORRECCIÓN EN FUENTE:** `try/catch (JSONException)` dentro de `onSensorChanged`, con limpieza de listener y rechazo de muestra no serializable. Se añadió el caso `S01-21`. Node en este entorno: **20 PASS, 1 SKIP por `esbuild` ausente, 0 FAIL**. No se ha ejecutado Gradle ni se ha instalado el APK aquí.

**Evidencia conservada:** `evidence/LF-FILMMAKER-MOBILE-CAMERA-CAPABILITIES-S01-G001/user-android-java-build-fail-20261104.md` resume la salida aportada por el usuario y `node-java-exception-correction.log` registra los tests locales. Los resultados históricos Vite FAIL, 18 PASS y 19 PASS+SKIP no se sustituyen; sirven como evolución de QA.

### Repetición obligatoria tras esta corrección

1. Aplicar la entrega **CHANGE** únicamente si la carpeta S01 anterior no tiene cambios locales y coincide con el SOURCE_BASELINE S01 QA_CORRECTION; en caso contrario, extraer el SOURCE_BASELINE nuevo en una carpeta independiente y conservar la antigua.
2. Con JDK 21 y Android SDK API 36 ya configurados en esa terminal, desde la raíz del proyecto corregido repetir `npm ci` y `node --test scripts/test-filmmaker-mobile-capabilities-s01-g001.mjs`. Esperado con esbuild instalado: **21 PASS, 0 FAIL, 0 SKIP** (predicción, NO verificación).
3. Desde `filmmaker-mobile/` ejecutar `npm ci` y `npm run sync`, entrar en `android/` y ejecutar `bash ./gradlew assembleDebug --max-workers=2`. `bash ./gradlew` evita el permiso de ejecución ausente en el wrapper tras extracción. Esperado: `BUILD SUCCESSFUL` y `app/build/outputs/apk/debug/app-debug.apk`; **resultado aún NO VERIFICADO**.
4. En caso de error de compilación, enviar el bloque desde `> Task ... FAILED` hasta `BUILD FAILED`; no instalar APK ni continuar a S02.
5. Si compila, verificar el archivo APK y solo entonces instalar con `adb install -r` sin desinstalar, previa comprobación de firma/datos existentes. El QA físico Z2473 y el JSON de diagnóstico continúan pendientes.

## QA del usuario · Android BUILD PASS y fallo de scroll · CORR-003 (2026-11-04)

**Evidencia real sobre `JAVA_QA_CORRECTION_002_SOURCE_BASELINE`:** 21/21 Node PASS (sin SKIP), Vite y Capacitor Sync PASS, Gradle **BUILD SUCCESSFUL** con 156 tareas ejecutadas. Esta compilación acredita el APK **anterior a CORR-003**, no una compilación del cambio de scroll. Durante QA móvil, el usuario informó «No puedo hacer scroll»; por ahora no hay vídeo/Logcat.

**Auditoría:** la hoja global `src/styles.css` fija `body { overflow: hidden; }`, compartido por FilmMaker; `.mobile-cap` tenía `min-height:100dvh` sin un desplazamiento propio. **Corrección en el mismo Gate S01:** altura de viewport con `overflow-y:auto`, `touch-action:pan-y` y scroll inercial limitados a `src/filmmaker/MobileCapabilities.vue`. Sin alterar shell Electron, escenas, Player, ARCore, LAN ni `.nfm`.

**Prueba nueva S01-22:** verifica que los estilos móviles habilitan scroll sin eliminar el `overflow:hidden` del editor. Ejecutado aquí: **21 PASS, 1 SKIP** (`esbuild` ausente); 0 FAIL. **Build Vite/Gradle y QA táctil con CORR-003: NO VERIFICADOS.**

**Repetición del usuario:** extraer el nuevo SOURCE_BASELINE en carpeta nueva, sin sobreescribir datos locales. Desde la raíz: `npm ci` y `node --test scripts/test-filmmaker-mobile-capabilities-s01-g001.mjs` (esperado 22 PASS). Después desde `filmmaker-mobile`: `npm ci && npm run sync`, entrar en `android` y `bash ./gradlew assembleDebug --max-workers=2` con JDK21/Android SDK36. Esperado `BUILD SUCCESSFUL`. Instalar el APK solo con `adb install -r`, sin desinstalar previamente. En el Z2473, comprobar gestos verticales del inicio a la última sección, apertura de `<details>`, botones y exportación JSON. Entregar JSON, resultado del scroll y cualquier incidencia. No cerrar S01 hasta recibir QA real.

## QA físico recibido y CORR-004 · Permiso de cámara (2026-11-04)

**Evidencia de usuario:** JSON exportado desde ZTE Z2473 con 40 muestras de rotación 3DoF, 44 entradas de sensores, cámaras frontal/trasera, permiso `granted`, ARCore `UNSUPPORTED_DEVICE_NOT_CAPABLE`, `poseProbe:null`, sin errores diagnósticos. El usuario confirma explícitamente: «El scroll funciona». Por tanto, **QA LOCAL PASS de scroll (CORR-003)**; no se extrapola a aprobación de todo S01. Síntesis trazable: `evidence/LF-FILMMAKER-MOBILE-CAMERA-CAPABILITIES-S01-G001/user-z2473-diagnostic-scroll-pass-20261104.md`.

**OBSERVADO EN CÓDIGO:** `MobileCapabilities.vue` trataba `cameraPermission === 'GRANTED'`, aunque Android envía `granted`; el botón para solicitar permiso permanecía habilitado aun concedido y el de prueba AR no reconocía el permiso. **CAUSA RAÍZ:** comparación sensible a mayúsculas entre valores provenientes de nativo y UI. En el Z2473 ARCore no soportado impide de todos modos la prueba AR; no se atribuye a este defecto la falta de soporte ARCore.

**Corrección CORR-004:** helper `cameraPermissionGranted` en `mobile-capability-contract.mjs`, reutilizado en `MobileCapabilities.vue`, más regresión S01-23 (mayúsculas, minúsculas y estados denegados). `node-permission-correction-004.log`: 22 PASS, 1 SKIP (`esbuild` no disponible), 0 FAIL. **Android BUILD CORR-004: NO VERIFICADO. QA móvil específico CORR-004: PENDIENTE.**

**Prueba para el usuario:** compilar e instalar APK mediante `adb install -r` sin borrar datos; verificar que con el permiso concedido el botón «Solicitar permiso cámara» está deshabilitado, y que tras revocar permiso y actualizar inventario se habilita. En Z2473, «Probar pose AR» deberá permanecer deshabilitado al no ser compatible. Confirmar que inventario/orientación/exportación y scroll siguen funcionando. Si la firma del APK impide actualización, no desinstalar; comunicar error.

**Gates:** S01 no está APROBADO/CERRADO hasta el QA y aceptación del usuario. S01A está autorizado pero su implementación permanece BLOQUEADA por el requisito explícito de cierre S01; S02 no autorizado.

## Cierre posterior a QA de CORR-004 (2026-11-04)

El usuario confirmó que el último JSON correspondía a la corrección instalada y que los botones contractualmente deshabilitados se comportaban como se esperaba: «Sí. Aprobado esa parte. Los botones que desactivado lo que habias mencionado expetuando a otros.» Debe respetarse el alcance de esta aprobación: no significa deshabilitar el resto de botones.

**S01 APROBADO · CERRADO EN ALCANCE DE DIAGNÓSTICO.** Consultar `LF-FILMMAKER-MOBILE-CAMERA-CAPABILITIES-S01-G001_CLOSE.md` y las evidencias del usuario. La compilación de CORR-004 fue confirmada verbalmente, pero no se adjuntó log Gradle de CORR-004; la compilación `BUILD SUCCESSFUL` de 156 tareas era CORR-002. Todas estas declaraciones son históricas, no reinterpretan los FAIL anteriores.

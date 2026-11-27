# Inventario de entrega — LF-FILMMAKER-MOBILE-CAMERA-CAPABILITIES-S01-G001

Fuente vinculante: `LevelForge_FILMMAKER_MOBILE_CAMERA_CONTRACT_S00_G001_CLOSE_SOURCE_BASELINE.zip` (2.134 archivos). Fecha 2026-11-04.

**Comparación de bytes contra el cierre S00:** 11 archivos nuevos (incluye este inventario), 7 modificados, **0 eliminados**, **0 modificaciones inesperadas**. El resto de archivos del SOURCE_BASELINE S00 queda idéntico. No se incluyen `node_modules`, `dist`, `dist-film`, APKs, builds ni cachés.

## Nuevos (11)

- `docs/architecture/LF-FILMMAKER-MOBILE-CAMERA-CAPABILITIES-S01-G001_IMPLEMENTATION.md`
- `docs/qa/LF-FILMMAKER-MOBILE-CAMERA-CAPABILITIES-S01-G001_QA.md`
- `docs/qa/LF-FILMMAKER-MOBILE-CAMERA-CAPABILITIES-S01-G001_FILES.md` (este archivo)
- `docs/qa/evidence/LF-FILMMAKER-MOBILE-CAMERA-CAPABILITIES-S01-G001/node-baseline-attempt.log`
- `docs/qa/evidence/LF-FILMMAKER-MOBILE-CAMERA-CAPABILITIES-S01-G001/node-s01.log`
- `docs/qa/evidence/LF-FILMMAKER-MOBILE-CAMERA-CAPABILITIES-S01-G001/npm-offline-attempt.log`
- `filmmaker-mobile/android/app/src/main/java/com/levelforge/netherfilmmaker/ArPoseProbe.java`
- `filmmaker-mobile/android/app/src/main/java/com/levelforge/netherfilmmaker/MobileCapabilitiesPlugin.java`
- `scripts/test-filmmaker-mobile-capabilities-s01-g001.mjs`
- `src/filmmaker/MobileCapabilities.vue`
- `src/filmmaker/mobile-capability-contract.mjs`

## Modificados (7)

- `docs/qa/LevelForge_DB_Ledger.xlsx` — seis hojas sincronizadas sin borrar historial
- `filmmaker-mobile/README.md` — construcción, instalación conservadora y QA físico
- `filmmaker-mobile/android/app/build.gradle` — ARCore opcional 1.54.0
- `filmmaker-mobile/android/app/src/main/AndroidManifest.xml` — servicio opcional
- `filmmaker-mobile/android/app/src/main/java/com/levelforge/netherfilmmaker/MainActivity.java` — registro de plugin nativo
- `filmmaker-mobile/package.json` — descripción del uso S01 sin alterar comandos/dependencias
- `src/filmmaker/main.js` — selección de raíz según Android/PC

## Eliminados

Ninguno. No se tocaron `OperatorRig`, sesión, `.nfm`, FilmMaker PC, Cinematics, Player, VSCode Local Bridge, física o scripts preexistentes.

## Instalación sin riesgos para datos

**Cambio incremental (CHANGE):** extraer únicamente sobre una copia byte-identica, sin cambios locales, del SOURCE_BASELINE `...S00_G001_CLOSE_SOURCE_BASELINE`. Antes de reemplazar los siete archivos modificados, comparar cualquier versión local; no sobrescribir cambios no inspeccionados. Las rutas del ZIP son relativas a la raíz donde está `package.json`.

**Base acumulada (SOURCE_BASELINE):** extraer en una carpeta nueva, por ejemplo `~/Desktop/LevelForge_FILMMAKER_MOBILE_CAMERA_CAPABILITIES_S01_G001_SOURCE_BASELINE`. **NO extraer ambos ZIP juntos ni borrar los anteriores**. No tocar películas `.nfm`, escenas, proyectos, APKs existentes ni perfiles del usuario.

Los comandos de compilación, ruta de APK y evidencia física están en `_QA.md` y `filmmaker-mobile/README.md`. El paquete no incorpora un APK compilado porque Android SDK/dependencias no estuvieron disponibles durante la implementación. S01 **NO CERRADO**.

## Iteración de corrección QA dentro del mismo S01 (2026-11-04)

Comparar **esta entrega de corrección** contra el `LevelForge_FILMMAKER_MOBILE_CAMERA_CAPABILITIES_S01_G001_SOURCE_BASELINE.zip` anterior, no contra S00. Se conservan sus 2.145 archivos originales. La corrección añade únicamente dos evidencias y modifica los seis documentos/archivos listados abajo; ningún archivo eliminado, ningún proyecto duplicado.

### Archivos nuevos (2)

- `docs/qa/evidence/LF-FILMMAKER-MOBILE-CAMERA-CAPABILITIES-S01-G001/user-build-failure-20261104.md` — QA aportado por usuario (resumen fiel, no log bruto generado aquí).
- `docs/qa/evidence/LF-FILMMAKER-MOBILE-CAMERA-CAPABILITIES-S01-G001/node-build-correction.log` — 19 PASS + 1 SKIP por esbuild ausente en el entorno.

### Archivos modificados (6)

- `src/filmmaker/main.js` — evita top-level await en la entrada existente.
- `scripts/test-filmmaker-mobile-capabilities-s01-g001.mjs` — nuevas pruebas 19/20 (20 comprueba target es2020 al instalar dependencias).
- `docs/architecture/LF-FILMMAKER-MOBILE-CAMERA-CAPABILITIES-S01-G001_IMPLEMENTATION.md` — constancia de incidencia y corrección.
- `docs/qa/LF-FILMMAKER-MOBILE-CAMERA-CAPABILITIES-S01-G001_QA.md` — estado real, fallo anterior y pasos QA posteriores.
- `docs/qa/LF-FILMMAKER-MOBILE-CAMERA-CAPABILITIES-S01-G001_FILES.md` — este inventario acumulado.
- `docs/qa/LevelForge_DB_Ledger.xlsx` — ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE y TRACEABILITY actualizadas sin borrar historial.

### Invariantes y resultado

**Cero eliminaciones.** Ningún cambio en `OperatorRig`, física, `FilmApp.vue`, ARCore, Android/Gradle, `vite.config.js`, la app Player, cámaras filmadas, `.nfm`, LAN o VSCode. Fuente S01 corregida; **no hay evidencia de `vite build` ni Gradle PASS posterior a la corrección**. QA local del Z2473 pendiente. S01 **NO APROBADO/NO CERRADO**.

Extraer el SOURCE_BASELINE corregido en una **carpeta nueva**. No mezclarlo con la base de VSCode S03 donde se corrió el primer QA; tampoco aplicar CHANGE sobre S00 (requeriría todos los cambios de S01). Si se desea instalar incrementalmente, CHANGE exige la base S01 G001 previa byte-idéntica y ausencia de cambios locales; comparar antes de sobrescribir.

## Iteración QA S01 · corrección de compilación Java (2026-11-04)

Esta iteración se compara contra `LevelForge_FILMMAKER_MOBILE_CAMERA_CAPABILITIES_S01_G001_QA_CORRECTION_SOURCE_BASELINE.zip` (2.147 archivos). Todos los archivos que no aparecen abajo permanecen idénticos. No se incluyen builds, APKs, cachés ni `node_modules`.

### Nuevos (2)

- `docs/qa/evidence/LF-FILMMAKER-MOBILE-CAMERA-CAPABILITIES-S01-G001/user-android-java-build-fail-20261104.md` — resumen de evidencia de usuario; Vite/SYNC PASS, Java BUILD FAIL.
- `docs/qa/evidence/LF-FILMMAKER-MOBILE-CAMERA-CAPABILITIES-S01-G001/node-java-exception-correction.log` — 20 PASS, 1 SKIP por esbuild ausente, 0 FAIL.

### Modificados (6)

- `filmmaker-mobile/android/app/src/main/java/com/levelforge/netherfilmmaker/MobileCapabilitiesPlugin.java` — captura checked `JSONException` al serializar XYZW; limpia adquisición y rechaza la muestra inválida.
- `scripts/test-filmmaker-mobile-capabilities-s01-g001.mjs` — nuevo caso de regresión S01-21.
- `docs/architecture/LF-FILMMAKER-MOBILE-CAMERA-CAPABILITIES-S01-G001_IMPLEMENTATION.md` — causa y alcance corregido.
- `docs/qa/LF-FILMMAKER-MOBILE-CAMERA-CAPABILITIES-S01-G001_QA.md` — QA observado y ruta de reintento Gradle.
- `docs/qa/LF-FILMMAKER-MOBILE-CAMERA-CAPABILITIES-S01-G001_FILES.md` — este inventario acumulado.
- `docs/qa/LevelForge_DB_Ledger.xlsx` — actualizaciones en las seis hojas; 2 nuevas filas de EVIDENCE, sin pérdida del historial ni de 12 tablas anteriores.

**Eliminados: ninguno.** Ni `OperatorRig`, ni `session`, `.nfm`, ARCore, LAN, FilmApp, física, Cinematics, Electron, Player o VSCode se modificaron en esta iteración.

**Instalación:** CHANGE se aplica SOLO a una copia byte-idéntica del SOURCE_BASELINE anterior de `...S01_G001_QA_CORRECTION`, comparando cambios locales antes de reemplazar. La entrega `SOURCE_BASELINE` completa se extrae en carpeta nueva; no mezclar CHANGE y SOURCE_BASELINE. El APK aún no está compilado ni QA aprobado.

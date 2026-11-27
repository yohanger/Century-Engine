# QA local — LF-WEATHER-TORNADO-NATURAL-S02-G001

**Estado:** IMPLEMENTADO (candidato) · Node PASS · ELECTRON/BUILD/PLAYER/QA VISUAL NO VERIFICADOS · NO CERRADO.

## Instalación

SOURCE_BASELINE vinculado: `LevelForge_WEATHER_TORNADO_NATURAL_S01_G001_SOURCE_BASELINE(1).zip`.

**Opción recomendada:** extraer `LevelForge_WEATHER_TORNADO_NATURAL_S02_G001_SOURCE_BASELINE.zip` en una carpeta separada, conservando S01. **Alternativa:** aplicar CHANGE solo en el árbol S01 exacto, tras comparar modificaciones locales.

No tocar escenas, recursos `.vfx`, proyectos, `node_modules` existentes ni carpetas de exportación personales. No instalar un navegador externo; los fixtures utilizan Electron embebido de LevelForge. Si el nuevo árbol no contiene dependencias, ejecutar `npm ci` desde su raíz.

## QA automatizado (raíz del proyecto S02)

```bash
node --test scripts/test-weather-tornado-natural-s02-g001.mjs
node --test scripts/test-weather-tornado-natural-electron-s02-g001.mjs
node --test scripts/test-weather-tornado-natural-electron-s01-g001.mjs
node --test scripts/test-weather-tornado-visual-cohesion-corr-g001.mjs
node --test scripts/test-weather-unification-s03-electron-shader-uniforms-corr.mjs
npm run build
npm run electron
```

**Esperado, NO CERTIFICADO por el entorno local del asistente:** 14 nuevos Node PASS; 1 Electron S02 PASS con al menos 13 comprobaciones internas; 1 Electron S01 PASS con 17 verificaciones; Vite debe terminar build Editor y Player. El runner S02 imprime `TN2_WEBGL`; el navegador también informa errores GLSL y compara dos alturas de cámara.

**Medido aquí:** 14/14 nuevos Node PASS, 143/143 Node en regresión principal y 125/125 en regresión complementaria; Electron, Vite y Player exportado no se ejecutaron por falta de `node_modules`. El build S01 aprobado no sustituye build S02.

## QA visual manual del usuario — comparación S01 vs S02

Preparar dos ejecuciones **separadas** (S01 y S02), con la misma escena, hora, semilla, ubicación del tornado, cámara, FOV, resolución y perfil. Evitar usar los dos ZIP sobre el mismo árbol si existen cambios locales.

1. Revisar sin tornado, tormenta sin tornado y fase `organization`: las nubes aprobadas de S01 deben permanecer sin alteraciones perceptibles.
2. En `formation`, comprobar continuidad entre la base nubosa y el embudo, sin cortes ni capas transparentes separadas. Repetir `active`, `weakening`, `dissipation` y `ended`.
3. Repetir con `cloudModel='classic'` y `'cells'`, con semilla fija; comparar capturas de ambos modos.
4. Cámara bajo la nube, dentro de la nube, encima mirando hacia abajo, cerca de la columna y a distancia. Desplazar tornado por script y buscar saltos de volumen.
5. Colocar edificio, pared y vegetación **delante y detrás** de la condensación visible, y comprobar el orden de oclusión. **Limitación conocida: Sky se dibuja al fondo.** Si la nube no aparece delante de un objeto que realmente está detrás, registrar FALLA VISUAL: no declarar S02 cerrado.
6. Comprobar embudo parcial que no alcance suelo, sin alterar fuerzas de Jolt o eventos. Verificar que lluvia y niebla reduzcan visibilidad sin borrar el episodio.
7. Probar Forward+, Mobile, Compatibility, Editor Play y Player exportado. Buscar errores de compilación GLSL, framebuffer y degradación inesperada.
8. Medir FPS, frame time p50/p95 y coste GPU (si existe timer fiable) en la misma escena/cámara/perfil antes/después. Usar los datos N5030/4GB, no inferir rendimiento del número de pasos.

## Evidencia a devolver

- Salida de los tests Electron/Node y `npm run build` completa.
- Capturas o vídeo de fase formación/activo desde tierra y desde arriba, con la cámara fija y el mismo perfil en S01 y S02.
- Comparación de oclusión con objetos delante/detrás y observación si falla.
- Resultado de Player, Play/Stop, cambio de clima, sombras, lluvia, `cloudSeed=0` Save/Load y Compatibility.
- Métricas de rendimiento y mensaje de consola si hay error.

**Cierre:** solo tras resultados reales, corrección de fallos (especialmente profundidad), aprobación del usuario y sincronización del ledger. La implementación entregada es candidata, no FIXED por anticipado.

## CORR-001 — retest tras incidencia Electron

**Recibido:** TN2 Node 14/14 PASS; Electron TN2 **FAIL (13 internas positivas, 1 negativa)** por expectativa equivocada sobre raíz S01; Electron TN1 **SIN EJECUTAR FIXTURE** tras fallo Vite código 1; VC Node 8/8 PASS; build Editor (808 módulos) y Player (408 módulos) **PASS**, con avisos Vite no bloqueantes.

**Corregido:** la fixture S02 comprueba que `reach=0` elimina solamente la columna, **sin borrar la nube madre**, y `w=0` elimina el episodio completo. El runner incluye ahora la salida de Vite si vuelve a finalizar con error. Sin cambios del shader ni del runtime.

Ejecutar desde la raíz del SOURCE_BASELINE CORR-001:

```bash
node --test scripts/test-weather-tornado-natural-s02-g001.mjs
node --test scripts/test-weather-tornado-natural-electron-s02-g001.mjs
node --test scripts/test-weather-tornado-natural-electron-s01-g001.mjs
node --test scripts/test-weather-tornado-visual-cohesion-corr-g001.mjs
```

**Esperado:** TN2 Node **16 PASS** (verificado por asistente), TN2 Electron **1 PASS** con al menos 15 verificaciones y salida `TN2_WEBGL`, TN1 Electron **1 PASS** con salida `TN1_WEBGL`. **Electron nuevo NO VERIFICADO** hasta ejecutar localmente. Si Vite vuelve a terminar con error 1, devolver el log detallado nuevo: no suponer que sea un problema de WebGL.

Conservar QA visual de S01 y capturas anteriores. Contrastar condensación inferior, nube madre, dos alturas, oclusión ante sólidos y Player; sin estos datos **S02 permanece NO CERRADO**.

## CORR-001 — QA usuario aprobado (31 de octubre de 2026)

**OBSERVADO — logs locales del usuario, sobre el código acumulado CORR-001:**

- `node --test scripts/test-weather-tornado-natural-s02-g001.mjs`: **16/16 PASS**, 0 FAIL.
- `node --test scripts/test-weather-tornado-natural-electron-s02-g001.mjs`: **1/1 PASS**, **25 comprobaciones internas**, WebGL2/OpenGL ES3 mediante Electron; `TN2_WEBGL` mostrado.
- `node --test scripts/test-weather-tornado-natural-electron-s01-g001.mjs`: **1/1 PASS**, **17 comprobaciones**, `TN1_WEBGL` mostrado. El error anterior de arranque de Vite no se reprodujo.
- `node --test scripts/test-weather-tornado-visual-cohesion-corr-g001.mjs`: **8/8 PASS**.
- El usuario emitió **«Aprobado»** tras estos logs. **Estado:** APROBADO POR USUARIO para la corrección y pruebas observadas.
- Compilación Editor y Player: **PASS en registro anterior de S02**; no se reejecutaron como parte de este mensaje de retest.

**No inferir de estas pruebas:** QA visual de continuidad nube/embudo con comparación de escenas, orden de oclusión ante objetos sólidos, ejecución independiente del Player exportado ni rendimiento GPU/N5030. Estos requisitos contractuales permanecen **NO VERIFICADOS**, por lo que el Gate S02 queda **APROBADO POR USUARIO · NO CERRADO**. No iniciar S03 por esta aprobación ni alterar el shader de producción.

**EVIDENCE/LEDGER:** `EV-WEATHER-TORNADO-NATURAL-S02-CORR001-QA-USER-PASS` registra los resultados actuales sin borrar el FAIL de Electron anterior ni reescribir histórico. La actualización de QA modifica solo este documento y `LevelForge_DB_Ledger.xlsx`.

## CORR-002 — Contorno geométrico oscuro durante Play (31-10-2026)

El usuario aportó captura en escena `Probando`: un embudo visible acompañado de regiones oscuras de contorno triangular/trapezoidal. Se comprobó que `cloudLayer()` alternaba entre salida de calima/horizonte y `return vec4(acc,T)` según la intersección del cilindro, aun con densidad inferior cero. La corrección utiliza `lowerT` derivado de las muestras existentes y elimina la selección del compositor por `funnelSteps`.

**Documento de causa y alcance:** `docs/architecture/LF-WEATHER-TORNADO-NATURAL-S02-G001_CORR-002_AUDIT.md`.

**Pruebas CORR-002 e instrucciones:** `docs/qa/LF-WEATHER-TORNADO-NATURAL-S02-G001_CORR-002_QA.md`.

**Estado:** implementado, tests Node ejecutados; Electron y comparación visual con la captura original pendientes. No alterar las aprobaciones históricas de S01/S02 ni declarar S02 cerrado.

# QA experimental S01A-G001 · ZTE Z2473

**Estado: IMPLEMENTADO EN FUENTES · QA FÍSICO PENDIENTE · NO CERRADO.** La aprobación S01 se refiere al diagnóstico, no a 6DoF.

## Prerrequisitos

- Último SOURCE_BASELINE S01A, Linux con JDK 21 y Android SDK 36; Node/npm instalados.
- Una impresora que respete dimensiones A4 **100% sin «ajustar a página»**, regla para verificar los 120 mm y cuadrados de 18 mm, espacio iluminado y seguro.
- Python 3.10+ en entorno virtual; instalar `scripts/requirements-filmmaker-s01a.txt`, que fija OpenCV 4.13.0.92. No usar ARCore ni emuladores.
- Usuario confirma cámara trasera al abrir el Intent; Android podría ignorar la preferencia. No certificar captura trasera sin esa comprobación.

## Compilación en Linux (directorio raíz de SOURCE_BASELINE)

```bash
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
npm ci
node --test scripts/test-filmmaker-mobile-capabilities-s01-g001.mjs scripts/test-filmmaker-mobile-visual-tracking-s01a.mjs
cd filmmaker-mobile
npm ci
npm run sync
cd android
bash ./gradlew assembleDebug --max-workers=2
```

Esperado: tests sin fallos, `BUILD SUCCESSFUL`, APK `app/build/outputs/apk/debug/app-debug.apk`. **No confirmado por el asistente; solo los tests locales de fuente y PnP sintética pasaron.** Antes de usar `adb install -r`, verificar el dispositivo y conservar la instalación si cambia la firma.

## Capturas físicas

1. Imprimir `docs/qa/assets/LF-FILMMAKER-MOBILE-CAMERA-S01A/apriltag36h11-id0-120mm-A4.svg` al 100% en A4 y medir el marcador negro: **120 mm**. Imprimir también el tablero de calibración (9x6 esquinas interiores, cuadros de 18 mm). Si las dimensiones no coinciden, **no medir poses métricas**.
2. Instalar APK. Abrir Diagnóstico → «Viabilidad S01A», aceptar cámara, confirmar lente trasera manualmente.
3. Tomar **al menos 8 vistas de calibración** (tipo `calibracion`), con ángulos distintos, tablero completo, lente/zoom/foco y orientación constantes. Exportar el ZIP y enviarlo al PC. Esas fotos permanecen almacenadas solo si el usuario conserva el ZIP; «Descartar capturas temporales» vacía las fotos en memoria de la app.
4. Descartar temporales; hacer otro lote con marcador **ID 0 fijo**: `estatico`, frontal (0,5 y 1 m), lateral (0,5 y 1 m), giro, oclusión, recuperación; medir distancias reales y repetir cada desplazamiento. No sostener la pantalla mientras caminas mirando al suelo o pared.
5. Exportar ZIP de fotografías S01A. Si cámara trasera no está disponible, si ninguna foto se guarda o si el APK se cierra, registrar el error; no inventar muestras.

## Comprobación en PC (desde la raíz del SOURCE_BASELINE)

```bash
python3 -m venv .venv-film-s01a
.venv-film-s01a/bin/python -m pip install -r scripts/requirements-filmmaker-s01a.txt
.venv-film-s01a/bin/python scripts/filmmaker-mobile-visual-tracking-s01a.py self-test
.venv-film-s01a/bin/python scripts/filmmaker-mobile-visual-tracking-s01a.py calibrate --captures /RUTA/ZIP_CALIBRACION.zip --out /RUTA/calibracion_s01a.json
.venv-film-s01a/bin/python scripts/filmmaker-mobile-visual-tracking-s01a.py analyze --captures /RUTA/ZIP_POSES.zip --calibration /RUTA/calibracion_s01a.json --out /RUTA/reporte_s01a.json
```

Para comparar distancias medidas desde la primera foto válida, opcionalmente crear `mediciones.json` con pares `"s01a_02_frontal_0_5m.jpg": 0.50`, usando distancia **realmente medida** y no solo la etiqueta; añadir `--ground-truth /RUTA/mediciones.json` a `analyze`. No declarar precisión sin referencias físicas.

## QA/estados

- **AUTOMATIZADO:** 9 tests S01A PASS incluyendo PnP sintético OpenCV; S01 22 PASS / 1 SKIP por `esbuild` no disponible en este entorno, NO compilado Android aquí.
- **INTEGRACIÓN Android:** NO VERIFICADA, requiere `BUILD SUCCESSFUL` sobre el baseline S01A.
- **QA local táctil/cámara:** NO VERIFICADO para S01A.
- **Medición métrica real:** NO VERIFICADA; sin ZIP físico, no existe dictamen de viabilidad 6DoF.
- **CIERRE:** bloqueado hasta análisis y aprobación de resultados. S02 no autorizado.

Observaciones de QA que deben aportarse: modelo/cámara seleccionada, escaneo del marcador en fotos, tamaño impreso medido, fallo de captura/guardado, calibración RMS, pérdidas, recuperación, error absoluto en m y tiempo de análisis. Las fotos de una vivienda pueden revelar información personal: revisar antes de compartir; solo compartir lo necesario y eliminar capturas privadas después de la evaluación.

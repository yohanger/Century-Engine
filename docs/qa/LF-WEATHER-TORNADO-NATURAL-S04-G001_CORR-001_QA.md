# LF-WEATHER-TORNADO-NATURAL-S04-G001_CORR-001 — QA usuario

**Estado:** IMPLEMENTADO; NODE 257/257 PASS; ELECTRON/BUILD/QA VISUAL NO VERIFICADOS; NO CERRADO.

## Base e instalación

- Extraer `LevelForge_WEATHER_TORNADO_NATURAL_S04_G001_CORR_001_SOURCE_BASELINE.zip` en **carpeta independiente**.
- Alternativa: aplicar `LevelForge_WEATHER_TORNADO_NATURAL_S04_G001_CORR_001_CHANGE.zip` **únicamente** sobre `LevelForge_WEATHER_TORNADO_NATURAL_S04_G001_SOURCE_BASELINE.zip`, tras comparar modificaciones locales.
- Conservar `proyecto_8`, Assets, escenas, backups y baselines S03/S04. No sobrescribir proyectos del usuario.
- Ejecutar desde la raíz que contiene `package.json`. Si faltan dependencias, ejecutar `npm ci`.

## Pruebas Node y Electron

```bash
node --test scripts/test-weather-tornado-natural-s04-corr001.mjs
node --test scripts/test-weather-tornado-natural-s01-g001.mjs scripts/test-weather-tornado-natural-s02-g001.mjs scripts/test-weather-tornado-natural-s02-corr002.mjs scripts/test-weather-tornado-natural-s03-g001.mjs scripts/test-weather-tornado-natural-s04-g001.mjs
node --test scripts/test-weather-tornado-natural-electron-s04-corr001.mjs
node --test scripts/test-weather-tornado-natural-electron-s02-corr002.mjs
npm run build
npm run electron
```

**Esperado, no confirmado en este entorno:** TC4 Node **13 PASS**, S01/S02/CORR-002/S03/S04 Node PASS, TC4 Electron **1 PASS con al menos 24 checks**, TC2 Electron PASS, build Editor y Player PASS. Vite puede dar avisos no fatales de chunks; no confundirlos con fallo.

## QA decisivo en la escena `Probando`

Usar la configuración previa: tormenta intensidad 100 %, tornado centro X=0/Z=−250, radio físico 25 m, velocidad de avance 0. Comprobar la siguiente secuencia completa y grabar **sin cortar** los segundos entre fases:

1. **Desarrollo:** la propia nube empieza a prolongarse ligeramente bajo su base; no hay columna completa, ni tirón abrupto, ni fuerza física activa.
2. **Organización:** se observa descenso continuo y punta incipiente. La nube madre continúa siendo la autoridad visual.
3. **Formación:** el tramo condensado crece de arriba a abajo, afinándose hacia su extremo inferior. La silueta no es cilíndrica ni una columna recortada de golpe.
4. **Activo:** embudo de hombro ancho y base más estrecha, transición irregular; al llegar al suelo hay contacto visual creíble con el polvo S03 cuando la superficie y humedad lo permiten. No debe aparecer corte plano ni el rectángulo de S02.
5. **Debilitamiento/disipación:** se libera sin residuos visuales ni reinicios bruscos.
6. Repetir al menos un encuadre de día y otro de tormenta nocturna, y si procede ambos modos nubosos (`classic`/`cells`). Mover cámara lateralmente y revisar la lectura de cono.
7. En Inspector, verificar **Alcance del viento (m)**: debe afectar solo el rango vertical de influencia física; no es la altura del embudo. Comprobar que el proyecto guardado mantiene los valores anteriores.
8. Verificar Play/Stop y Player exportado independiente. Medir FPS/frame time frente a S04 con mismos parámetros cuando sea posible.

## Evidencia que debe devolver el usuario

Salida TC4 Node/Electron, resultado `npm run build`, vídeo de desarrollo→activo, captura lateral de embudo y del contacto con superficie, confirmación visual del nuevo campo de Inspector y resultado de Player. Indicar si continúa pareciendo cilindro o si la columna aparece de golpe.

**Cierre:** solo tras QA LOCAL PASS y aprobación. No confundir pruebas de pixel/GLSL con realismo aprobado.

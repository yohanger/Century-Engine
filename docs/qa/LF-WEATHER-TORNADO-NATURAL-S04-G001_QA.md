# LF-WEATHER-TORNADO-NATURAL-S04-G001 — QA usuario

**Estado:** IMPLEMENTADO · NODE PASS · ELECTRON/BUILD/QA VISUAL PENDIENTES · NO CERRADO.

## Instalación

Extraer `LevelForge_WEATHER_TORNADO_NATURAL_S04_G001_SOURCE_BASELINE.zip` en carpeta nueva, independiente de `proyecto_8` y del baseline S03. Alternativa: aplicar `LevelForge_WEATHER_TORNADO_NATURAL_S04_G001_CHANGE.zip` **solo** sobre `LevelForge_WEATHER_TORNADO_NATURAL_S03_G001_SOURCE_BASELINE.zip`, después de comparar archivos locales. Preservar escenas, Assets, Player, proyectos y cambios personales.

## Comandos desde la raíz

```bash
npm ci
node --test scripts/test-weather-tornado-natural-s04-g001.mjs
node --test scripts/test-weather-tornado-natural-electron-s04-g001.mjs
node --test scripts/test-weather-tornado-natural-s02-corr002.mjs
node --test scripts/test-weather-tornado-natural-electron-s02-corr002.mjs
node --test scripts/test-weather-tornado-natural-s03-g001.mjs
node --test scripts/test-weather-tornado-natural-electron-s03-g001.mjs
npm run build
npm run electron
```

**Esperado, no confirmado aquí:** TV4 Node 14 PASS; TV4 Electron 1 PASS con al menos 19 verificaciones (`TV4_WEBGL`); TC2 Node 11 PASS; CORR-002 Electron 1 PASS y sin cambio por cilindro vacío; TD3 Node 21 PASS; S03 Electron 1 PASS; build de Editor y Player sin errores fatales. No interpretar avisos de chunks como fallos de compilación.

## Control visual decisivo

1. Abrir `Probando` del proyecto local (`proyecto_8`) sin cambiar la escena guardada. Usar tormenta activa al 100 %, probabilidad de tornado al 100 %, centro X=0 Z=-250, radio 25 m y avance 0 m/s; comparar **S03 frente a S04** con cámara, seed, resolución y perfil iguales.
2. **Formación:** la raíz debe formarse desde la misma nube; el hombro debe ser más denso e irregular. No se admite una tapa redonda ni un cono dibujado por separado.
3. **Activo:** silueta reconocible, movimiento estable sin parpadeo ni torsión rígida. La parte superior debe transmitir peso y continuidad; registrar si la lectura sigue siendo débil.
4. **Color/iluminación:** comparar clima nocturno, amanecer y luz diurna. El tornado debe responder al mismo `cloudsTint`, luz solar y luz ambiental que las nubes, sin una propiedad de color de tornado aparte. El cielo puede ser cromáticamente distinto de la nube por scattering; el tornado no debe parecer un material ajeno a ella.
5. **Regresión:** cambiar cámara (suelo, lateral, sobre base), modo classic/cells, cambiar lluvia, disipación, polvo de S03, agua/humedad, y repetir el caso CORR-002 para verificar que no vuelve el rectángulo oscuro.
6. **Runtime:** observar Play/Stop, ejecución independiente del Player exportado, perfiles de render aplicables y FPS/frame time con S03 bajo condiciones idénticas.

## Evidencia a devolver

Salidas Node/Electron/build, dos capturas A/B con la misma cámara y condiciones (S03/S04), vídeo corto de formación y actividad, capturas del cielo/nube madre en al menos dos condiciones lumínicas, y medidas de frame time si se dispone. Indicar cualquier rectángulo, límite geométrico, columna demasiado luminosa, tronco desconectado, z-fighting u oclusión incorrecta.

**Cierre:** solo con evidencia y aprobación del usuario. El primer PASS de una fixture de píxeles no equivale a fotorrealismo ni a aprobación artística.

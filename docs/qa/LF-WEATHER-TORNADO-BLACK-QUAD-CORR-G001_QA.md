# LF-WEATHER-TORNADO-BLACK-QUAD-CORR-G001 — QA del usuario

**Estado:** IMPLEMENTADO, Node 289 PASS; compilación, render WebGL, Editor y Player NO VERIFICADOS; Gate NO CERRADO.

## Preparación e instalación

Utilizar la raíz del LevelForge actual donde se encuentra `package.json`. Comparar previamente cambios locales; aplicar CHANGE solo sobre el parent SOURCE_BASELINE `LevelForge_WEATHER_TORNADO_VISUAL_FORMATION_CORR_G001_SOURCE_BASELINE.zip`. No extraer el nuevo SOURCE_BASELINE encima del proyecto ya modificado; consérvalo para el siguiente Gate.

## Comandos Linux

```bash
npm ci
node --test scripts/test-weather-tornado-black-quad-corr-g001.mjs
node --test scripts/test-weather-tornado-visual-formation-corr-g001.mjs scripts/test-weather-tornado-transitions-s02-g001.mjs
command -v chromium
LF_VFX_BROWSER="$(command -v chromium)" node --test scripts/test-vfx-webgl-s02-g001.mjs scripts/test-weather-tornado-visual-webgl-corr-g001.mjs
npm run build
npm run electron
```

Si `command -v chromium` no muestra ruta, indicar la ruta real del navegador en `LF_VFX_BROWSER` o instalar el paquete en el SO. **Si Vite no está instalado, el harness WebGL no se ha ejecutado.** Resultado Node del primer runner esperado: 7 PASS, 0 FAIL. WebGL esperado: 2 PASS, 0 FAIL (pendiente de confirmación local).

## Ensayos visuales obligatorios

1. Escena de control con Terreno + Spawn, con meteorología activada y tornados deshabilitados. Grabar cinco segundos y capturar desde la misma posición de cámara, sin cuadros negros.
2. Activar tornado automático o mediante scripting sin recurso VFX3D manual. Grabar las fases desarrollo/organización/formación/actividad/debilitamiento/disipación. **No debe aparecer ningún plano opaco negro ni un embudo instantáneo.**
3. Acercar cámara al emisor; verificar que las partículas tienen contornos difusos y que la condensación tiene color visible, sin cuadrados de bordes duros. Girar cámara y repetir desde lejos.
4. Crear un VFX3D de proyecto sin textura y otro con textura. Verificar que ninguno se ha roto por el Gate.
5. Verificar dos episodios meteorológicos y Play/Stop repetidos; sin partículas residuales. Cambiar de escena y abrir Player si está disponible.
6. Registrar FPS y RAM en condiciones controladas, con el mismo proyecto y hardware; describir diferencias frente al baseline anterior. Confirmar guardado/restauración y escenas existentes.

**Evidencia a devolver:** salidas completas Node/WebGL/build, screenshot o vídeo de los estados 1–5 y giro de cámara, configuración de tornado, mensajes de consola relevantes, resultado en Editor/Player y FPS/RAM si se miden. No declarar PASS visual antes de observarlo. Si el cuadro negro persiste, adjuntar captura con tornado desactivado y activado desde la misma cámara para identificar el objeto culpable.

Jolt WASM real sigue fuera del Gate: JW-04 y la suite 12 casos no se consideran PASS. S13 permanece bloqueado.

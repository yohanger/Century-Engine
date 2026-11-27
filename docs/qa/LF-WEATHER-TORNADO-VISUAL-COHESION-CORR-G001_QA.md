# QA local — LF-WEATHER-TORNADO-VISUAL-COHESION-CORR-G001

**No cerrar sin evidencia local del usuario.** No confundir 206 PASS Node con evaluación visual.

## Instalación

1. Partir del SOURCE_BASELINE Black Quad G001. Comparar antes cualquier cambio local fuera de esa base.
2. Extraer solo CHANGE sobre la raíz de LevelForge, conservando rutas. SOURCE_BASELINE de este Gate se conserva separado como siguiente base.
3. No eliminar `node_modules`, Assets, proyectos, escenas, configuraciones ni sesiones.

## Comandos Linux desde la raíz (junto a package.json)

```bash
npm ci
node --test scripts/test-weather-tornado-visual-cohesion-corr-g001.mjs
LF_VFX_BROWSER="$(command -v chromium)" node --test scripts/test-weather-tornado-visual-cohesion-webgl-corr-g001.mjs
LF_VFX_BROWSER="$(command -v chromium)" node --test scripts/test-weather-tornado-visual-webgl-corr-g001.mjs
npm run build
npm run electron
```

Si `command -v chromium` no devuelve ruta, buscar `chromium-browser` o `google-chrome` y pasar esa ruta a `LF_VFX_BROWSER`.

Resultado de referencia del Gate: **VC 8/8 Node PASS**; la suite amplia verificada aquí es 206/206 Node PASS. WebGL, compilación y Player quedan pendientes de tu entorno.

## Comprobaciones visuales y de integración

- **VC-01:** en fase `development`, la nube mantiene su aspecto meteorológico; sin embudo prematuro.
- **VC-02:** en `organization`, se lee rotación condensada integrada en la base nubosa, sin bolas aisladas.
- **VC-03:** durante `formation`, el embudo se prolonga desde esa base; no comienza como capa desplazada.
- **VC-04:** acercarse y alejarse; comparar paleta y contraste entre nube y embudo. El color debe evolucionar con el preset Weather.
- **VC-05:** mover cámara o cambiar por scripting la posición del tornado; la raíz nubosa debe seguir el mismo centro, sin deslizamiento.
- **VC-06:** `weakening` y `dissipation` deben perder masa progresivamente. Play → Stop → Play sin persistencias visuales.
- **VC-07:** comprobar lluvia, relámpagos, `.vfx` convencionales con/sin textura y nubes sin tornado; sin cambio de color en recursos compartidos.
- **VC-08:** comprobar tanto `cloudModel=classic` como `cloudModel=cells`; registrar si la base nubosa queda desconectada en alguna variante.
- **VC-09:** contrastar Editor y Player exportado, con capturas/vídeo desde la misma cámara.
- **VC-10:** comprobar que no reaparezca ningún quad negro; documentar fase y cámara si ocurre.
- **VC-11:** medir FPS y consumo en tu Pentium Silver N5030 / 4 GB, antes y después; sin declarar PASS de rendimiento sin comparación.

## Evidencia a devolver

Salida completa de las suites Node/WebGL y `npm run build`; vídeo desde cámara fija con desarrollo→formación→actividad→disipación; capturas panorámica y cercana; configuración Weather (nubes clásicas/celdas), salida de consola si falla; comparación Editor/Player y FPS de referencia.

## Pendiente independiente

JW-04 y Jolt WASM 12/12 reales continúan NO VERIFICADOS; no impedirán diagnosticar VFX, pero impiden cerrar la integración física completa y S13.

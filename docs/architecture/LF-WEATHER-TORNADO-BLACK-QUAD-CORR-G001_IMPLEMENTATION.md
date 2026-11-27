# LF-WEATHER-TORNADO-BLACK-QUAD-CORR-G001 — Corrección candidata del emisor meteorológico

## Estado y alcance

Gate autorizado expresamente por el usuario. **IMPLEMENTADO; test Node PASS; GPU/WebGL, Editor y Player NO VERIFICADOS; NO CERRADO.** Baseline parent: `LevelForge_WEATHER_TORNADO_VISUAL_FORMATION_CORR_G001_SOURCE_BASELINE.zip`.

### Evidencia y diagnóstico

- **OBSERVADO (usuario):** captura del 30-10-2026: varios planos oscuros de bordes rectos en Play, junto a terreno; solo hay nodos Terreno y Spawn en la escena, con el tornado meteorológico permitido. No se dispone de captura de RenderDoc ni traza de objeto de GPU.
- **OBSERVADO (código):** `createWeatherVfx3D()` usaba VfxBillboardRenderer sin textura y sprites nominales de 12 m; el perfil podía multiplicar la anchura según altura. Existen hasta 896 partículas y ordenación alfa en el renderer.
- **INFERENCIA:** la ruta sin mapa, los quads amplios y el solapamiento de partículas son candidatos al rectángulo oscuro. **NO está demostrada la causa exacta del color negro en el driver del usuario.** No se adjudica el defecto a Jolt.

## Intervención

Se ha extendido exclusivamente la creación del VFX transitorio dentro de `src/engine/runtime/nodes/vfx.js`:

1. Textura RGBA procedural blanca, de 64 × 64, con alpha circular suave y bordes completamente transparentes. Solo se crea en memoria de runtime, nunca se guarda como recurso `.vfx` ni Asset.
2. El emisor meteorológico entrega esa textura al `VfxBillboardRenderer` existente, utilizando su ruta estándar de textura real, en lugar de depender de la ruta especial sin sampler del shader. No se altera `src/engine/runtime/vfx/render.js` ni el render de recursos VFX genéricos.
3. Tamaño nominal de partícula meteorológica reducido de 12 m a 6 m para mitigar la acumulación visible de planos grandes; se conserva capacidad, semilla, tasa, posición y fases de formación.
4. `dispose()` libera renderer, malla y textura de propiedad meteorológica exactamente al salir de Play, sin liberar recursos compartidos del proyecto.
5. Pruebas y fixture WebGL existentes extendidos. El fixture ahora comprueba el camino con mapa, alpha del recurso, probeta GPU de un quad y muestra el resultado del render sin crear un motor paralelo.

## Arquitectura / compatibilidad

S02 y los Contract Amendments de separación Weather/VFX permanecen vigentes. No hay cambios en World, WindField, Jolt WASM, físicas, guardado, scripting, Player ni esquema `.vfx`. No se introducen gestores paralelos, nuevas ventanas ni artefactos persistidos. El renderer genérico existente sigue admitiendo recursos VFX con o sin textura.

## Verificación y riesgos residuales

- Node: 289/289 PASS, 0 FAIL, 0 SKIP (13 suites, incluidos 7 casos BQ nuevos).
- Sintaxis JS: PASS.
- Chromium/WebGL: **NO EJECUTADO** — falta `node_modules/vite/bin/vite.js`, por dependencias npm incompletas; Chromium sí está instalado en la máquina de trabajo. No es un fallo probado del shader.
- Compilación Vite, Editor, Player, GPU del usuario, colores y FPS: **NO VERIFICADOS**.
- Jolt WASM real: pendiente de otra incidencia y runner JW-04. S13 bloqueado.

La corrección es una **candidata de reducción del artefacto**, no una certificación de eliminación visual. Si el rectángulo persiste tras el QA, debe aislarse el objeto en WebGL/Electron antes de intervenir otra ruta de render. No ocultar emisores ni cambiar contratos para hacer pasar la prueba.

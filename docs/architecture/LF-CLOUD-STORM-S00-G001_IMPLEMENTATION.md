# LF-CLOUD-STORM-S00-G001 — Aproximación atmosférica y relámpagos en nubes

**Estado de entrega:** IMPLEMENTADO EN CÓDIGO FUENTE · NODE TEST PASS · SHADER GL 4.5 COMPILE/LINK PASS · QA ELECTRON/PLAYER NO VERIFICADO · PENDIENTE DE APROBACIÓN Y CIERRE.

## 1. Autoridad y alcance

Gate autorizado literalmente por el usuario: `LF-CLOUD-STORM-S00-G001-NATIVE-APPROACH-AND-LIGHTNING-ILLUMINATION` (18-11-2026). La aprobación de WATER-DEMO CORR-002 no autoriza su integración en LevelForge; este Gate solo modifica el cielo meteorológico y su conexión con rayos existentes.

Se preservan `LF-CLOUD-EVOLUTION-CA-002` (World propietario de clima, CloudField de distribución, CloudVolume del condensado, Sky único renderer), `LF-WEATHER-UNIFICATION-CLOUD-TORNADO-CA-001` (tornado dentro del mismo shader), `LF-WEATHER-LIGHTNING-WORLD-S11-G001`, la semántica Play/Runtime y la congelación de tiempo atmosférico en Edit Mode.

## 2. Auditoría previa (OBSERVADO)

- Fuente primaria `source_baseline.zip`: 3.868 entradas, integridad ZIP PASS. Contiene World, CloudField, CloudVolume, `sky-cloud-volume.js`, `skylib.js`, `viewport-env.js`, `LightningFX` y fixtures Electron previos.
- Referencia `threejs-lightning-storm-main.zip`: 21 entradas, integridad ZIP PASS. Es una composición de planos de nubes texturizados, luz puntual de intensidad aleatoria y texturas Vecteezy; carece de licencia de redistribución específica para esas imágenes en el ZIP. No se incorporan archivos de referencia, shaders, texturas, luces ni lógica de temporización de ese proyecto.
- `World._setPreset()` ya interpola cambios (`_fade`) y `World._startStrike()` ya identifica cada descarga física y la transmite a LightningFX y al trueno. El shader existente ya compone el cielo, las nubes volumétricas y el embudo del tornado, y ya posee `uFlash` para la iluminación general.

## 3. Implementación: responsabilidades y recorrido de datos

### Frente meteorológico en aproximación

`World.frame()` expone un objeto estable `stormFront` (x,z,progress,strength), derivado únicamente del `World._fade` vigente cuando el destino aumenta la actividad de descargas hacia tormenta. La dirección procede del viento efectivo de World, sin nueva simulación, timers, semillas o campos secundarios. Fuera de una transición entrante la fuerza se establece a 0.

`Viewport.setWorld()` copia ese estado a `uStormFront` sin asignaciones por frame en el renderer. `stormFrontMask()` en `SKY_FRAG` atenúa localmente la contribución solar y ambiental dentro del raymarch del volumen ya existente. No crea nubes nuevas ni cambia la autoridad de CloudField/CloudVolume. Es una **aproximación visual direccional del frente**, no una simulación espacial adicional de meteorología.

### Descargas con iluminación volumétrica localizada

Al arrancar la descarga física, `World._startStrike()` fija `strike.cloud` en **coordenadas del mundo** (la nube seleccionada si hay CloudField; si no, la posición calculada desde el observador y el rumbo). Con ello, mover la cámara no desplaza la descarga. `LightningFX` reutiliza la misma `strike.cloud` y la misma identidad `strike.id`.

`World.frame().cloudLightning` es un registro reutilizable, con posición, radio e intensidad procedentes de `World.flash` y de la única descarga física activa. En modo simple, sin tiempo meteorológico o después de terminar la corriente, no se genera una fuente local de nube. El `Viewport` copia sus valores a `uLightningCloud` y `uLightningEnergy`.

Dentro de `cloudLayer()` se calcula una envolvente de distancia al punto real del rayo y se añade energía de dispersión al **mismo acumulador del cloud raymarch**; no se añaden otros draws, buffers ni muestras de ruido. El destello general `uFlash` sigue funcionando, pero se atenúa durante la iluminación localizada para evitar iluminar toda la bóveda indiscriminadamente. La mezcla ambiente para nubes también reduce el aporte global en este caso.

Durante `_bakeEnv()` se ponen a cero tanto el flash general como el local y se restauran después del horneado. Esto evita congelar una descarga transitoria en el IBL de la escena. La modificación no afecta a sonidos, eventos, Gameplay, impactos, Jolt, lluvia ni recursos VFX existentes.

## 4. Cambios de producción y QA

| Archivo | Cambio |
|---|---|
| `src/engine/runtime/world/world.js` | `stormFront` y `cloudLightning` en el frame; origen estable de rayos físicos |
| `src/engine/runtime/render/skylib.js` | Modulación por frente y luz volumétrica localizada, mismas muestras |
| `src/engine/runtime/render/viewport-env.js` | Uniformes por frame y exclusión de flashes en bake IBL |
| `src/engine/runtime/render/viewport.js` | Tres uniformes nuevos en el ShaderMaterial existente |
| `scripts/test-cloud-storm-s00-g001.mjs` | 8 pruebas nuevas de contratos y evolución temporal |
| `scripts/fixtures/weather/cloud-light.html` | 4 comprobaciones WebGL adicionales, capturas A/B |
| `scripts/test-cloud-light-electron.mjs` | Espera mínima de 20 comprobaciones en fixture existente |

No cambian el número de pasos del raymarch, canales RG8, `cloud-volume.js`, CloudField, configuración del Inspector ni dependencias. No se importó una biblioteca Lightning Storm paralela. Requiere WebGL 2 para la textura volumétrica ya existente.

## 5. Límites y contradicciones

- El frente de aproximación es un **efecto de iluminación de la nube existente** basado en la transición real de World. No se representa un sistema de presión frontal, radar ni transporte de masas meteorológicas independiente.
- La luz interna es dispersión volumétrica **aproximada**, no transporte radiativo exacto; no se certifica fidelidad visual al proyecto Three.js de referencia.
- La compilación de GLSL se verificó bajo OpenGL 4.5/Mesa con envoltura compatible, pero WebGL 2/Electron, Play, Player, N5030 4 GB y capturas A/B reales **NO VERIFICADOS**.
- El SOURCE_BASELINE original contiene tests históricos incompatibles con archivos o entornos actuales (documentados en el QA), sin atribuirlos a esta implementación.

## 6. QA y cierre

Ver `docs/qa/LF-CLOUD-STORM-S00-G001_QA.md`. El Gate permanece **ENTREGADO / IMPLEMENTADO EN FUENTES / TEST PASS / NO APROBADO / NO CERRADO** hasta ejecutar pruebas gráficas Editor/Play/Player y recibir valoración del usuario.

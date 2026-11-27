# LevelForge — CORR-003 · Continuación 012: recipientes con geometría temporal conservativa

**Fecha:** 2026-11-11. **Gate vigente previamente autorizado:** `LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-INTEGRAL_CORR-003-ALL-NODES-INSPECTOR-COVERAGE`, Contract Amendment `UPA-CA-002` ratificada. No constituye un Gate nuevo ni autoriza adelantar G009–G014.

**SOURCE_BASELINE de entrada:** `LF_TIMELINE_UNIVERSAL_ANIMATION_S13_G008_G001_CORR003_CONTINUATION_011_COMBUSTION_ENVIRONMENT_SOURCE_BASELINE.zip`, **3.113 archivos**, CRC PASS y comparación de todos los SHA-256 contra el árbol de trabajo: **0 diferencias iniciales**. Estado a la salida: **IMPLEMENTADO EN FUENTES (PARCIAL) · NODE PASS · BUILD/ELECTRON/PLAYER NO VERIFICADOS · CORR-003 ABIERTO**.

## Auditoría previa y diagnóstico

**OBSERVADO:** `Inspector.vue` ofrece en `Node3D` y `RigidBody3D` seis controles de recipientes: `Recipiente abierto`, `Forma interior`, `Interior (m)`, `Líquido`, `Volumen inicial (m³)` y `Caudal de salida`. En 011 solo `pourRate` estaba conectado temporalmente a `WaterWorld`, propietario de los volúmenes. `liquid-containers.js` calcula la capacidad física de cilindro y caja y valida dimensiones, sustancia y volumen inicial. `WaterWorld` conserva `volumeM3`, `capacityM3`, `initialM3`, perfil físico, contabilidad de salida y snapshots. `play-liquid.js` crea la superficie Three.js de la geometría inicial, sin actualizarla ante cambios posteriores.

**CAUSA RAÍZ:** faltaban setters temporales transaccionales para alterar forma/dimensiones del recipiente **sin reemplazar el inventario ni alterar los recursos `.liquid`** y sin recrear geometrías visuales a cada fotograma idéntico. Añadir llaves únicamente al Inspector habría dejado la física y la superficie desactualizadas.

## Contrato técnico implementado

| Owner | Campo | Canal de Timeline | Tipo/validación |
|---|---|---|---|
| Node3D | Forma interior | `node3d.liquidShape` | `enum`: `cylinder`/`box` |
| Node3D | Interior (m) | `node3d.liquidSize` | `vec3`: tres dimensiones entre 0.001 y 10 metros |
| RigidBody3D | Forma interior | `rigidbody3d.liquidShape` | Igual; canal exclusivo de su tipo |
| RigidBody3D | Interior (m) | `rigidbody3d.liquidSize` | Igual; canal exclusivo de su tipo |

1. `liquidGeometryAnimation(ownerType)` se agrega al registro **existente** `nodes/base.js` y se reutiliza en `nodes/physics.js` junto al `liquidPourAnimation` previo. Los descriptores conservan lectura autoral, elegibilidad real (`liquidContainer.enabled`), captura del valor físico vivo, aplicación y restauración, sin tocar `obj.props` ni duplicar clases.
2. `WaterWorld.setContainerGeometry(id, patch)` valida el **estado propuesto completo antes del commit** con el `containerSpec` original y `containerOutflow`, y compara la nueva capacidad contra `c.volumeM3` físico **actual**. Si el líquido no cabe, lanza error sin modificar el recipiente, su inventario ni los balances de masa. En el éxito modifica únicamente `shape`, `size` y `capacityM3` del mismo recipiente. Conserva `volumeM3`, `initialM3`, `liquid`, `pose` y el ledger de transferencias.
3. Los overrides de Timeline se almacenan temporalmente en el root existente `userData.timelineLiquid`; si PlayMode inicia con ellos ya establecidos, `_liquidInit` los respeta al construir el recipiente único. Si falla WaterWorld, no se registra una muestra falsa. `STOP` ejecuta la restauración del descriptor inmediatamente; puede **rechazar** una reducción de capacidad que no contenga líquido vertido posteriormente, en lugar de borrar litros silenciosamente.
4. `_liquidRender` compara la firma `shape/size` actual del recipiente y sustituye solo cuando cambia la `CircleGeometry` o `PlaneGeometry` del `LiquidSurface` existente. Libera la geometría anterior; `_liquidReset` sigue liberando superficie, chorro y vínculo con WaterWorld. No se añaden ventanas, loops, mallas de inventario ni sistemas físicos paralelos.
5. `PropertyKey` aparece junto a «Forma interior» e «Interior (m)» en las mismas filas del Inspector y usa la inserción/lectura normal del Timeline.

**Autoridad:** `WaterWorld` sigue siendo el único dueño de la sustancia, capacidad, volumen y balance de masa; `SceneGraph` conserva los nodos y el Panel no duplica los datos. No se modifica ni la generación Jolt ni la física del recipiente como cuerpo rígido existente.

## QA automatizado y limitaciones

- Suite nueva `scripts/test-timeline-universal-animation-s13-g008-g001-corr003-cont012-liquid-geometry.mjs`: **18 PASS / 0 FAIL**. Prueba registro/elegibilidad por tipo; keyframes; validación min/max; capacidad real; masa/balances intactos; rechazo atómico de volumen insuficiente; cambios después de un vertido contabilizado; STOP; aislamiento entre recipientes; actualización de `freeSurface`; inicialización desde overrides; sustitución/liberación de geometría visual y snapshot de WaterWorld.
- Regresión ampliada **508 PASS / 0 FAIL / 0 SKIP**, excluyendo una suite que requiere Electron y Vite (`...corr001-electron.mjs`). La prueba excluida se intentó y terminó `Falta Vite; ejecutar npm ci antes del QA`: **NO VERIFICADO** (no se oculta el resultado).
- Las pruebas que evalúan el módulo `physics.js` con harness de `Function` fueron actualizadas para proporcionar la **nueva dependencia del propietario líquido**. Sus aserciones físicas originales se conservaron. `node --check` de todos los módulos JS modificados y suites: PASS.
- `npm run build`: NO COMPILADO. `sh: 1: vite: not found` al faltar `node_modules` en este entorno. Electron embebido, Player exportado y FPS/RAM en el equipo del usuario: **NO VERIFICADOS**.

## Pendientes reales — no ocultar ni cerrar CORR-003

1. **«Recipiente abierto» (enabled):** cambiar el ciclo de vida del contenedor sin fabricar/destruir masa requiere contrato de inventario suspendido y restauración, incluyendo el renderer y la fuente de volumen.
2. **«Líquido» (liquidId):** es identidad física de sustancia, densidad y perfil compartido. Un cambio en caliente debe conservar un balance por sustancia y definir explícitamente mezcla/sustitución o restricciones; no se añade llave visual ficticia.
3. **«Volumen inicial (m³)» (initialM3):** define el volumen de creación; no es equivalente al volumen físico **dinámico** actual después de transferencias. No debe animarse como una propiedad ordinaria sin un contrato de entrada/salida de masa; en una transición que reduce capacidad se rechaza el cambio antes de perder líquido.
4. **Combustión:** `Combustible` e `Ignición inicial` requieren alta/baja de fuentes/evento de ignición, snapshots de combustible, temperatura y brasas. Aún no se completan.
5. **Model, Terrain y generales:** GI horneada, pintura/remuestreo, Tags/Groups/Layers/DontDestroyOnLoad, además de Camera Orchestration, Camera Shake, Cinematics, scripts, audio y Player requieren cobertura funcional final y QA.

La cifra histórica permanece **32/34 tipos con algún canal especializado**, sin garantizar cobertura íntegra de ninguna familia. La continuación 012 aumenta **cuatro canales** en dos tipos ya cubiertos; no cambia el número de tipos. **CORR-003 NO CERRADO.**

## QA local requerido

En la raíz de LevelForge con `package.json`, partiendo exclusivamente del SOURCE_BASELINE 011 y comparando/resguardando modificaciones locales antes de extraer CHANGE:

```bash
node --test scripts/test-timeline-universal-animation-s13-g008-g001-corr003-cont012-liquid-geometry.mjs
node --test scripts/test-liquid-containers-s10-g001.mjs
npm run build
npm run electron
```

**Esperado Node:** 18 PASS en la suite nueva. Crear dos recipientes de distintas dimensiones, uno en Node3D y otro en RigidBody3D, y reproducir Timeline de cilindro→caja→cilindro y tamaño pequeño/grande. Verificar su `capacityM3`, nivel de líquido y balance, que el otro recipiente no cambia y que STOP restaura **solo forma y capacidad**, no inyecta de nuevo agua ya derramada. Probar una reducción por debajo del volumen actual: debe fallar **sin pérdida de masa**, con error visible en logs. Validar seek, pausa y loop, snapshot/carga, salida de Player y uso real de CPU/RAM. Verificar que Camera Preview y físicas ya aprobadas siguen funcionando.

**Evidencia solicitada:** salidas completas de Node/Vite/Electron, logs de errores reales y vídeo/capturas de las dos formas, nivel y restauración; no afirmar PASS visual sin esa evidencia ni sin aprobación expresa del usuario.

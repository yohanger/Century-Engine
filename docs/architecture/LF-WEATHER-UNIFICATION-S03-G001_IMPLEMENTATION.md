# LF-WEATHER-UNIFICATION-S03-G001 — Integración natural y física

**SOURCE_BASELINE:** `LevelForge_WEATHER_UNIFICATION_S02_G001_SOURCE_BASELINE.zip`.
**Autorización literal recibida:** `Listo. LF-WEATHER-UNIFICATION-S03-G001 autoriza comenzar`.
**Estado:** IMPLEMENTADO · TEST NODE PASS · WebGL, Editor, Player, Jolt WASM y rendimiento local NO VERIFICADOS · NO CERRADO.

## Auditoría: observado / inferido

- `World.windAt3D(x,y,z)` ya suma `windAt(x,z)` (ambiente + obstáculos) y `tornadoWindAt(x,y,z)` (vórtice). El resultado identifica si el punto está dentro del vórtice. No hay necesidad de otro sistema de viento.
- `WaterWorld.advanceSuspended()` ya implementa transporte acotado, depósito, salida del dominio y balance por especie. Su consumidor en `play-tornado-destruction.js` le suministraba únicamente `tornadoWindAt`, omitiendo el viento ambiental.
- `vegetationResponse()` ya tiene límites de carga y presupuesto espacial, pero el bucle de árboles consultaba solo el vórtice. El comportamiento ambiental se encontraba separado de la respuesta física de desprendimiento.
- `TornadoCombustion.step()` ya mueve brasas mediante `windAt3D`; la extinción por lluvia usaba `_f.precipMm` global, incluso cuando `CloudField` proporciona precipitación local distinta.
- `_tornadoBodyForces`, `_destructionBodyForces` y la deriva FPS aplican únicamente la contribución específica del vórtice; sustituirla por el viento total duplicaría la contribución ambiental o alteraría control/masas. Permanecen intactos.
- Los tests WebGL existentes invocaban un ejecutable externo `chromium` en vez del Electron instalado como dependencia del proyecto.

## Implementación

1. **Agua:** `play-tornado-destruction.js` entrega `windAt3D` a `WaterWorld.advanceSuspended()`. Los paquetes suspendidos siguen perteneciendo a WaterWorld: volumen, depósito y snapshots no cambian. Los límites de velocidad del solver se conservan.
2. **Vegetación:** la respuesta de raíces/tronco utiliza `windAt3D` en el lugar y altura de la instancia, manteniendo `inside`, `weight`, índice espacial y el presupuesto existente. La física posterior de fragmentos Jolt sigue usando solo la aceleración específica del vórtice para no duplicar fuerzas.
3. **Combustión:** la fuente térmica consulta `World.precipitationAt(x,z,y)` cuando Weather está habilitado. Mantiene el valor de frame como fallback; el contacto con agua cercana conserva prioridad. Las brasas continúan consumiendo `windAt3D` y `TornadoCombustion` mantiene los límites de fuentes y partículas.
4. **Jugador y cuerpos Jolt:** sin cambios; permanecen los métodos y escalas de fuerzas existentes. No se introduce física ni estados duplicados.
5. **QA Electron:** runners históricos para VFX, tornado visual y cohesión ahora utilizan un host temporal `BrowserWindow`, Vite y la propia dependencia Electron. No requieren navegador externo; mantienen sus verificaciones reales de shader y píxeles. Se conserva la GPU predeterminada (sin activar SwiftShader). Si se define `LF_QA_CAPTURE_DIR`, Electron también guarda PNG diagnósticos. El host de QA no altera Editor ni Player.

## Prerrequisitos, límites y exclusiones

- Para el QA real se requieren dependencias npm instaladas, Electron ejecutable, sesión de escritorio/servidor gráfico, Vite y WebGL2 funcional. Un resultado con mocks o tests de estructura no sustituye estas pruebas.
- Los cálculos de Jolt WASM real y el Player exportado deben verificarse localmente. S13 continúa BLOQUEADO mientras esa evidencia no exista.
- S03 no altera el render atmosférico del embudo (S02), no corrige el artefacto negro de Tormenta y no retira nodos VFX genéricos.
- La vegetación GPU visual todavía utiliza la muestra local compartida del viewport, no campo por vértice por árbol; el índice espacial de desprendimiento sí consulta posiciones individuales de candidatos. No afirmar detalle físico por cada instancia sin evidencia.
- El campo de viento efectivo es una composición matemática, no un CFD. No se modifica la API pública `game.weather.windAt` ni el esquema de proyectos.

## Pruebas y cierre

- WU3-01 a WU3-16: agua suspendida, viento ambiental/vórtice, vegetación, lluvia local, brasas, jugador, Jolt sin doble impulso, contratos de snapshot y rendimiento acotado.
- WUE-01 a WUE-09: contrato de harness Electron, sin navegador externo, aislamiento y comprobación de resultados WebGL.
- Regresión histórica Weather, Liquid, Jolt (dobles de prueba). El detalle y los comandos figuran en `docs/qa/LF-WEATHER-UNIFICATION-S03-G001_QA.md`.
- El Gate solo podrá cerrarse tras ejecución gráfica en Electron y QA físico/local del usuario, evidencia del Player y aprobación explícita. Las limitaciones del entorno de implementación deben mantenerse como NO VERIFICADO.

## Revisión correctiva de QA Electron (S03, 31-10-2026)

**Evidencia aportada por usuario:** WU3/WUE: 25/25 NODE PASS. Electron: VFX-Q07 1 PASS; las fixtures `tornado-cohesion.html` y `tornado-visual.html` fallan en «sin errores GPU», tras confirmar WebGL2. La salida anterior no registraba el valor de `gl.getError()` ni logs de compilación GLSL.

**Observado por auditoría del baseline:** `SKY_FRAG` declara 63 uniforms, pero ambas fixtures omitían 18 de los uniforms que configura el `ShaderMaterial` real de `render/viewport.js` (incluidos los samplers 2D `uPano`, `uCMap`, `uStarTex`, `uStarOff` y `uMoonTex`). Estas omisiones pueden dejar samplers en unidades de textura incompatibles con `sampler3D`; no se declara como causa raíz definitivamente demostrada sin capturar el error numérico GPU.

**Corrección dentro del QA autorizado S03:** se completan los uniforms omitidos en ambas fixtures y se instrumenta `renderer.debug.onShaderError`, registrando códigos WebGL y logs de programa/vertex/fragment en la respuesta de fallo. El shader, el renderer y el runtime de LevelForge **no se modifican**. Se agrega una prueba de contrato que compara todos los uniforms del shader contra las fixtures y exige diagnósticos explícitos. Prueba Node combinada: **29/29 PASS, 0 FAIL, 0 SKIP**, de los cuales 4 son controles nuevos de esta corrección. QA WebGL real tras los cambios: **NO VERIFICADO**; se requiere repetir las tres fixtures Electron en el entorno del usuario.

El Gate S03 continúa NO CERRADO. El artefacto negro de Tormenta, el QA visual de S02, el Player exportado y Jolt WASM real siguen registrados de forma independiente.

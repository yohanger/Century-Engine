# LevelForge — LF-AUDIO-S02-G001 · Contrato, implementación y QA

**Autorización exacta:** `Listo. LF-AUDIO-S02-G001 autoriza comenzar` (2026-10-24).  
**Baseline de entrada:** `LevelForge_AUDIO_S01_G001_SOURCE_BASELINE.zip`, último aprobado.  
**Estado de salida:** IMPLEMENTADO EN FUENTE; QA LOCAL PENDIENTE DE USUARIO.  
**Steam Audio:** referencia conceptual exclusivamente; no se incorpora su código, SDK, marca, DSP, dependencias ni recursos.

## Contrato efectivo

- **A06 · Oclusión geométrica:** `AudioScene` recibe `cast` de `PlayMode`, que reutiliza `_castOnce`: Jolt si está disponible, Three.js si no. Sensores siguen excluidos por el raycast sólido existente; el collider asociado al nodo emisor se omite cuando puede identificarse. La consulta termina antes del centro de la fuente para evitar que el extremo actúe como pared.
- **A07 · DSP por voz:** para una fuente 3D con `occlusion: true`, `Voice` inserta `BiquadFilterNode(lowpass)` y `GainNode` entre `PannerNode` y el bus existente. Parámetros iniciales 22 kHz/ganancia 1; con obstáculo 850 Hz/ganancia 0.35. No altera filtro global de agua, FX del bus, HRTF ni ganancia de distancia.
- **A08 · Transiciones:** `setTargetAtTime` evita cambios abruptos (0.07 s de ataque, 0.13 s de liberación). Las voces detenidas liberan ambos nodos. Mover una voz con `setPosition()` actualiza además su destino acústico.
- **A09 · Inspector:** opción «Oclusión» en Ajustes 3D para `AudioSource` y componente de audio de luces; nunca en UI/2D. Desactivada por defecto, incluso al cargar proyectos anteriores.
- **A10 · Rendimiento:** presupuesto compartido de 40 consultas/s en estado sostenido, ráfaga máxima de 4, mínimo 200 ms entre consultas por voz y reparto circular de consultas. Sin consultas para voces sin oclusión, detenidas ni 2D. No implica promesa de FPS sin medición.
- **A11 · Fuentes:** funcionan nodos AudioSource y componentes de audio de luces, y `game.audio.play('clip', { at:[x,y,z], occlusion:true })` o `{ node:'Nombre', occlusion:true }`. La opción es optativa; `game.audio.ui()` nunca crea DSP de oclusión. Editor/Player comparten la ruta PlayMode.

### Exclusiones vinculantes

Sin Steam Audio; sin materiales acústicos, múltiples reflexiones, simulación de propagación, reverberación física, baking, segundo mezclador, cambios globales de efectos o política nueva de voces/caché. El sistema meteorológico permanece separado. No se añade paquete npm.

### Limitaciones conocidas

1. La técnica realiza una consulta directa emisor–oyente, no simula rutas alrededor de obstáculos ni transmisiones por material. En ausencia de datos de material el filtrado es fijo.
2. El editor de vista previa de clip no ejecuta el raycast del modo Jugar. Probar con `npm run electron` → modo Jugar y con Player exportado.
3. Si el collider del emisor no puede asociarse a su nodo (algunas geometrías especiales de Jolt), un impacto cerca del extremo puede interpretarse como obstrucción; comprobar casos con emisores montados sobre objetos colisionables.
4. El presupuesto y los valores DSP son parámetros iniciales a validar auditivamente y con rendimiento local, no resultados de benchmark.
5. Los raycasts usan los sólidos actualmente registrados. Colisiones desactivadas no se comportan como paredes acústicas.

## Pruebas del entorno de elaboración

La suite `scripts/test-audio-s02.mjs` cubre valores por defecto, aislamiento de buses, Web Audio simulado, DSP por voz, transición, cambios de posición, limpieza, presupuesto y contratos de integración. Las pruebas de escena que importan Three.js se omiten **solo** cuando no está instalado el paquete; deben ejecutarse en la máquina del usuario después de `npm ci`.

**Ejecución en entorno de elaboración (2026-10-24):**

- `node --test scripts/test-audio-s02.mjs scripts/test-audio-s01.mjs scripts/test-db-contract.mjs scripts/test-three-s01.mjs` → **437 PASS, 0 FAIL, 5 SKIP** (4 de escenas Audio S02 y 1 de THREE S01 por falta de `three` instalado).
- `node --check` de config/engine/scene/play/test → **PASS**.
- `npm run build` → **NO VERIFICADO** (`vite: not found`, exit 127). Sin QA en Chromium/Electron o Player exportado.

Comandos de QA local:

```bash
cd "$HOME/ENGINES/lf-0.26.13/lf"
node --test scripts/test-audio-s02.mjs
node --test scripts/test-audio-s01.mjs
node --test scripts/test-db-contract.mjs
node --test scripts/test-three-s01.mjs
npm run build
npm run electron
```

**Importante:** primero comparar los archivos nuevos/modificados del CHANGE con cualquier modificación local del usuario. No extraer el SOURCE_BASELINE sobre el árbol activo; guardarlo como respaldo acumulado.

## QA funcional en editor y Player

1. Crear `AudioSource` 3D con loop continuo; marcar «Oclusión» en el Inspector. Poner una pared sólida entre el jugador y la fuente. Debe percibirse reducción de volumen y frecuencias altas; sin pared debe recuperarse gradualmente.
2. Repetir con HRTF, diferentes distancias y un emisor en movimiento. La distancia y la panoramización deben conservarse.
3. Desmarcar «Oclusión»: con la misma pared debe oírse exactamente como el comportamiento anterior (solo distancia/panoramización).
4. Guardar y abrir de nuevo la escena: comprobar que la casilla persiste. Abrir un proyecto previo sin el campo: oclusión OFF y mezcla idéntica.
5. Usar fuente UI y `game.audio.ui(...)`: no deben verse afectados por la pared.
6. Utilizar `game.audio.play('clip', { at:[x,y,z], occlusion:true })`; repetir con `{ node:'Nombre', occlusion:true }` y mover el nodo. Confirmar que OFF conserva comportamiento anterior.
7. Detener la fuente y cambiar de escena: sin filtros huérfanos ni raycasts posteriores.
8. Desactivar o no cargar Jolt y verificar fallback Three.js con colisionadores adecuados.
9. Probar 8, 16 y 32 fuentes con oclusión y medir FPS, CPU y glitches. No atribuir una cifra de rendimiento hasta medir.
10. Exportar juego de prueba y repetir oclusión, guardado y cambios de escena en Player; registrar cualquier desviación.

**QA pendiente de usuario:** escuchar el filtrado real, validar calidad acústica, verificar editor y Player exportado, registrar rendimiento y aprobar explícitamente el Gate. Los tests Node por sí solos no completan estos pasos.

## Entrega

Exactamente dos ZIP: `LF-AUDIO-S02-G001_CHANGE.zip` (solo diferencias S02, pruebas y ledger) y `LevelForge_AUDIO_S02_G001_SOURCE_BASELINE.zip` (fuente acumulada). Sin SHA-256 separado ni scripts `.sh`.

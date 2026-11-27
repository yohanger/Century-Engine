# LevelForge — S15-G006 · Transiciones y políticas de salida

**Gate autorizado:** `LF-CAMERA-ORCHESTRATION-S15-G006-TRANSITIONS-EXIT-POLICIES-INTEGRAL`  
**Entrada:** `LF_CAMERA_ORCHESTRATION_S15_G006_CONTRACT_AMEND_G001_SOURCE_BASELINE.zip`  
**Contrato vinculante:** `LF-CAMERA-ORCHESTRATION-S15-G006-CA-001` (ratificado 2026-11-09), Parent CAM-01..16 y CA active/visible pre-LTS.  
**Estado de entrega:** implementado en fuentes, pruebas Node 28/28 y regresión 170/170 PASS; compilación y QA visual/Player independiente NO VERIFICADOS.

## 1. Auditoría y causas

**OBSERVADO:** `PlayMode._cameraFrame()` es el árbitro final compartido Editor/Player; Camera3D solo suministra pose y perfil. G002 implementó lease `acquire/use/release(keep/base)` y G003 integró comandos. Timeline interpolaba *dentro* de sus claves en `evalCamera()` pero no existían blends **entre fuentes**. `TimelineRunner._finish()` descartaba siempre la cámara; `newTimeline()`/`normalizeTimeline()` utilizaban la misma ruta, por lo que añadir un default a normalización habría cambiado recursos guardados. `_playerMode()` distinguía control de movimiento y mirada: el lock de Timeline no suspendía necesariamente ambos.

**CAUSA RAÍZ:** ausencia de una transición temporal dentro de la autoridad única y de una política declarada exclusivamente para recursos nuevos; independencia incompleta entre bloqueo de mirada y movimiento. No se corrige mediante un CameraManager paralelo.

## 2. Contrato de interfaces implementadas

### 2.1 API de script (Play Mode/Player)

- `game.camera.acquire(cameraId, { seconds?: number, ease?: 'linear' | 'inOut' })` — conserva `acquire(cameraId)`; nueva adquisición rechazada si la autoridad está ocupada.
- `lease.use(cameraId, { seconds?: number, ease?: 'linear' | 'inOut' })` — mismo propietario, Cut o blend válido. `seconds=0` (predeterminado) significa Cut.
- `lease.release({ to?: 'keep'|'base'|'camera3d'|'previous'|'player'|'pose', cameraId?, seconds?, ease? })`. La API previa `release()`/`release({to:'base'})` continúa con la misma semántica. `keep` mantiene Camera3D **viva**. `pose` fija un snapshot. `player` exige jugador real. `previous` exige fuente anterior local válida. `camera3d` exige `cameraId` de esta escena.
- Opciones inválidas o destino ausente **no cambian** el propietario ni el blend. Las declaraciones TypeScript coinciden en Editor y VS Code.

### 2.2 Comando visual «Controlar cámara»

La definición y ejecución existentes (`cmd-world.js`, `exec-commands.js`, `_cameraEventControl`) aceptan `seconds`, `ease`, salida ampliada y `cameraId` al liberar hacia Camera3D. El identificador de evento y el token de lease siguen protegiendo al propietario. Se reutiliza `ParamForm` sin UI paralela.

### 2.3 Interpolación y reloj

- Origen: última pose **efectivamente dibujada sin Shake**, con perfil y FOV vertical de la cámara Three.js; el origen nunca es la cámara de navegación del Editor.
- Objetivo: Camera3D viva reevaluada en `_cameraFrame()` cada frame. Cuando se pide `base` o `player`, esa vista se evalúa con el camino existente y después se mezcla.
- `elapsed += cameraDelta` del reloj de Play; con pausa o pérdida de foco se congela, con paso manual avanza un paso. Duración y easing se declaran **por operación**. No son prioridades globales.
- Posición: lerp mundial. Rotación: quaternion SLERP + normalización. FOV: interpolación vertical. Curvas `linear` e `inOut`; perfil discreto en peso 0.5 (empate al destino), sin doble composición de render.
- Una interrupción del **mismo propietario** usa como origen la última salida dibujada; solicitudes de otro propietario se rechazan. Cuando un lease libera `keep` durante un blend existente, el `held` termina la transición hacia la Camera3D viva.
- Una referencia eliminada/inactiva invalida lease y blend; re-arbitraje seguro por la ruta de cámara ya existente. Cambio de escena y Stop del juego limpian snapshot, leases y blending.
- Camera Shake externo se añade, si procede, **después** de la salida única. FilmMaker/Timeline siguen excluidos por defecto; una pose fija explícita no recibe Shake de otra fuente.

### 2.4 Datos de Timeline: política explícita, sin reinterpretación retrospectiva

Los recursos **nuevos** creados con `newTimeline()` reciben:

```json
"cameraExit": {
  "natural": { "to": "keep" },
  "stop": { "to": "keep" },
  "skip": { "to": "keep" },
  "interrupted": { "to": "keep" }
}
```

`to` permitido: `keep`, `camera3d` (exige `sceneId` y `cameraId`), `previous`, `player`, `pose`, `base`. `normalizeTimeline()` **elimina** ese campo si no existía originalmente: así un recurso vigente conserva su salida histórica. Duplicar un recurso crea uno nuevo con la política predeterminada si el original carecía de ella; importar/normalizar datos existentes no los migra. Los campos quedan en el recurso único y se serializan por los mecanismos actuales `.lfproj`/paquete Player, sin catálogo paralelo. FilmMaker conserva ownership y sus claves.

El menú **Opciones de Timeline** permite configurar por motivo la salida declarada; «Comportamiento actual» se muestra para recursos sin campo. Esta intervención es un control pequeño del recurso, **no** un rediseño de claves, pistas o cinematics.

Al terminar el Runner, `natural`, `stop` y `skip` consultan su motivo. `keep` solo retiene una Camera3D o jugador **vivo**, nunca convierte silenciosamente una cámara libre en snapshot. Si la fuente no existe, se diagnostica y se deja `SIN_CAMARA` hasta otra adquisición; se conserva la decisión explícita de no volver automáticamente al FPS. La política `pose` sí retiene la última pose; `base` sí devuelve el arbitraje. `interrupted` queda normalizado y disponible en el contrato **pero el Runner vigente no tiene un evento de interrupción entre propietarios**: G006 no inventa preempción ni un botón de interrupción especulativo. Cambio de escena invalida todo, sin aplicar una salida del contexto anterior.

### 2.5 Entrada del jugador

Con `lock=true`, Timeline suspende tanto movimiento como mirada; al liberar el último lock restaura ambos estados previos. Pointer lock y fuente de cámara permanecen independientes. No se reescribe ni moderniza la plantilla FPS.

## 3. Límites y riesgos sin ocultar

- No se implementó opt-in de Camera Shake externo sobre FilmMaker/Cinematics: CA-G006-06 lo reservó para otro Gate.
- El contrato conserva `interrupted`, pero el consumo real actual de ese motivo no se dispara porque **otro propietario no puede desplazar** al Runner. La interrupción de un blend propio sí está implementada y probada.
- Editor de claves, autoría FilmMaker, perfiles persistentes, Database y arquitectura Three.js no fueron rediseñados.
- Las pruebas Node usan cámaras y hosts aislados y un ZIP real para la política; no demuestran imagen, fps, Jolt WASM, interacción con Electron ni ejecución AppImage.
- El build no pudo ejecutarse aquí: `vite: not found`. QA local y compilación son obligatorios antes de aprobar G006.

## 4. Evidencia técnica de esta entrega

- `node --test scripts/test-camera-orchestration-s15-g006.mjs`: **28/28 PASS**, incluyendo ZIP real mediante JSZip 3.10.1 presente en el entorno de pruebas, sin incluir dependencias temporales en artefactos.
- Regresión seleccionada de G002/G003/G005, Cinematics, eventos, active/visible y GameManager: **170/170 PASS**.
- Sintaxis de módulos JS modificados: **PASS**.
- Compilación Editor/Player: **NO VERIFICADA** por ausencia de Vite; Electron, render GPU, AppImage y QA usuario: **NO VERIFICADOS**.

## 5. Continuidad

G007 es la prueba integral de Camera Orchestration e incluye la ejecución independiente del juego exportado que arrastra G004. No se autoriza G007 con este Gate. Timeline de autoría, modernización FPS, Inspector, tooltips y optimización mantienen su planificación separada.

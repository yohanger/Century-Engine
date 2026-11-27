# API de scripts (`game`)

En un script del proyecto (`Assets/Scripts/*.js`), en el comando «Script» de un evento y en las pantallas `.ui` tienes:

- `game` — la API del juego (abajo).
- `event` — el evento que ejecuta el código (comando «Script» o condición); `undefined` en scripts del proyecto. Tipo [EventHandle](#eventhandle).
- `args` — argumentos con los que se llamó (game.call / «Llamar función de script»).

Los scripts Global y los comandos Script de evento admiten `await` en el nivel superior. Los recursos Nodo se ejecutan con `game` y `node` en un ámbito síncrono; utiliza una función async interna para esperar promesas. Los nombres de proyecto se sugieren a partir de los recursos; un identificador numérico solo es válido cuando la firma lo admite.

## Índice

- [Game](#game)
- [DialogAnim](#dialoganim)
- [TriggerInfo](#triggerinfo)
- [Hit](#hit)
- [RayOptions](#rayoptions)
- [SensorOptions](#sensoroptions)
- [Detection](#detection)
- [Sensor](#sensor)
- [InputApi](#inputapi)
- [GraphicsSettings](#graphicssettings)
- [GraphicsApi](#graphicsapi)
- [ProfileApi](#profileapi)
- [AnimationHandle](#animationhandle)
- [AnimationOptions](#animationoptions)
- [Animatable](#animatable)
- [AnimationApi](#animationapi)
- [CameraShakeApi](#camerashakeapi)
- [CameraTransitionOptions](#cameratransitionoptions)
- [CameraReleaseOptions](#camerareleaseoptions)
- [CameraLease](#cameralease)
- [CameraApi](#cameraapi)
- [LightHandle](#lighthandle)
- [Area3DSignalEvent](#area3dsignalevent)
- [NodeHandle](#nodehandle)
- [CharacterBody3DNodeScriptHandle](#characterbody3dnodescripthandle)
- [NodeScriptHandle](#nodescripthandle)
- [EventHandle](#eventhandle)
- [Player](#player)
- [ViewModelOptions](#viewmodeloptions)
- [ViewModelSlot](#viewmodelslot)
- [ViewModel](#viewmodel)
- [Battler](#battler)
- [Party](#party)
- [ClockApi](#clockapi)
- [WeatherApi](#weatherapi)
- [TimelineCameraExitPolicy](#timelinecameraexitpolicy)
- [TimelineCameraExit](#timelinecameraexit)
- [TimelineApi](#timelineapi)
- [NavApi](#navapi)
- [AudioSourceHandle](#audiosourcehandle)
- [AudioHandle](#audiohandle)
- [AudioApi](#audioapi)
- [UiApi](#uiapi)
- [CanvasHandle](#canvashandle)
- [VariablesApi](#variablesapi)
- [SaveInfo](#saveinfo)
- [SaveApi](#saveapi)
- [LevelApi](#levelapi)
- [WaterSample](#watersample)
- [FloatOptions](#floatoptions)
- [BodyOptions](#bodyoptions)
- [Body](#body)
- [PhysicsApi](#physicsapi)
- [Floater](#floater)
- [SplashOptions](#splashoptions)
- [WaterApi](#waterapi)
- [SceneProps](#sceneprops)
- [SceneApi](#sceneapi)
- [RuntimePrefabsApi](#runtimeprefabsapi)
- [RuntimeScenesApi](#runtimescenesapi)
- [TornadoSignal](#tornadosignal)
- [TornadoPhaseSignal](#tornadophasesignal)
- [TornadoBodySignal](#tornadobodysignal)


<a id="game"></a>
## Game

| Propiedad | Tipo | Descripción |
|---|---|---|
| `variables` _(solo lectura)_ | `VariablesApi` | La tabla de variables como en RPG Maker MZ (id 1..N con nombre), con valores de cualquier tipo y operaciones de lista. |
| `save` _(solo lectura)_ | `SaveApi` | Guardar y cargar partida: ranuras 1..N y autoguardado (0). |
| `state` | `Record<string, any>` | Objeto libre para guardar datos de tus scripts durante la partida. |
| `lang` | `string` | Idioma actual del juego ('es', 'en'…). Asignarlo cambia el idioma (si existe en Juego ▸ Localización) y se recuerda en el juego exportado. |
| `languages` _(solo lectura)_ | `{ code: string; name: string }[]` | Idiomas del proyecto: [{ code: 'es', name: 'Español' }, …]. |
| `party` _(solo lectura)_ | `Party` | Grupo, objetos, personajes y diario. |
| `db` _(solo lectura)_ | `Record<string, any>` | Registros de la base de datos (solo lectura): game.db.items, game.db.player… |
| `player` _(solo lectura)_ | `Player \| null` | El jugador: posición, movimiento, cuerpo y cámara. |
| `viewModel` _(solo lectura)_ | `ViewModel` | El view model: lo que cuelga de la cámara (manos, ojos…). Ver Base de datos ▸ Jugador. |
| `prefabs` _(solo lectura)_ | `RuntimePrefabsApi` | Instancias de Prefabs creadas durante Play, con identificadores y ciclo de vida propios. |
| `scenes` _(solo lectura)_ | `RuntimeScenesApi` | Escenas dinámicas creadas durante Play; no equivale a game.goScene(). |
| `profile` _(solo lectura)_ | `ProfileApi` | Perfiles de post-proceso (Assets/Profiles): set("Noche", 2) los mezcla en 2 s; clear() vuelve al perfil de cámara/GameManager o al render del proyecto. |
| `input` _(solo lectura)_ | `InputApi` | Input Map: game.input.justPressed("jump") · game.input.pressed("KeyF") · onPress · rebind… |
| `graphics` _(solo lectura)_ | `GraphicsApi` | Gráficos en juego: game.graphics.renderer = "mobile" · quality = "bajo" · resolutionScale = 0.75 |
| `animation` _(solo lectura)_ | `AnimationApi` | Animaciones por claves (pestaña Animación): game.animation.play(nodo, "Beber"). También node.playAnimation("Beber"). |
| `camera` _(solo lectura)_ | `CameraApi` | Autoridad general de cámaras: game.camera.acquire(game.node("Cámara")?.id). |
| `cameraShake` _(solo lectura)_ | `CameraShakeApi` | Reproducción manual de Camera Shake Base; también funciona con cámaras de escena. |
| `timeline` _(solo lectura)_ | `TimelineApi` | Reproducción y control de secuencias Timeline. |
| `nav` _(solo lectura)_ | `NavApi` | Consultas del mapa de navegación de la escena. |
| `audio` _(solo lectura)_ | `AudioApi` | Reproducción de audio y control del mezclador. |
| `time` _(solo lectura)_ | `number` | Segundos de juego transcurridos. |
| `ui` _(solo lectura)_ | `UiApi` | Apertura, cierre y control de interfaces y Canvas. |
| `clock` _(solo lectura)_ | `ClockApi` | Hora del día (Escena ▸ Hora). |
| `weather` _(solo lectura)_ | `WeatherApi` | Clima y viento (Escena ▸ Clima). |
| `water` _(solo lectura)_ | `WaterApi` | @deprecated Agua original. Declaración histórica conservada por contrato; el intérprete actual no expone esta propiedad, aunque PlayHost contiene su implementación. No usar en scripts hasta resolver la discrepancia contractual. |
| `physics` _(solo lectura)_ | `PhysicsApi` | Cuerpos dinámicos: caen, chocan, se empujan y flotan (play-bodies.js). |
| `level` _(solo lectura)_ | `LevelApi` | Reglas del nivel actual (Escena ▸ Nivel). Se pueden cambiar en vivo (`game.level.canRun = false`); al cambiar de escena vuelven a las del nivel. |
| `scene` _(solo lectura)_ | `SceneApi` | Cielo, luz ambiente y niebla de la escena actual. Los cambios duran lo que la escena y no modifican el proyecto. |


#### game.switch()

```ts
switch(x: Ref<'switches'>): boolean
```
Lee un interruptor (por nombre o número).


#### game.setSwitch()

```ts
setSwitch(x: Ref<'switches'>, value?: boolean): void
```
Asigna un interruptor por nombre o número; true por defecto.


#### game.variable()

```ts
variable(x: Ref<'variables'>): any
```
Lee una variable (por nombre o número): número, texto, sí/no, lista u objeto (0 si nunca se asignó).


#### game.setVariable()

```ts
setVariable(x: Ref<'variables'>, value: any): void
```
Asigna cualquier valor JSON (número, texto, boolean, lista u objeto).


#### game.once()

```ts
once(name: string, fn: (data?: any) => void | Promise<void>): () => void
```
Una sola vez: como `on`, pero se desengancha tras la primera señal.


#### game.emit()

```ts
emit(name: string, data?: any): Promise<void>
```
Emite una señal propia (no vale el nombre de un evento interno del motor). La reciben game.on / game.once / game.waitFor, el comando
«Esperar señal» y las páginas de evento con disparador «Al recibir señal». Termina cuando acaban los game.on.


#### game.waitFor()

```ts
waitFor(name: string, timeout?: number): Promise<any>
```
Promesa con el dato de la próxima señal `name`; `undefined` si pasan `timeout` segundos (0 = sin límite).


#### game.selfSwitch()

```ts
selfSwitch(ch: 'A' | 'B' | 'C' | 'D', ev?: NodeLike): boolean
```
Auto-interruptor del evento actual (o del indicado).


#### game.setSelfSwitch()

```ts
setSelfSwitch(ch: 'A' | 'B' | 'C' | 'D', value?: boolean, ev?: NodeLike): void
```
Asigna el auto-interruptor A, B, C o D del evento actual o del indicado.


#### game.say()

```ts
say(text: string, speaker?: string, position?: 'bottom' | 'center' | 'top', opts?: { key?: Ref<'texts'>; voice?: Ref<'clips'>; advance?: boolean; group?: Ref<'groups'> } & DialogAnim): Promise<void>
```
Muestra un diálogo y espera a que se cierre. Admite códigos de escape (\C[2], \V[1], \N[1], \F[expresión], \FX[temblor] … \FX[0]…) y {t:clave}.
`opts.key`: clave de Localización (el texto sale de la tabla en el idioma actual) · `opts.voice`: audio de la voz ·
`opts.advance`: al terminar la voz pasa solo (true por defecto) · `opts.group`: grupo del mezclador ('voice') ·
`opts.enter` / `opts.exit` / `opts.duration`: animación de entrada y salida (como en el comando; sin ellas, la de la interfaz).
@example await game.say('No hay nadie…', '', 'center', { enter: 'fade', exit: 'fade', duration: 0.6 })


#### game.setLanguage()

```ts
setLanguage(code: Ref<'languages'>): boolean
```
Cambia el idioma; false si no existe. Avisa con game.on('language').


#### game.t()

```ts
t(key: Ref<'texts'>, fallback?: string): string
```
Texto de una clave de Localización en el idioma actual (con respaldo en el idioma base). Si la clave no existe devuelve `fallback` o la clave.


#### game.choose()

```ts
choose(options: string[], cancel?: number, prompt?: string, opts?: DialogAnim): Promise<number>
```
Muestra opciones y devuelve el índice elegido (−1 si se cancela). `opts`: animación de entrada y salida.


#### game.wait()

```ts
wait(seconds?: number): Promise<void>
```
Espera segundos de juego (1 por defecto) antes de continuar.


#### game.fade()

```ts
fade(direction?: 'out' | 'in', seconds?: number, color?: string): Promise<void>
```
Ejecuta un fundido de entrada o salida; duración en segundos y color opcional.


#### game.caption()

```ts
caption(text: string, seconds?: number, position?: 'bottom' | 'center' | 'top', opts?: DialogAnim): Promise<void>
```
Subtítulo sin confirmación: se quita solo pasados `seconds` (la promesa se cumple entonces). Ideal para cinemáticas.


#### game.showLevelName()

```ts
showLevelName(text?: string, opts?: { position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center'; delay?: number; fadeIn?: number; hold?: number; fadeOut?: number }): void
```
Muestra el rótulo con el nombre del mapa (interfaz del sistema «Nombre del mapa»): aparece con un fundido, se queda y se va.
Sin texto, el nombre del nivel actual. Los tiempos y la posición por defecto son los de Escena ▸ Nivel.
@example game.showLevelName()                       // «Gasolinera» abajo a la derecha
@example game.showLevelName('Capítulo 2', { position: 'center', hold: 4 })


#### game.letterbox()

```ts
letterbox(percent?: number): void
```
Barras de cine: alto de cada barra en % de la pantalla (0–25; 0 las quita).


#### game.common()

```ts
common(x: Ref<'commonEvents'>): Promise<void>
```
Ejecuta un evento común de la base de datos y espera a que termine.


#### game.teleport()

```ts
teleport(x: number, y: number, z: number, yaw?: number): Promise<void>
```
Teletransporta al jugador a una posición.


#### game.teleportTo()

```ts
teleportTo(node: NodeLike, yaw?: number): Promise<void>
```
Teletransporta al CharacterBody3D a un nodo de la escena.


#### game.control()

```ts
control(mode?: 'free' | 'locked' | 'frozen' | boolean): void
```
'free' (se mueve) · 'locked' (mira pero no se mueve) · 'frozen' (ni se mueve ni mira). true/false equivalen a 'free'/'locked'.


#### game.raycast()

```ts
raycast(origin: Vec3, direction: Vec3, maxDistance?: number, opts?: RayOptions): Hit | null
```
Rayo contra la geometría sólida. Devuelve null si no toca nada. `opts` filtra por layers y etiquetas, ignora nodos e incluye Triggers.
@example game.raycast(game.player.eye, game.player.forward, 5, { layers: ["Interactuable", "Puertas"] })


#### game.sensor()

```ts
sensor(opts: SensorOptions): Sensor
```
Sensor de visión y oído (estudiado en SensorToolkit): qué ve un nodo o el jugador, con ángulo, alcance, línea de vista y memoria.
@example const ojos = game.sensor({ from: "Guardia", range: 18, fov: 100, targets: { player: true }, memory: 3 }); ojos.on("detected", (d) => game.log("Veo a " + d.name))


#### game.node()

```ts
node(name: NodeLike): NodeHandle | undefined
```
Busca por ID, nombre o ruta absoluta (p. ej. /Raiz/Hijo).


#### game.dontDestroyOnLoad()

```ts
dontDestroyOnLoad(name: string, enabled?: boolean): boolean
```
Marca o desmarca un nodo (por nombre o ID) para conservarlo con sus hijos al cambiar de escena en esta partida. Devuelve false si no existe. enabled = true por defecto. @example game.dontDestroyOnLoad("Música")


#### game.spawnPlayer()

```ts
spawnPlayer(prefab: Ref<'prefabs'>, options?: { position?: Vec3; parent?: NodeLike }): NodeHandle
```
Aparece un jugador en escenas configuradas para aparición por API. Devuelve la raíz del Prefab.


#### game.lights()

```ts
lights(tag?: string): LightHandle[]
```
Luces con una etiqueta (todas sin etiqueta): game.lights("Pasillo").forEach(l => l.on = false)


#### game.findByTag()

```ts
findByTag(tag: string): NodeHandle[]
```
@deprecated Compatibilidad con etiquetas antiguas. Para pertenencia lógica utiliza get_nodes_in_group.


#### game.get_nodes_in_group()

```ts
get_nodes_in_group(name: string): NodeHandle[]
```
Encuentra nodos de la escena activa con esa pertenencia lógica.


#### game.call_group()

```ts
call_group(group: string, method: string, ...args: any[]): void
```
Invoca un método publicado en los Scripts de Nodo activos de un grupo; no espera las Promises.


#### game.findByLayer()

```ts
findByLayer(name: string): NodeHandle[]
```
Todos los nodos que están en esa layer.


#### game.surfaceAt()

```ts
surfaceAt(x: number, y: number, z: number): string
```
Superficie bajo el punto ('stone', 'dirt', 'grass'…; '' si no hay suelo).


#### game.event()

```ts
event(name: Ref<'events'>): EventHandle | undefined
```
Busca un evento por nombre.


#### game.moveRoute()

```ts
moveRoute(target: 'player' | 'this' | NodeLike, steps: RouteStep[], opts?: { repeat?: boolean; skip?: boolean }): Promise<void>
```
Mueve al jugador ("player"), al evento actual ("this") o a un nodo siguiendo una ruta.


#### game.stopRoute()

```ts
stopRoute(target?: 'player' | 'this' | NodeLike): void
```
Detiene la ruta de movimiento del objetivo; por defecto el evento actual.


#### game.goScene()

```ts
goScene(scene: Ref<'scenes'>, tag?: string, opts?: { pos?: Vec3; yaw?: number; fadeOut?: number; fadeIn?: number; color?: string }): Promise<void>
```
Carga otra escena y deja al jugador en un nodo con esa etiqueta o nombre (o en `pos`). `fadeOut`/`fadeIn`: segundos de fundido (0 = corte).


#### game.define()

```ts
define(name: string, fn: (...args: any[]) => any): void
```
Registra una función que se puede llamar desde el comando «Llamar función de script» o con game.call.


#### game.call()

```ts
call(name: string, ...args: any[]): Promise<any>
```
Invoca una función publicada con game.define y devuelve su resultado mediante una promesa.


#### game.on()

```ts
on(name: 'start' | 'scene', fn: (payload?: any) => void | Promise<void>): () => void
```
Escucha un evento del juego. Devuelve una función para dejar de escuchar.

```ts
on(name: 'update', fn: (dt: number) => void): () => void
```
Cada fotograma, ANTES de mover al jugador: `dt` en segundos. Para leer al jugador ya movido usa «lateUpdate».

```ts
on(name: 'lateUpdate', fn: (dt: number) => void): () => void
```
Cada fotograma, al final: el jugador y los eventos ya están actualizados (cámara, seguimiento, HUD que lee posiciones).

```ts
on(name: 'fixedUpdate', fn: (dt: number) => void): () => void
```
Una vez por paso de física, justo antes de mover al jugador. `dt` es constante (1 / tasa de física de Ajustes del juego, 60 Hz por defecto); puede correr 0, 1 o varias veces por fotograma.

```ts
on(name: 'animationEvent', fn: (e: { node: string; clip: string; name: string }) => void | Promise<void>): () => void
```
Un evento de un clip de animación (nombre, clip y nodo).

```ts
on(name: 'action', fn: (e: { action: string; pressed: boolean }) => void | Promise<void>): () => void
```
Cambia una acción del Input Map (pulsada o soltada).

```ts
on(name: 'triggerEnter' | 'triggerExit', fn: (trigger: TriggerInfo) => void | Promise<void>): () => void
```
El jugador entra en (o sale de) un nodo Trigger.

```ts
on(name: 'triggerLook' | 'triggerLookEnd', fn: (trigger: TriggerInfo) => void | Promise<void>): () => void
```
El jugador mira un Trigger con «Mirada» activada (Inspector del Trigger) a menos de su alcance, sin nada sólido en medio, o deja de mirarlo.
Solo hay un Trigger «mirado» a la vez. Si ningún Trigger tiene «Mirada», no se calcula nada.

```ts
on(name: 'jump', fn: (e: { air: boolean }) => void | Promise<void>): () => void
```
El jugador salta (`air` = salto extra en el aire).

```ts
on(name: 'land', fn: (e: { speed: number; ground: 'stable' | 'steep' }) => void | Promise<void>): () => void
```
El jugador aterriza. `speed` = velocidad de caída (m/s); `ground` = 'stable' | 'steep'.

```ts
on(name: 'crouch', fn: (e: { on: boolean }) => void | Promise<void>): () => void
```
El jugador se agacha (`on` = true) o se levanta.

```ts
on(name: 'splash', fn: (e: { speed: number; x: number; y: number; z: number; water: string; node?: string }) => void | Promise<void>): () => void
```
El jugador toca el agua cayendo (`speed` en m/s; también al empezar a nadar). `x/y/z` = punto de la superficie.

```ts
on(name: 'float', fn: (e: { node: string; state: 'air' | 'floating' | 'sunk' | 'ground' }) => void | Promise<void>): () => void
```
Un objeto que flota cambia de estado: 'air' (cayendo), 'floating', 'sunk' (en el fondo) o 'ground' (en tierra).

```ts
on(name: 'swim', fn: (e: { on: boolean }) => void | Promise<void>): () => void
```
Empieza (`on` = true) o deja de nadar.

```ts
on(name: 'underwater', fn: (e: { on: boolean }) => void | Promise<void>): () => void
```
La cabeza entra (`on` = true) o sale del agua.

```ts
on(name: 'drown', fn: (e: { breath: 0 }) => void | Promise<void>): () => void
```
Se acabó el aire: llega cada segundo mientras siga bajo el agua (el daño lo decides tú).

```ts
on(name: 'footstep', fn: (e: { surface: string; running: boolean; landing: boolean; /** Layer que ha sonado (Tags y Layers). */ layer: string; action: 'walk' | 'run' | 'land' | 'jump' }) => void | Promise<void>): () => void
```
Cada paso del jugador (y el aterrizaje): la superficie que pisa.

```ts
on(name: 'drop', fn: (e: { node: string; slot: string; thrown: boolean; force?: number; landed?: boolean; bounces?: number }) => void | Promise<void>): () => void
```
Un objeto sale de la mano: soltado (`thrown: false`) o tirado (`thrown: true`, con `force` en m/s); al detenerse llega otro con `landed: true`.

```ts
on(name: 'save' | 'load', fn: (e: SaveInfo) => void | Promise<void>): () => void
```
Se guardó o se cargó una partida.

```ts
on(name: 'lightning', fn: (e: { distance: number; delay: number; bearing: number; /** Corriente de pico (kA). */ peak: number }) => void | Promise<void>): () => void
```
Un relámpago (`lightning`, al verse) y su trueno (`thunder`, cuando llega el sonido). `distance` en metros.

```ts
on(name: 'thunder', fn: (e: { distance: number; delay: number; bearing: number; peak: number; region?: string; occlusion?: number; loudness?: number }) => void | Promise<void>): () => void
```
El trueno llega al oyente (`delay` s después del relámpago). Con «Sonido del trueno: Procedural» trae además `region`, `occlusion` y `loudness` (0–1 con el volumen aplicado).

```ts
on(name: 'language', fn: (e: { lang: string }) => void | Promise<void>): () => void
```
Cambió el idioma del juego (game.lang = …).

```ts
on(name: 'lightningImpact', fn: (e: { id: number; seed: number; peakKA: number; kind: 'terrain' | 'object' | 'water'; point: Vec3; normal: Vec3; ownerId: string | null; surface: string; materialId: string }) => void | Promise<void>): () => void
```
Impacto de un rayo físico habilitado en Clima. No implica daño automático.

```ts
on(name: 'tornadoStart' | 'tornadoEnd', fn: (e: TornadoSignal) => void | Promise<void>): () => void
```
Inicio o fin de un tornado meteorológico: estado espacial en metros y edad en segundos.

```ts
on(name: 'tornadoPhase', fn: (e: TornadoPhaseSignal) => void | Promise<void>): () => void
```
Cambio de fase de un tornado.

```ts
on(name: 'tornadoEnter' | 'tornadoExit', fn: (e: TornadoBodySignal) => void | Promise<void>): () => void
```
Entrada o salida de un cuerpo del dominio del tornado; objectId es su ID o 'player'.

```ts
on(name: 'treeUprooted', fn: (e: { id: string; forceN: number; kind: string; position: Vec3 }) => void | Promise<void>): () => void
```
Un árbol se desprende debido a las fuerzas meteorológicas.

```ts
on(name: 'tornadoIgnition', fn: (e: { id: string; source?: 'lightning'; position: Vec3 }) => void | Promise<void>): () => void
```
Ignición detectada por destrucción meteorológica; source se incluye para rayos.

```ts
on(name: string, fn: (data?: any) => void | Promise<void>): () => void
```
Señal propia: cualquier nombre que no sea un evento interno. Recibe el dato de game.emit / del comando «Emitir señal».


#### game.random()

```ts
random(min?: number, max?: number): number
```
Entero aleatorio entre min y max (ambos incluidos).


#### game.log()

```ts
log(...values: any[]): void
```
Envía valores a la salida de scripts del juego.


<a id="dialoganim"></a>
## DialogAnim

Animación de entrada y salida de un diálogo, unas opciones o un subtítulo. Sin ellas, la de la interfaz (diseñador).

| Propiedad | Tipo | Descripción |
|---|---|---|
| `enter` | `'none' \| 'fade' \| 'rise' \| 'pop' \| 'slide'` | 'none' · 'fade' · 'rise' (subir) · 'pop' (escala) · 'slide' (deslizar) |
| `exit` | `'none' \| 'fade' \| 'sink' \| 'shrink' \| 'slide'` | 'none' · 'fade' · 'sink' (bajar) · 'shrink' (encoger) · 'slide' (deslizar) |
| `duration` | `number` | Segundos (0,25 por defecto; máximo 3). |


<a id="triggerinfo"></a>
## TriggerInfo

Un Trigger tal como lo reciben game.on("triggerEnter" …) y los slots del nodo.

| Propiedad | Tipo | Descripción |
|---|---|---|
| `id` | `string` | Identificador del Trigger. |
| `name` | `string` | Nombre del Trigger. |
| `tag` | `string` | Etiqueta asociada al Trigger. |


<a id="hit"></a>
## Hit

| Propiedad | Tipo | Descripción |
|---|---|---|
| `point` | `Vec3` | Punto mundial de impacto XYZ. |
| `normal` | `Vec3 \| null` | Normal de la superficie de impacto, si está disponible. |
| `distance` | `number` | Distancia desde el origen del rayo. |
| `node` | `NodeHandle` | Nodo alcanzado, cuando está disponible. |
| `kind` | `'solid' \| 'trigger'` | 'solid' (geometría con colisión) o 'trigger' (volumen de un nodo Trigger; solo con `triggers: true`). |
| `trigger` | `TriggerInfo` | Datos del Trigger cuando `kind` es 'trigger'. |


<a id="rayoptions"></a>
## RayOptions

Filtro de game.raycast() y game.player.look(). Sin opciones, el rayo golpea lo primero sólido que encuentra.

| Propiedad | Tipo | Descripción |
|---|---|---|
| `layers` | `string \| number \| (string \| number)[]` | Solo cuentan los nodos que estén en alguna de estas layers (nombre de Tags y Layers, o su número). El resto NO estorba: el rayo lo atraviesa. |
| `tags` | `string \| string[]` | Solo cuentan los nodos con alguna de estas etiquetas (Tag). |
| `ignore` | `NodeLike \| NodeLike[]` | Nodos que el rayo atraviesa (el propio jugador, un arma en la mano…). |
| `triggers` | `boolean` | También detecta los volúmenes de los nodos Trigger (por defecto no: son sensores). Si el rayo entra en el Trigger antes de chocar con algo sólido, devuelve el Trigger. |


<a id="sensoroptions"></a>
## SensorOptions

Opciones de game.sensor().

| Propiedad | Tipo | Descripción |
|---|---|---|
| `from` | `NodeLike \| 'player'` | Quién mira: un nodo (nombre o id) o "player". Un nodo mira hacia su -Z local. |
| `range` | `number` | Alcance de la vista en metros (15). |
| `fov` | `number` | Ángulo de visión total en grados (360 = ve a todos lados). |
| `targets` | `{       /** Incluir al jugador. */       player?: boolean       /** Nodos con alguna de estas etiquetas. */       tags?: string \| string[]       /** Nodos en alguna de estas layers (nombre o número). */       layers?: string \| number \| (string \| number)[]       /** Nodos concretos. */       nodes?: NodeLike \| NodeLike[]     }` | Qué buscar. Sin nada: cualquier nodo visible (y el jugador). |
| `lineOfSight` | `boolean` | Si algo sólido tapa la vista, no lo ve (true). |
| `hearRange` | `number` | Oído: dentro de este radio detecta sin importar el ángulo ni las paredes (0 = sordo). |
| `memory` | `number` | Segundos que recuerda lo que dejó de ver antes de dar 'lost' (0). |
| `interval` | `number` | Segundos entre miradas (0.15). Más alto = más barato. |
| `eye` | `Vec3` | Posición de los ojos respecto al nodo, [x, y, z] ([0, 1.5, 0]). |
| `targetHeight` | `number` | Altura sobre los pies del objetivo a la que se apunta el rayo (0.9). |
| `enabled` | `boolean` |  |


<a id="detection"></a>
## Detection

Algo que un sensor detecta.

| Propiedad | Tipo | Descripción |
|---|---|---|
| `id` | `string` | Identificador de la entidad detectada. |
| `name` | `string` | Nombre de la entidad detectada. |
| `node` | `NodeHandle` | El nodo (undefined si es el jugador). |
| `distance` | `number` | Distancia a la entidad detectada. |
| `angle` | `number` | Grados entre hacia dónde mira el sensor y el objetivo. |
| `visible` | `boolean` | Lo ve ahora mismo (en rango, en el cono y sin nada en medio). |
| `heard` | `boolean` | Solo lo oye (dentro de hearRange, sin verlo). |
| `lastSeen` | `number` | Segundos de sensor desde la última vez que lo vio u oyó. |
| `position` | `Vec3` | Posición XYZ de la entidad detectada. |


<a id="sensor"></a>
## Sensor

Sensor de visión/oído creado con game.sensor(). Vive lo que dura la escena: créalo en game.on("scene").

| Propiedad | Tipo | Descripción |
|---|---|---|
| `enabled` | `boolean` |  |
| `range` | `number` |  |
| `fov` | `number` |  |
| `hearRange` | `number` |  |
| `memory` | `number` |  |
| `detections` _(solo lectura)_ | `Detection[]` | Todo lo detectado (visto, oído o recordado), del más cercano al más lejano. |
| `nearest` _(solo lectura)_ | `Detection \| null` |  |
| `count` _(solo lectura)_ | `number` |  |


#### sees()

```ts
sees(who?: NodeLike | 'player'): boolean
```
¿Ve ahora mismo a ese nodo (o "player")? Sin argumento: ¿ve algo?


#### detects()

```ts
detects(who?: NodeLike | 'player'): boolean
```
¿Lo tiene detectado (visto, oído o recordado)?


#### on()

```ts
on(event: 'detected' | 'lost', fn: (d: Detection) => void): () => void
```
Escucha 'detected' (entra uno nuevo), 'lost' (se pierde, tras `memory`) o 'update' (cada mirada). Devuelve la función para dejar de escuchar.

```ts
on(event: 'update', fn: (all: Detection[]) => void): () => void
```


#### pulse()

```ts
pulse(): void
```
Mira ya, sin esperar al siguiente intervalo.


#### remove()

```ts
remove(): void
```


<a id="inputapi"></a>
## InputApi

Input Map (Ajustes del juego ▸ Input Map). Donde dice `ref` vale el nombre de una acción («jump») o una tecla suelta («KeyF», «Mouse1», «Pad0»).

| Propiedad | Tipo | Descripción |
|---|---|---|
| `pointerDelta` _(solo lectura)_ | `{ x: number; y: number }` | Delta relativo del ratón capturado durante el fotograma actual; (0,0) sin captura. |
| `actions` _(solo lectura)_ | `string[]` | Nombres de las acciones del mapa de entrada actual. |


#### pressed()

```ts
pressed(ref: string): boolean
```
Indica si la acción o entrada está mantenida.


#### justPressed()

```ts
justPressed(ref: string): boolean
```
Indica si la acción o entrada acaba de pulsarse en este fotograma.


#### justReleased()

```ts
justReleased(ref: string): boolean
```
Indica si la acción o entrada acaba de soltarse en este fotograma.


#### strength()

```ts
strength(action: string): number
```
Fuerza 0..1 de una acción (ejes del mando analógicos).


#### axis()

```ts
axis(negative: string, positive: string): number
```
pos − neg, de −1 a 1: game.input.axis("move_left", "move_right").


#### vector()

```ts
vector(negX: string, posX: string, negY: string, posY: string): { x: number; y: number }
```
Combina cuatro acciones en un vector de longitud máxima 1.


#### has()

```ts
has(action: string): boolean
```
Indica si existe la acción por nombre.


#### bindings()

```ts
bindings(action: string): string[]
```
Entradas asignadas a la acción; lista vacía si no existe.


#### label()

```ts
label(token: string): string
```
Texto legible de una entrada: «KeyE» → «E».


#### labels()

```ts
labels(action: string): string
```
«E / Intro / Clic izquierdo».


#### onPress()

```ts
onPress(ref: string, fn: () => void): () => void
```
Suscribe una función a la pulsación; devuelve una función para cancelar la suscripción.


#### onRelease()

```ts
onRelease(ref: string, fn: () => void): () => void
```
Suscribe una función a la liberación; devuelve una función para cancelar la suscripción.


#### wait()

```ts
wait(ref: string): Promise<void>
```
Espera a que se pulse la acción o tecla.


#### capture()

```ts
capture(): Promise<string | null>
```
Espera a que el jugador pulse algo y devuelve su entrada (para menús de reasignar).


#### enable()

```ts
enable(action: string, on?: boolean): void
```
Activa la acción; con on=false la desactiva.


#### disable()

```ts
disable(action: string): void
```
Desactiva la acción sin eliminar sus asignaciones.


#### isEnabled()

```ts
isEnabled(action: string): boolean
```
Consulta si la acción está habilitada.


#### create()

```ts
create(action: string, tokens?: string[]): void
```
Crea una acción con sus entradas iniciales en el mapa de juego.


#### remove()

```ts
remove(action: string): void
```
Elimina una acción del mapa de juego.


#### bind()

```ts
bind(action: string, token: string): void
```
Añade una entrada a una acción.


#### rebind()

```ts
rebind(action: string, tokens: string[]): void
```
Reemplaza las entradas de una acción.


#### reset()

```ts
reset(action: string): void
```
Restablece las entradas predeterminadas de la acción.


<a id="graphicssettings"></a>
## GraphicsSettings

Ajustes gráficos públicos del juego; admite los demás ajustes de render existentes.

| Propiedad | Tipo | Descripción |
|---|---|---|
| `psx` | `boolean` | Activa el estilo PSX y la escala de imagen con nearest. |
| `psxHeight` | `0 \| 240 \| 480` | Resolución vertical interna: 240p, 480p o 0 para resolución nativa. |
| `psxSnap` | `0 \| 1 \| 2 \| 3 \| 4` | Cuadrícula de vértices en píxeles: 0 desactiva el ajuste, 1–4 lo intensifica. |
| `psxAffine` | `boolean` | Interpolación affine del mapa de color en modelos GLTF/GLB compatibles con UV0. |


<a id="graphicsapi"></a>
## GraphicsApi

Gráficos en juego (para un menú de calidad): se superpone al render del proyecto; en el exe se recuerda entre partidas.

| Propiedad | Tipo | Descripción |
|---|---|---|
| `renderer` | `'forward' \| 'mobile' \| 'compat'` | 'forward' (Forward+) · 'mobile' · 'compat' (Compatibility). |
| `renderers` _(solo lectura)_ | `{ id: string; name: string }[]` |  |
| `quality` | `'alto' \| 'medio' \| 'bajo'` | Calidad de sombras, reflejos y efectos. |
| `resolutionScale` | `number` | Escala de resolución 0.25–1. |
| `settings` _(solo lectura)_ | `GraphicsSettings` | Copia de los ajustes de render actuales (mismos nombres que Ajustes del juego ▸ Render). |


#### set()

```ts
set(patch: Partial<GraphicsSettings>): void
```
Cambia ajustes sueltos: game.graphics.set({ psx: true, psxSnap: 4 }) o game.graphics.set({ bloom: 0, ao: 0 }).


#### reset()

```ts
reset(): void
```
Vuelve a lo que dice el proyecto.


<a id="profileapi"></a>
## ProfileApi

| Propiedad | Tipo | Descripción |
|---|---|---|
| `current` _(solo lectura)_ | `string \| null` | Nombre del perfil activo (null = el del proyecto). |


#### set()

```ts
set(name: string, seconds?: number): string | null
```
Pone el perfil (nombre o id) mezclándolo en `seconds`. Devuelve su nombre.


#### clear()

```ts
clear(seconds?: number): void
```
Vuelve al render del proyecto.


<a id="animationhandle"></a>
## AnimationHandle

Una animación en marcha (clip de Animación).

| Propiedad | Tipo | Descripción |
|---|---|---|
| `clip` _(solo lectura)_ | `string` | Nombre del clip reproducido. |
| `time` _(solo lectura)_ | `number` | Instante actual (s). |
| `duration` _(solo lectura)_ | `number` | Duración del clip en segundos. |
| `speed` | `number` | Multiplicador de velocidad de reproducción. |
| `loop` | `boolean` | Indica si la animación se repite. |
| `playing` _(solo lectura)_ | `boolean` | Indica si la animación está reproduciéndose. |
| `paused` _(solo lectura)_ | `boolean` | Indica si la animación está pausada. |
| `finished` _(solo lectura)_ | `boolean` | Indica si terminó la animación. |
| `layer` _(solo lectura)_ | `string` | Capa en la que suena (animaciones de modelo). |
| `weight` | `number` | Peso de mezcla 0–1 (animaciones de modelo; se puede cambiar en vivo). |
| `done` _(solo lectura)_ | `Promise<{ stopped: boolean; clip: string }>` | Se resuelve al terminar (o al detenerla). |


#### pause()

```ts
pause(): void
```
Pausa la reproducción.


#### resume()

```ts
resume(): void
```
Reanuda la reproducción.


#### seek()

```ts
seek(seconds: number): void
```
Sitúa la reproducción en el instante indicado en segundos.


#### stop()

```ts
stop(reset?: boolean): void
```
Detiene; con `true` el nodo vuelve a su pose inicial.


<a id="animationoptions"></a>
## AnimationOptions

| Propiedad | Tipo | Descripción |
|---|---|---|
| `loop` | `boolean` | Fuerza el bucle (sí/no); por defecto el del clip. |
| `speed` | `number` | Multiplica la velocidad. |
| `fade` | `number` | Mezcla de entrada con la pose actual (s). |
| `from` | `number` | Empieza en este instante (s). |
| `additive` | `boolean` | Fuerza el modo aditivo (sí/no); por defecto el del clip. |
| `layer` | `string` | Animaciones de modelo (.glb): capa. Los clips de la misma capa se sustituyen; capas distintas suenan a la vez (por defecto una única capa). |
| `weight` | `number` | Animaciones de modelo: peso de mezcla 0–1 (por defecto 1). |
| `mask` | `string \| string[]` | Animaciones de modelo: solo las pistas de huesos cuyo nombre contenga alguno de estos textos (`"spine, arm"` o `["spine","arm"]`) — capa de medio cuerpo. |


<a id="animatable"></a>
## Animatable

Métodos de animación de un nodo o de un slot del view model.

| Propiedad | Tipo | Descripción |
|---|---|---|
| `animations` _(solo lectura)_ | `AnimationHandle[]` | Manejadores de animación del nodo. |


#### playAnimation()

```ts
playAnimation(clip: string, opts?: AnimationOptions): AnimationHandle
```
Reproduce un clip sobre este nodo (sus pistas se resuelven desde aquí hacia los hijos). Si ya suena, lo reinicia.


#### stopAnimation()

```ts
stopAnimation(clip?: string, opts?: { reset?: boolean; layer?: string }): void
```
Detiene un clip (o todos) de este nodo. `reset: true` deja la pose inicial.


#### pauseAnimation()

```ts
pauseAnimation(clip?: string): void
```
Pausa la animación del nodo; el clip es opcional.


#### resumeAnimation()

```ts
resumeAnimation(clip?: string): void
```
Reanuda la animación del nodo; el clip es opcional.


#### isAnimating()

```ts
isAnimating(clip?: string): boolean
```
Consulta si el nodo está reproduciendo una animación.


<a id="animationapi"></a>
## AnimationApi


#### play()

```ts
play(node: NodeLike | undefined, clip: string, opts?: AnimationOptions): AnimationHandle
```
game.animation.play(nodo, "Beber", { loop, speed, fade }) — sin nodo, el evento en curso.


#### stop()

```ts
stop(node?: NodeLike, clip?: string, opts?: { reset?: boolean; layer?: string }): number
```


#### isPlaying()

```ts
isPlaying(node?: NodeLike, clip?: string): boolean
```


#### active()

```ts
active(node?: NodeLike): AnimationHandle[]
```


#### list()

```ts
list(): string[]
```
Nombres de todos los clips del proyecto.


#### modelClips()

```ts
modelClips(node?: NodeLike): string[]
```
Animaciones embebidas en el modelo de un nodo (huesos/skinning de un .glb). node.playAnimation("Walk") las reproduce igual que los clips del proyecto.


#### has()

```ts
has(clip: string): boolean
```


#### duration()

```ts
duration(clip: string): number
```


#### stopAll()

```ts
stopAll(): void
```


<a id="camerashakeapi"></a>
## CameraShakeApi

Efecto visual de un nodo Camera Shake Base; no mueve al cuerpo ni modifica la receta guardada.


#### play()

```ts
play(node: NodeLike, opts?: { intensity?: number }): boolean
```
Reproduce o reinicia el nodo desde cero. Intensidad de 0 a 1. false si no es válido o está deshabilitado.


#### stop()

```ts
stop(node: NodeLike): boolean
```
Detiene el efecto; respeta Blend Out y evita el reinicio automático.


#### setIntensity()

```ts
setIntensity(node: NodeLike, intensity: number): boolean
```
Multiplicador transitorio de 0 a 1. No cambia las propiedades del nodo.


#### isPlaying()

```ts
isPlaying(node: NodeLike): boolean
```
true mientras el efecto está en reproducción; false durante su salida o al terminar.


<a id="cameratransitionoptions"></a>
## CameraTransitionOptions

Transición única; se mide con el reloj del juego y nunca cambia el propietario de la cámara.

| Propiedad | Tipo | Descripción |
|---|---|---|
| `seconds` | `number` | Duración de la transición en segundos. |
| `ease` | `'linear' \| 'inOut'` | Interpolación lineal o suavizada de entrada y salida. |


<a id="camerareleaseoptions"></a>
## CameraReleaseOptions (amplía [CameraTransitionOptions](#cameratransitionoptions))

Opciones de salida explícita. keep conserva la Camera3D viva; pose retiene un fotograma.

| Propiedad | Tipo | Descripción |
|---|---|---|
| `to` | `'keep' \| 'base' \| 'camera3d' \| 'previous' \| 'player' \| 'pose'` | Destino explícito al liberar la cámara. |
| `cameraId` | `string` | Identificador de la cámara de destino cuando se solicita Camera3D. |


<a id="cameralease"></a>
## CameraLease

Uso temporal exclusivo de una Camera3D de la escena activa. No modifica datos guardados.


#### use()

```ts
use(cameraId: string): boolean
```
Solicita el uso de la Camera3D indicada mediante esta concesión; devuelve si se aceptó.

```ts
use(cameraId: string, options: CameraTransitionOptions): boolean
```
Solicita el uso de la Camera3D indicada mediante esta concesión; devuelve si se aceptó.


#### release()

```ts
release(options?: CameraReleaseOptions): boolean
```
Libera la concesión con la política de salida indicada; devuelve si se aceptó.


<a id="cameraapi"></a>
## CameraApi

Autoridad de cámara del runtime; accesible desde cualquier script sin depender de Timeline.

| Propiedad | Tipo | Descripción |
|---|---|---|
| `active` _(solo lectura)_ | `{ kind: 'camera3d' \| 'player' \| 'timeline' \| 'film' \| 'pose'; id?: string; requested?: boolean; held?: boolean } \| null` | Fuente de cámara actual y su identificación, si existe. |


#### acquire()

```ts
acquire(cameraId: string): CameraLease | null
```
Solicita control temporal de la Camera3D indicada; null si no se concede.

```ts
acquire(cameraId: string, options: CameraTransitionOptions): CameraLease | null
```
Solicita control temporal de la Camera3D indicada; null si no se concede.


<a id="lighthandle"></a>
## LightHandle

Una luz (nodo Luz / Foco / Sol). Los cambios son de la partida; no tocan el proyecto.

| Propiedad | Tipo | Descripción |
|---|---|---|
| `on` | `boolean` | Encendida o apagada. |
| `color` | `string` | '#rrggbb' |
| `energy` | `number` | Energía (intensidad de la luz). |
| `range` | `number` | Alcance en metros (0 en el Sol). |
| `angle` | `number` | Ángulo del foco en grados (solo focos). |
| `shadow` | `boolean` | Habilita o deshabilita las sombras de la luz. |
| `type` _(solo lectura)_ | `'omni' \| 'spot' \| 'directional'` | Tipo de luz: omnidireccional, foco o direccional. |


#### toggle()

```ts
toggle(): boolean
```
Alterna y devuelve el nuevo estado.


#### fadeTo()

```ts
fadeTo(to: { energy?: number; color?: string; range?: number }, seconds?: number): Promise<void>
```
Mezcla energía, color y/o rango en `seconds`.


#### turnOn()

```ts
turnOn(seconds?: number, to?: { energy?: number; color?: string; range?: number }): Promise<void>
```
Enciende con fundido opcional; `to` fija intensidad/color/alcance de destino.


#### turnOff()

```ts
turnOff(seconds?: number): Promise<void>
```
Apaga con fundido opcional (recuerda su energía para turnOn).


<a id="area3dsignalevent"></a>
## Area3DSignalEvent

Datos de una señal física Area3D emitida desde el sensor Jolt existente.

| Propiedad | Tipo | Descripción |
|---|---|---|
| `areaId` | `string` |  |
| `type` | `'body' \| 'area'` |  |
| `id` | `string` |  |


<a id="nodehandle"></a>
## NodeHandle (amplía [Animatable](#animatable))

| Propiedad | Tipo | Descripción |
|---|---|---|
| `parent` _(solo lectura)_ | `NodeHandle \| null` | Padre actual; null en la raíz. |
| `children` _(solo lectura)_ | `NodeHandle[]` | Hijos activos en orden de jerarquía. |
| `id` _(solo lectura)_ | `string` | Identificador del nodo. |
| `name` _(solo lectura)_ | `string` | Nombre del nodo en la escena. |
| `object3D` _(solo lectura)_ | `any` | Objeto Three.js del nodo (avanzado). |
| `active` | `boolean` | Habilitación propia: false suspende procesamiento y física, independiente de la visibilidad. |
| `visible` | `boolean` | Estado visual propio. No indica si esta cámara gobierna la salida. |
| `position` | `Vec3` | Posición local XYZ del nodo. |
| `tag` _(solo lectura)_ | `string` | @deprecated Etiqueta antigua; solo para compatibilidad de proyectos existentes. |
| `layers` _(solo lectura)_ | `string[]` | Nombres de sus layers (puede estar en varias). |
| `surface` _(solo lectura)_ | `string` | Superficie de sus layers ('stone', 'grass'…; '' si ninguna). |
| `dontDestroyOnLoad` | `boolean` | Conserva el nodo y sus descendientes al cambiar de escena durante Play. No modifica el recurso de autoría. |
| `held` _(solo lectura)_ | `boolean` | ¿Está en la mano (view model)? |
| `heldSlot` _(solo lectura)_ | `string \| null` | Slot donde está ('right', 'left'…) o null. |
| `light` _(solo lectura)_ | `LightHandle \| undefined` | Si el nodo es una luz: encender, apagar, color, energía… |
| `type` _(solo lectura)_ | `string` | Tipo de nodo: 'primitive', 'model', 'trigger', 'light'… |
| `rotation` | `Vec3` | Rotación en grados [x, y, z]. Asignar gira el nodo al instante. |
| `scale` _(solo lectura)_ | `Vec3` | Escala [x, y, z] del nodo. |
| `worldPosition` _(solo lectura)_ | `Vec3` | Posición en el mundo (position es la local si el nodo está dentro de un grupo). |
| `worldForward` _(solo lectura)_ | `Vec3` | Dirección frontal mundial normalizada (-Z local), incluida la rotación de padres. |
| `distance` _(solo lectura)_ | `number` | Distancia en metros entre el nodo y el jugador. |


#### is_valid()

```ts
is_valid(): boolean
```
Comprueba si la misma instancia lógica continúa montada en esta sesión Play.


#### call()

```ts
call(name: string, ...args: any[]): T
```
Invoca un método explícitamente publicado por el Script de Nodo de esta instancia.
Los errores y los rechazos Promise se propagan al llamador.


#### connect()

```ts
connect(name: string, receiver: NodeHandle, method: string): boolean
```
Conecta un método publicado del receptor a una señal declarada por este nodo.
Area3D también admite body_entered, body_exited, area_entered y area_exited sin script emisor.
El método receptor recibe un Area3DSignalEvent para señales físicas.
Devuelve false si la misma conexión ya existe.


#### disconnect()

```ts
disconnect(name: string, receiver: NodeHandle, method: string): boolean
```
Desconecta una conexión existente. Es idempotente.


#### get_node()

```ts
get_node(path: string): NodeHandle | null
```
Resuelve rutas relativas y absolutas; null si no existe.


#### move()

```ts
move(pos: Vec3, seconds?: number, rel?: boolean): Promise<void>
```
Mueve el nodo (relativo o absoluto) en `seconds`; la promesa termina al llegar.


#### add_to_group()

```ts
add_to_group(name: string): boolean
```
Añade una pertenencia lógica durante esta sesión Play.


#### remove_from_group()

```ts
remove_from_group(name: string): boolean
```
Quita una pertenencia lógica durante esta sesión Play.


#### is_in_group()

```ts
is_in_group(name: string): boolean
```
Comprueba la pertenencia lógica al grupo indicado.


#### get_groups()

```ts
get_groups(): string[]
```
Devuelve los grupos lógicos del nodo.


#### inLayer()

```ts
inLayer(name: string): boolean
```
Comprueba si el nodo pertenece a la capa indicada.


#### keepOnLoad()

```ts
keepOnLoad(enabled?: boolean): boolean
```
Marca o desmarca persistencia de este nodo; false si no existe. @example node.keepOnLoad(true)


<a id="characterbody3dnodescripthandle"></a>
## CharacterBody3DNodeScriptHandle (amplía [NodeScriptHandle](#nodescripthandle))

API física exclusiva del Script de Nodo adjunto a CharacterBody3D.
Son consultas y comandos del cuerpo Jolt real, no variables del script.

| Propiedad | Tipo | Descripción |
|---|---|---|
| `velocity` | `Vec3` | Velocidad física [x, y, z] en m/s. La asignación solicita el cambio a Jolt. |
| `ground` _(solo lectura)_ | `'stable' \| 'steep' \| 'air'` | Clasificación del contacto inferior por el runtime físico. |
| `onFloor` _(solo lectura)_ | `boolean` | Indica contacto con el suelo en el último paso físico. |
| `onWall` _(solo lectura)_ | `boolean` | Indica contacto con una pared en el último paso físico. |
| `onCeiling` _(solo lectura)_ | `boolean` | Indica contacto con el techo en el último paso físico. |


<a id="nodescripthandle"></a>
## NodeScriptHandle (amplía [NodeHandle](#nodehandle))


#### expose()

```ts
expose(name: string, fn: (...args: any[]) => unknown): void
```
Publica un método de esta instancia para otros Scripts de Nodo. No expone variables privadas.


#### define_signal()

```ts
define_signal(name: string): void
```
Declara una señal propia de esta instancia de Script de Nodo.


#### emit_signal()

```ts
emit_signal(name: string, ...args: any[]): void
```
Emite una señal declarada de este nodo a sus receptores activos.


<a id="eventhandle"></a>
## EventHandle

| Propiedad | Tipo | Descripción |
|---|---|---|
| `id` _(solo lectura)_ | `string` | Identificador del evento. |
| `name` _(solo lectura)_ | `string` | Nombre del evento. |
| `node` _(solo lectura)_ | `any` | Objeto asociado al evento. |
| `position` _(solo lectura)_ | `Vec3` | Posición XYZ del evento. |
| `isRunning` _(solo lectura)_ | `boolean` | Indica si hay una ejecución activa del evento. |
| `page` _(solo lectura)_ | `number` | Número (desde 1) de la página activa; 0 si ninguna. |
| `pages` _(solo lectura)_ | `number` | Cantidad de páginas del evento. |
| `held` _(solo lectura)_ | `boolean` | ¿Está este evento en la mano (view model)? |


#### erase()

```ts
erase(): void
```
Hace desaparecer este evento hasta recargar la escena.


#### run()

```ts
run(opts?: { page?: number }): Promise<boolean>
```
Ejecuta los comandos de la página activa (o de `page`, desde 1, aunque no cumpla sus condiciones) en segundo plano, sin bloquear al jugador.
La promesa vale true al terminar y false si se detuvo o no hay página. Si esa página ya corre, devuelve la misma promesa.


#### stop()

```ts
stop(): number
```
Detiene lo que está ejecutando el evento; devuelve cuántas ejecuciones paró.


#### selfSwitch()

```ts
selfSwitch(ch: 'A' | 'B' | 'C' | 'D'): boolean
```
Lee el auto-interruptor A, B, C o D de este evento.


#### setSelfSwitch()

```ts
setSelfSwitch(ch: 'A' | 'B' | 'C' | 'D', value?: boolean): void
```
Asigna el auto-interruptor A, B, C o D de este evento.


<a id="player"></a>
## Player

Jugador nativo de la escena. Algunas declaraciones históricas del FPS anterior no están disponibles en el jugador actual; no usar jumpNow, airTime, groundTime, inWater, swimming, underwater, waterDepth, waterLevel, water, current, breath, verticalSpeed ni camera.

| Propiedad | Tipo | Descripción |
|---|---|---|
| `node` _(solo lectura)_ | `NodeScriptHandle` | CharacterBody3D nativo de la escena (ausente en el FPS heredado). |
| `velocity` | `Vec3` | Velocidad física XYZ del personaje nativo (m/s); no existe en el FPS heredado. |
| `x` | `number` |  |
| `y` | `number` |  |
| `z` | `number` |  |
| `position` | `Vec3` | [x, y, z] de los pies. Asignar teletransporta. |
| `yaw` | `number` | Hacia dónde mira, en grados. |
| `name` _(solo lectura)_ | `string \| null` | Nombre del personaje de Base de datos ▸ Jugador ▸ Personaje (null si no hay). |
| `actor` _(solo lectura)_ | `Record<string, any> \| null` | Registro del personaje del jugador (null si no hay). |
| `surface` _(solo lectura)_ | `string` | Superficie que pisa ahora: 'stone', 'dirt', 'grass'… ('' si no hay suelo). |
| `control` | `boolean` |  |
| `mode` _(solo lectura)_ | `'free' \| 'locked' \| 'frozen' \| 'face'` | Qué hace el jugador ahora: 'free' \| 'locked' \| 'frozen' \| 'face'. |
| `walk` | `number` | Caminar (m/s). Valor inicial: Base de datos ▸ Jugador. |
| `run` | `number` | Correr (m/s). |
| `jump` | `number` |  |
| `gravity` | `number` |  |
| `fov` | `number` |  |
| `sensitivity` | `number` |  |
| `height` | `number` | Altura del cuerpo (m). Cambiarla rehace la cápsula: game.player.height = 1.0 para agacharse. |
| `radius` | `number` |  |
| `eyeHeight` | `number` | Altura de los ojos (m). Nunca por encima de la altura del cuerpo. |
| `stepHeight` | `number` |  |
| `eye` _(solo lectura)_ | `Vec3` | Posición de los ojos (la cámara) en el mundo. |
| `forward` _(solo lectura)_ | `Vec3` | Hacia dónde mira la cámara (vector unitario). |
| `pitch` _(solo lectura)_ | `number` | Inclinación de la cámara en grados (+ mira hacia arriba, − hacia abajo). |
| `grounded` _(solo lectura)_ | `boolean` | ¿Está pisando el suelo? (estable o empinado) |
| `stable` _(solo lectura)_ | `boolean` | Suelo estable: pendiente dentro del límite. false = en el aire o resbalando por una pendiente empinada. |
| `ground` _(solo lectura)_ | `'stable' \| 'steep' \| 'air'` | 'stable' \| 'steep' (más empinado que la pendiente máxima) \| 'air'. |
| `crouching` _(solo lectura)_ | `boolean` | ¿Está agachado? |
| `speed` _(solo lectura)_ | `number` | Velocidad horizontal respecto al suelo (m/s). |
| `airTime` _(solo lectura)_ | `number` | Segundos desde que dejó el suelo (0 si lo pisa). |
| `groundTime` _(solo lectura)_ | `number` | Segundos que lleva pisando el suelo (0 en el aire). |
| `inWater` _(solo lectura)_ | `boolean` | Agua: ¿hay agua sobre sus pies? / ¿nada? / ¿tiene la cabeza bajo la superficie? |
| `swimming` _(solo lectura)_ | `boolean` |  |
| `underwater` _(solo lectura)_ | `boolean` |  |
| `waterDepth` _(solo lectura)_ | `number` | Profundidad del agua sobre los pies (m; 0 si no hay) y altura de la superficie con olas (null si no está en el agua). |
| `waterLevel` _(solo lectura)_ | `number \| null` |  |
| `water` _(solo lectura)_ | `string` | Nombre del objeto Agua en el que está ('' si ninguno) y la corriente [x, z] en m/s que lo empuja. |
| `current` _(solo lectura)_ | `[number, number]` |  |
| `breath` | `number` | Aire bajo el agua: 1 = lleno, 0 = sin aire. Se puede asignar. |
| `groundAccel` | `number` | Aceleración / frenado en suelo estable (m/s²). |
| `groundDecel` | `number` |  |
| `turnBoost` | `number` | Multiplica la aceleración al cambiar de dirección (×1 a 0° … este valor a 180°). |
| `slideAccel` | `number` |  |
| `slideDecel` | `number` |  |
| `airAccel` | `number` |  |
| `airDecel` | `number` |  |
| `slopeLimit` | `number` | Pendiente máxima caminable (grados). |
| `jumpOnSteep` | `boolean` |  |
| `jumpAuto` | `boolean` | Con jumpAuto, gravedad y velocidad de salto salen de jumpHeight y jumpTime. |
| `jumpHeight` | `number` |  |
| `jumpTime` | `number` |  |
| `fallGravity` | `number` |  |
| `terminalSpeed` | `number` |  |
| `coyote` | `number` | Tiempo de gracia para saltar tras dejar el suelo (s). |
| `jumpBuffer` | `number` | Si pulsas saltar tan poco antes de aterrizar (s), se salta al tocar el suelo. |
| `airJumps` | `number` | Saltos extra en el aire (1 = doble salto). |
| `jumpCutEnabled` | `boolean` |  |
| `jumpCut` | `number` |  |
| `jumpCutMin` | `number` |  |
| `jumpCutMax` | `number` |  |
| `crouchEnabled` | `boolean` |  |
| `crouchToggle` | `boolean` |  |
| `crouchAir` | `boolean` |  |
| `crouchHeight` | `number` |  |
| `crouchSpeed` | `number` |  |
| `crouchLerp` | `number` |  |
| `inheritGround` | `boolean` |  |
| `inheritMin` | `number` |  |
| `inheritMult` | `number` |  |
| `swimEnabled` | `boolean` | Agua (Base de datos ▸ Jugador ▸ Agua). |
| `wadeDepth` | `number` |  |
| `wadeSlow` | `number` |  |
| `swimDepth` | `number` |  |
| `swimSpeed` | `number` |  |
| `swimRun` | `number` |  |
| `swimAccel` | `number` |  |
| `swimDrag` | `number` |  |
| `diveEnabled` | `boolean` |  |
| `diveSpeed` | `number` |  |
| `swimUp` | `number` |  |
| `buoyancy` | `number` |  |
| `swimEyeAbove` | `number` |  |
| `swimExitJump` | `number` |  |
| `currentPush` | `number` |  |
| `breathTime` | `number` |  |
| `uwEffect` | `boolean` |  |
| `uwDensity` | `number` |  |
| `uwMuffle` | `number` |  |
| `uwLight` | `boolean` | El color bajo el agua se oscurece con la luz de la escena (noche, tormenta, poca luz ambiente). |
| `waterFx` | `boolean` | Salpicaduras (gotas) y ondas al caer, nadar o vadear. |
| `verticalSpeed` _(solo lectura)_ | `number` | Velocidad vertical en m/s (+ sube, − cae). |
| `camera` _(solo lectura)_ | `any` | Cámara de Three.js del jugador (avanzado). |


#### jumpNow()

```ts
jumpNow(): void
```
Salta ahora, como pulsar «jump» (respeta saltos extra y reglas del nivel).


#### crouch()

```ts
crouch(on?: boolean): void
```
Se agacha (true) o se levanta (false). Si no cabe de pie, sigue agachado.


#### look()

```ts
look(opts?: RayOptions & { distance?: number }): Hit | null
```
Lo que el jugador tiene delante: un rayo desde sus ojos hacia donde mira. `distance` = alcance en metros (3 por defecto).
Acepta el mismo filtro que game.raycast. Devuelve null si no hay nada dentro del alcance.
@example
// «¿hay algo usable delante?» (layer «Interactuable»)
game.on("update", () => {
  const hit = game.player.look({ distance: 2.5, layers: "Interactuable" })
  game.ui.canvas("Mirilla")?.[hit ? "show" : "hide"]()
})


<a id="viewmodeloptions"></a>
## ViewModelOptions

| Propiedad | Tipo | Descripción |
|---|---|---|
| `slot` | `Ref<'slots'>` | Slot de destino (id de Base de datos ▸ Jugador). Por defecto «right». |
| `pos` | `Vec3` | Ajuste de posición respecto al slot (m). |
| `rot` | `Vec3` | Ajuste de rotación respecto al slot (°). |
| `scale` | `number` | Multiplica el tamaño del objeto. |
| `seconds` | `number` | Duración de la transición; por defecto 0.25. |


<a id="viewmodelslot"></a>
## ViewModelSlot (amplía [Animatable](#animatable))

| Propiedad | Tipo | Descripción |
|---|---|---|
| `id` _(solo lectura)_ | `string` |  |
| `label` _(solo lectura)_ | `string` |  |
| `object3D` _(solo lectura)_ | `any` | Anclaje Three.js (avanzado). |
| `position` | `Vec3` |  |
| `rotation` | `Vec3` | En grados. |
| `scale` | `number` |  |
| `items` _(solo lectura)_ | `string[]` | Ids de los nodos que hay ahora en este slot. |


#### attach()

```ts
attach(target?: NodeLike, opts?: Omit<ViewModelOptions, 'slot'>): Promise<void>
```
Lleva un nodo a este slot. Sin objetivo: el evento en curso.


#### clear()

```ts
clear(): Promise<void[]>
```
Suelta todo lo que haya en el slot.


<a id="viewmodel"></a>
## ViewModel

| Propiedad | Tipo | Descripción |
|---|---|---|
| `visible` | `boolean` | Muestra u oculta todo el view model (por ejemplo durante una conversación). |
| `slots` _(solo lectura)_ | `string[]` | Ids de los slots. |
| `held` _(solo lectura)_ | `{ id: string; name: string; slot: string }[]` | Nodos que hay en el view model ahora. |
| `throwCharge` _(solo lectura)_ | `number` | Fuerza acumulada (0..1) mientras mantienes la acción «drop» con algo en la mano: úsala para una barra de carga en un Canvas. |
| `dropEnabled` | `boolean` | Activa o desactiva soltar/tirar con la acción «drop» (toque corto = soltar, mantener = tirar). |
| `stashed` _(solo lectura)_ | `{ id: string; name: string }[]` | Objetos guardados ahora. |


#### slot()

```ts
slot(key: Ref<'slots'>): ViewModelSlot
```
Un slot de Base de datos ▸ Jugador: game.viewModel.slot("left").


#### attach()

```ts
attach(target?: NodeLike, opts?: ViewModelOptions): Promise<void>
```
Lleva un nodo —un evento, un trigger, un modelo— al view model. Sin objetivo: el evento que ejecuta el código. Equivale al comando «Mover al view model».


#### release()

```ts
release(target?: NodeLike, opts?: { at?: Vec3; seconds?: number; upright?: boolean }): Promise<void>
```
Devuelve un nodo al mundo: `at` = posición; sin `at`, delante del jugador en el suelo. Sin objetivo: el evento en curso.


#### throw()

```ts
throw(target?: NodeLike, opts?: { speed?: number; up?: number }): Promise<void>
```
Lanza un nodo de la mano hacia donde miras (`speed` en m/s): gira, rebota y queda en el suelo. Se resuelve al detenerse.


#### stash()

```ts
stash(target?: NodeLike, opts?: { slot?: Ref<'slots'> }): { id: string; name: string } | null
```
Quita un nodo de la mano (o del mundo) y lo esconde sin destruirlo: sin colisiones ni eventos. Devuelve `{ id, name }` —sirve para guardarlo en
una variable, por ejemplo `game.variables.set('Item', game.viewModel.stash())`— o `null` si no había nada. Sin objetivo: lo último del slot (`right` por defecto).


#### unstash()

```ts
unstash(target: NodeLike | 0 | null | undefined, opts?: { to?: 'hand' | 'world'; slot?: Ref<'slots'>; at?: Vec3; pos?: Vec3; rot?: Vec3; scale?: number; seconds?: number }): Promise<boolean>
```
Devuelve un objeto guardado, a la mano (`to: 'hand'`, por defecto) o al mundo (`to: 'world'`, en `at` o delante del jugador). `false` si no estaba guardado.


#### isStashed()

```ts
isStashed(target: NodeLike): boolean
```


#### clear()

```ts
clear(slot?: Ref<'slots'>): Promise<void[]>
```
Suelta todo lo del slot indicado (o de todo el view model).


#### isHeld()

```ts
isHeld(target?: NodeLike, slot?: Ref<'slots'>): boolean
```
¿Está el nodo en la mano? Con `slot`, en ese slot concreto. Sin objetivo: el evento en curso.


#### isEmpty()

```ts
isEmpty(slot?: Ref<'slots'>): boolean
```
¿Está vacío el slot (o, sin slot, todo el view model)?


#### heldIn()

```ts
heldIn(slot: Ref<'slots'>): { id: string; name: string }[]
```
Qué hay en un slot.


<a id="battler"></a>
## Battler

| Propiedad | Tipo | Descripción |
|---|---|---|
| `id` _(solo lectura)_ | `number` |  |
| `name` | `string` |  |
| `nickname` | `string` |  |
| `level` | `number` |  |
| `exp` | `number` |  |
| `hp` | `number` |  |
| `mp` | `number` |  |
| `mhp` _(solo lectura)_ | `number` |  |
| `mmp` _(solo lectura)_ | `number` |  |
| `atk` _(solo lectura)_ | `number` |  |
| `def` _(solo lectura)_ | `number` |  |
| `mat` _(solo lectura)_ | `number` |  |
| `mdf` _(solo lectura)_ | `number` |  |
| `agi` _(solo lectura)_ | `number` |  |
| `luk` _(solo lectura)_ | `number` |  |
| `skills` _(solo lectura)_ | `number[]` |  |
| `states` _(solo lectura)_ | `number[]` |  |
| `alive` _(solo lectura)_ | `boolean` |  |


<a id="party"></a>
## Party

| Propiedad | Tipo | Descripción |
|---|---|---|
| `gold` | `number` |  |
| `members` | `number[]` | Ids de los personajes del grupo. |


#### count()

```ts
count(kind: 'items' | 'weapons' | 'armors', x: Ref<'items' | 'weapons' | 'armors'>): number
```
Cantidad que tiene el grupo: game.party.count("items", "Poción").


#### has()

```ts
has(kind: 'items' | 'weapons' | 'armors', x: Ref<'items' | 'weapons' | 'armors'>, n?: number): boolean
```


#### gain()

```ts
gain(kind: 'items' | 'weapons' | 'armors', x: Ref<'items' | 'weapons' | 'armors'>, n?: number): number
```
Da (n > 0) o quita (n < 0) objetos, armas o armaduras: game.party.gain("items", "Poción", 2).


#### set()

```ts
set(kind: 'items' | 'weapons' | 'armors', x: Ref<'items' | 'weapons' | 'armors'>, n: number): number
```
Fija la cantidad exacta (0 = lo quita del inventario). Devuelve la cantidad resultante.


#### clearInventory()

```ts
clearInventory(kind?: 'items' | 'weapons' | 'armors'): void
```
Quita todo lo de ese tipo (o todo el inventario sin argumento).


#### list()

```ts
list(kind?: 'items' | 'weapons' | 'armors'): { kind: string; id: number; name: string; count: number }[]
```
El inventario como lista: [{ kind, id, name, count }].


#### addGold()

```ts
addGold(n: number): number
```


#### join()

```ts
join(actor: Ref<'actors'>): Battler
```


#### leave()

```ts
leave(actor: Ref<'actors'>): void
```


#### battler()

```ts
battler(actor: Ref<'actors'> | { enemy: Ref<'enemies'> } | { enemyInstance: string }): Battler
```
{enemy:id} sigue apuntando a la instancia predeterminada del tipo.


#### enemy()

```ts
enemy(x: Ref<'enemies'>): Battler & { readonly instanceId: string }
```


#### spawnEnemy()

```ts
spawnEnemy(x: Ref<'enemies'>): Battler & { readonly instanceId: string }
```
Crea un enemigo independiente y devuelve su referencia de instancia.


#### enemyInstance()

```ts
enemyInstance(instanceId: string): Battler & { readonly instanceId: string }
```


#### removeEnemy()

```ts
removeEnemy(instanceId: string): boolean
```


#### setLevel()

```ts
setLevel(actor: Ref<'actors'>, level: number): any
```


#### gainExp()

```ts
gainExp(actor: Ref<'actors'>, n: number): any
```


#### equip()

```ts
equip(actor: Ref<'actors'>, slot: number, item: Ref<'weapons' | 'armors'> | 0): void
```


#### weaponAction()

```ts
weaponAction(actor: Ref<'actors'>, target?: Ref<'actors'> | { enemy: Ref<'enemies'> } | { enemyInstance: string }): any
```
Ejecuta la habilidad configurada en el arma equipada; no requiere que el personaje la aprenda aparte.


#### addState()

```ts
addState(actor: Ref<'actors'>, state: Ref<'states'>, chance?: number): void
```


#### removeState()

```ts
removeState(actor: Ref<'actors'>, state: Ref<'states'>): void
```


#### tick()

```ts
tick(target?: Ref<'actors'> | { enemy: Ref<'enemies'> } | { enemyInstance: string }): [string, number][]
```
Un paso lógico explícito. Sin argumento procesa el grupo; acepta instancia enemiga.


#### recoverAll()

```ts
recoverAll(): void
```


#### useItem()

```ts
useItem(item: Ref<'items'>, target?: Ref<'actors'> | { enemy: Ref<'enemies'> } | { enemyInstance: string }, user?: Ref<'actors'> | null, context?: 'event' | 'menu'): any
```
El contexto predeterminado es event para conservar los scripts existentes.


#### runEvents()

```ts
runEvents(result: { events?: number[] }): Promise<void>
```
Ejecuta una vez los eventos comunes declarados en un resultado de uso válido.


#### useSkill()

```ts
useSkill(skill: Ref<'skills'>, user: Ref<'actors'>, target?: Ref<'actors'> | { enemy: Ref<'enemies'> } | { enemyInstance: string }): any
```


#### term()

```ts
term(key: string): string
```
Texto de un término del sistema (Base de datos ▸ Sistema ▸ Términos), p. ej. game.party.term("gold"). Si no existe devuelve la clave.


#### quest()

```ts
quest(x: Ref<'quests'>): { id: number; name: string; status: 'none' | 'active' | 'done' | 'failed'; done: number[]; total: number }
```


#### setQuest()

```ts
setQuest(x: Ref<'quests'>, action: 'start' | 'objective' | 'complete' | 'fail' | 'reset', objective?: number): any
```


#### collect()

```ts
collect(doc: Ref<'lore'>, on?: boolean): void
```


<a id="clockapi"></a>
## ClockApi

| Propiedad | Tipo | Descripción |
|---|---|---|
| `hour` | `number` | Hora del día, 0–24 (12 = mediodía). Escribirla la cambia al instante. |
| `text` _(solo lectura)_ | `string` | La hora como texto, «14:30». |
| `running` _(solo lectura)_ | `boolean` |  |
| `isNight` _(solo lectura)_ | `boolean` |  |
| `sunElevation` _(solo lectura)_ | `number` | Altura del sol sobre el horizonte, en grados (negativa = bajo el horizonte). |
| `day` _(solo lectura)_ | `number` | Día del año actual (1–366); con «El tiempo transcurre» avanza al pasar la medianoche. |
| `year` _(solo lectura)_ | `number` |  |
| `moon` _(solo lectura)_ | `{ illumination: number; name: string; waxing: boolean; elevation: number; azimuth: number }` | La luna: iluminación 0 (nueva) – 1 (llena), nombre de la fase («Cuarto creciente»…), si crece, y su posición (°). Sin astronomía real: siempre «Luna llena». |
| `planets` _(solo lectura)_ | `{ name: string; elevation: number; azimuth: number; magnitude: number }[]` | Mercurio, Venus, Marte, Júpiter y Saturno: altura y azimut (°, desde el norte hacia el este) y magnitud. Vacío sin astronomía real. |


#### set()

```ts
set(hour: number, seconds?: number): void
```
Pasa a esa hora; con `seconds` el reloj avanza hasta ella (el sol siempre avanza, no retrocede).


#### flow()

```ts
flow(on?: boolean, dayMinutes?: number): void
```
Hace que el tiempo transcurra (`dayMinutes` = minutos reales por día) o lo detiene.


#### setDate()

```ts
setDate(day: number, year?: number): void
```
Elige la fecha: día del año (1–366; 172 = 21 de junio) y año (1800–2050). Activa la astronomía real: sol, luna con fases, planetas y estrellas de ese día.


<a id="weatherapi"></a>
## WeatherApi

| Propiedad | Tipo | Descripción |
|---|---|---|
| `preset` _(solo lectura)_ | `WeatherId` |  |
| `intensity` _(solo lectura)_ | `number` |  |
| `list` _(solo lectura)_ | `WeatherId[]` |  |
| `wind` _(solo lectura)_ | `{ speed: number; dir: number; x: number; z: number }` | Viento ahora mismo: velocidad (m/s), dirección (°, hacia donde sopla) y componentes x, z. |
| `beaufort` _(solo lectura)_ | `[number, string]` | Escala de Beaufort: [0–12, nombre]. |
| `raining` _(solo lectura)_ | `boolean` |  |
| `snowing` _(solo lectura)_ | `boolean` |  |
| `foggy` _(solo lectura)_ | `boolean` |  |
| `visibility` _(solo lectura)_ | `number` | Visibilidad horizontal en metros a nivel del suelo (ley de Koschmieder V = 3,912/β). `Infinity` sin niebla. Con «Niebla: Física» cuenta la humedad y la altura. |
| `temperature` _(solo lectura)_ | `number` | Temperatura del aire (°C): la base de la escena, el desvío del tiempo (lluvia, niebla, nieve…) y el ciclo del día (máxima a las 15 h). |
| `humidity` _(solo lectura)_ | `number` | Humedad relativa 0–1 (con «Humedad y niebla realistas» sube de noche, cuando el aire se enfría). |
| `precipitation` _(solo lectura)_ | `number` | Precipitación en mm/h donde está el jugador (lluvia a pleno = 45; la nieve cuenta como agua equivalente). Con «Tipo de nubes: por celdas» es la que cae bajo la nube de ahí: puede ser 0 a un kilómetro de una tormenta. |
| `cloudModel` _(solo lectura)_ | `'classic' \| 'cells'` | Modelo de nubes de la escena: `classic` (ruido global, el tiempo es igual en todas partes) o `cells` (campo de celdas de Frost: hay nubes, huecos y tormentas localizadas). |
| `cloudCoverage` _(solo lectura)_ | `number` | Cielo cubierto 0–1 sobre el jugador. Con `cells` es el medido (profundidad óptica de las nubes sobre su cabeza); con `classic` la cobertura del tiempo. |
| `sunTransmission` _(solo lectura)_ | `number` | Fracción de sol directo que llega al jugador, 0–1. Con `cells`, exp(−τ) a lo largo del rayo hacia el sol (una nube delante la baja); con `classic`, el factor del tiempo. |
| `autoChange` _(solo lectura)_ | `boolean` | ¿El director de clima está cambiando el tiempo solo? |
| `soundsMuted` _(solo lectura)_ | `boolean` |  |
| `thunderRegion` _(solo lectura)_ | `string` | Región acústica donde está el oyente (`open`, `forest`, `valley`, `city`, `interior`): la de Escena ▸ Clima ▸ Regiones acústicas o la de por defecto. |
| `occlusion` _(solo lectura)_ | `number` | Oclusión actual del sonido del clima (0 al aire libre – 0,92 tapado por techos y paredes), ya suavizada. Solo la usa el trueno procedural. |


#### set()

```ts
set(id: WeatherId, intensity?: number, seconds?: number): boolean
```
Cambia el tiempo; con `seconds` la transición es gradual. Devuelve false si el tiempo no existe.


#### windAt()

```ts
windAt(x: number, z: number): { speed: number; dir: number; x: number; z: number; factor: number }
```
Viento local en el punto (x, z) tras aplicar los obstáculos del viento registrados (Bloque F).
`factor` 0–2 (1 = libre). Sin obstáculos registrados devuelve el viento global con `factor: 1`.


#### visibilityAt()

```ts
visibilityAt(y?: number): number
```
Visibilidad horizontal (m) a la altura `y` (metros): con niebla física crece al subir, con la simple es la misma.


#### precipitationAt()

```ts
precipitationAt(x: number, z: number): number
```
Precipitación (mm/h) en el punto (x, z) del mundo. Con `cells`, la de la nube que haya allí (huella desplazada por el viento); con `classic`, la misma en todas partes.


#### nearestStorm()

```ts
nearestStorm(maxDistance?: number): { distance: number; bearing: number } | null
```
Cumulonimbo apto para rayos más cercano al jugador (hasta `maxDistance` m, 8000 por defecto): distancia y rumbo (° desde el norte hacia el este). `null` si no hay (y siempre con `classic`).


#### auto()

```ts
auto(on?: boolean | null): void
```
Activa (`true`), apaga (`false`) o devuelve al ajuste del inspector (`null`) el director de clima.


#### next()

```ts
next(seconds?: number): WeatherId | null
```
Pasa ya al siguiente tiempo que elegiría el director (con `seconds` de transición). Devuelve su id.


#### strike()

```ts
strike(opts?: number | { distance?: number; bearing?: number }): { distance: number; delay: number } | null
```
Lanza un rayo: destello y, tras distance/343 s, el trueno (eventos `lightning` y `thunder`, y su sonido). distance en metros (30–8000).


#### muteSounds()

```ts
muteSounds(on?: boolean): void
```
Silencia (true) o devuelve (false) los sonidos del clima: lluvia, viento y truenos.


#### setOcclusion()

```ts
setOcclusion(value: number | null): void
```
Fuerza la oclusión (0–1) desde un script, p. ej. al cerrar una puerta; `null` vuelve a la automática (rayos de sonido).


<a id="timelinecameraexitpolicy"></a>
## TimelineCameraExitPolicy

| Propiedad | Tipo | Descripción |
|---|---|---|
| `to` | `'keep' \| 'camera3d' \| 'previous' \| 'player' \| 'pose' \| 'base'` | Destino de la cámara al terminar la secuencia. |
| `sceneId` | `string` | Requeridos para to:'camera3d'. |
| `cameraId` | `string` | Identificador de la cámara cuando el destino es Camera3D. |


<a id="timelinecameraexit"></a>
## TimelineCameraExit

| Propiedad | Tipo | Descripción |
|---|---|---|
| `natural` | `TimelineCameraExitPolicy` | Política cuando la secuencia termina normalmente. |
| `stop` | `TimelineCameraExitPolicy` | Política cuando se detiene. |
| `skip` | `TimelineCameraExitPolicy` | Política cuando se omite. |
| `interrupted` | `TimelineCameraExitPolicy` | Política cuando otra operación interrumpe la secuencia. |


<a id="timelineapi"></a>
## TimelineApi


#### play()

```ts
play(name: Ref<'timelines'>, opts?: { speed?: number; from?: number; lock?: boolean; skippable?: boolean; cameraExit?: TimelineCameraExit }): Promise<{ stopped?: boolean; skipped?: boolean }>
```
El nuevo recurso conserva fuente viva por defecto; los recursos existentes sin política no cambian.


#### stop()

```ts
stop(name?: Ref<'timelines'>): boolean
```
Detiene la secuencia indicada o la activa según el contexto.


#### skip()

```ts
skip(name?: Ref<'timelines'>): boolean
```
Solicita omitir la secuencia.


#### pause()

```ts
pause(name?: Ref<'timelines'>): boolean
```
Pausa la secuencia.


#### resume()

```ts
resume(name?: Ref<'timelines'>): boolean
```
Reanuda la secuencia pausada.


#### seek()

```ts
seek(name: Ref<'timelines'>, t: number): boolean
```
Cambia la posición temporal de la secuencia.


#### speed()

```ts
speed(name: Ref<'timelines'>, v: number): boolean
```
Cambia la velocidad de reproducción de la secuencia.


#### isPlaying()

```ts
isPlaying(name: Ref<'timelines'>): boolean
```
Consulta si la secuencia está reproduciéndose.


#### info()

```ts
info(name: Ref<'timelines'>): any
```
Consulta información de la secuencia indicada.


#### list()

```ts
list(): string[]
```
Nombres de las secuencias disponibles.


<a id="navapi"></a>
## NavApi

| Propiedad | Tipo | Descripción |
|---|---|---|
| `ready` _(solo lectura)_ | `boolean` | ¿Hay un mapa de navegación horneado en la escena? |


#### path()

```ts
path(from: Vec3, to: Vec3, opts?: { smooth?: boolean; allowPartial?: boolean }): Vec3[] | null
```
Busca una ruta entre dos posiciones; null si no puede resolverla.


#### nearest()

```ts
nearest(p: Vec3, max?: number): Vec3 | null
```
Busca un punto navegable cercano; null si no encuentra uno.


#### randomPoint()

```ts
randomPoint(center: Vec3, radius?: number): Vec3 | null
```
Busca un punto navegable aleatorio alrededor del centro indicado.


#### canWalk()

```ts
canWalk(a: Vec3, b: Vec3): boolean
```
Consulta si puede recorrer el tramo entre las dos posiciones.


<a id="audiosourcehandle"></a>
## AudioSourceHandle

Una fuente de audio de la escena (nodo Fuente de audio): game.audio.source("Radio").

| Propiedad | Tipo | Descripción |
|---|---|---|
| `name` _(solo lectura)_ | `string` |  |
| `playing` _(solo lectura)_ | `boolean` |  |
| `volume` | `number` | 0–2 |
| `pitch` | `number` |  |
| `mute` | `boolean` |  |
| `loop` | `boolean` | Solo escritura. |
| `done` _(solo lectura)_ | `Promise<void>` |  |


#### play()

```ts
play(): Promise<void>
```


#### stop()

```ts
stop(fade?: number): void
```


#### pause()

```ts
pause(): void
```


#### resume()

```ts
resume(): void
```


<a id="audiohandle"></a>
## AudioHandle

| Propiedad | Tipo | Descripción |
|---|---|---|
| `playing` _(solo lectura)_ | `boolean` |  |
| `done` _(solo lectura)_ | `Promise<void>` |  |


#### stop()

```ts
stop(fade?: number): void
```


#### pause()

```ts
pause(): void
```


#### resume()

```ts
resume(): void
```


#### setVolume()

```ts
setVolume(v: number): void
```


#### setPitch()

```ts
setPitch(v: number): void
```


#### setPosition()

```ts
setPosition(pos: Vec3): void
```


<a id="audioapi"></a>
## AudioApi


#### play()

```ts
play(clip: Ref<'clips'>, opts?: { group?: Ref<'groups'>; volume?: number; pitch?: number; loop?: boolean; delay?: number; at?: Vec3; node?: NodeLike; ui?: boolean; minDistance?: number; maxDistance?: number; rolloff?: number }): AudioHandle
```
game.audio.play("explosion", { group: "sfx", volume: 1, pitch: 1, loop: false, at: [x, y, z] | node: "Puerta" })


#### ui()

```ts
ui(clip: Ref<'clips'>, opts?: { group?: Ref<'groups'>; volume?: number; pitch?: number; loop?: boolean; delay?: number }): AudioHandle
```
Sonido de interfaz (2D) por el grupo «UI» del mezclador: así su volumen se controla aparte del resto.
@example game.audio.ui("clic")  ·  game.audio.setVolume("ui", 0.5)


#### source()

```ts
source(name: NodeLike): AudioSourceHandle | undefined
```
Una fuente de audio de la escena (nodo Fuente de audio) por nombre o id; undefined si no existe.


#### stopAll()

```ts
stopAll(group?: Ref<'groups'>, fade?: number): void
```
Detiene todo el audio, o solo el de un grupo.


#### pauseAll()

```ts
pauseAll(on?: boolean): void
```
Pausa (o reanuda con false) todo el audio.


#### groups()

```ts
groups(): string[]
```
Nombres de los grupos del mezclador.


#### setVolume()

```ts
setVolume(group: Ref<'groups'>, v: number, opts?: { save?: boolean }): void
```
Volumen lineal 0–1 de un grupo (1 = el del mezclador). Se recuerda entre partidas salvo `save: false`.


#### getVolume()

```ts
getVolume(group: Ref<'groups'>): number
```


#### mute()

```ts
mute(group: Ref<'groups'>, on?: boolean): void
```
Silencia (o reactiva con false) un grupo.


#### fade()

```ts
fade(group: Ref<'groups'>, to?: number, seconds?: number): Promise<void>
```
Lleva el volumen de un grupo a `to` (0–1) en `seconds`.


#### effect()

```ts
effect(group: Ref<'groups'>, name: AudioEffectName, params?: Record<string, number>): void
```
Activa un efecto en un grupo (o lo añade si no existe): game.audio.effect("sfx", "lowpass", { freq: 800 }).


#### effectOff()

```ts
effectOff(group: Ref<'groups'>, name: AudioEffectName): void
```


#### snapshot()

```ts
snapshot(name: string, seconds?: number): Promise<void>
```
Transición a un snapshot del mezclador.


#### snapshots()

```ts
snapshots(): string[]
```
Nombres de los snapshots del proyecto.


<a id="uiapi"></a>
## UiApi


#### open()

```ts
open(name: Ref<'uis'>, props?: object, opts?: { modal?: boolean; layer?: string }): Promise<any>
```
Abre una interfaz del proyecto; la promesa se resuelve con lo que pase close(resultado).


#### close()

```ts
close(name: Ref<'uis'>, result?: any): void
```
Cierra la interfaz y entrega el resultado a quien espera open().


#### toggle()

```ts
toggle(name: Ref<'uis'>, props?: object, opts?: { modal?: boolean; layer?: string }): Promise<any>
```
Alterna la apertura de la interfaz indicada.


#### isOpen()

```ts
isOpen(name: Ref<'uis'>): boolean
```
Comprueba si la interfaz está abierta.


#### showCanvas()

```ts
showCanvas(name: string): boolean
```
Nodos Canvas (cada uno dibuja su recurso .ui). Se identifican por el nombre del nodo.


#### hideCanvas()

```ts
hideCanvas(name: string): boolean
```
Oculta el Canvas por nombre.


#### toggleCanvas()

```ts
toggleCanvas(name: string): boolean
```
Alterna la visibilidad del Canvas por nombre.


#### isCanvasVisible()

```ts
isCanvasVisible(name: string): boolean
```
Consulta la visibilidad del Canvas por nombre.


#### canvas()

```ts
canvas(name: string): CanvasHandle | null
```
Manejador del Canvas: `visible`, show(), hide(), toggle(). Null si no existe.


#### closeAll()

```ts
closeAll(): void
```
Cierra todas las interfaces abiertas con open().


#### next()

```ts
next(): void
```
Acciones del sistema para las pantallas por defecto: avanzar el diálogo, elegir la opción `i`, reanudar la partida (pausa) y salir.


#### pick()

```ts
pick(index: number): void
```
Selecciona la opción por índice en la interfaz de opciones.


#### resume()

```ts
resume(): void
```
Reanuda la partida desde la pantalla de pausa.


#### quit()

```ts
quit(): void
```
Solicita salir de la partida.


<a id="canvashandle"></a>
## CanvasHandle

| Propiedad | Tipo | Descripción |
|---|---|---|
| `name` _(solo lectura)_ | `string` | Nombre del nodo Canvas. |
| `visible` | `boolean` | Visibilidad del Canvas. |


#### show()

```ts
show(): boolean
```
Muestra el Canvas.


#### hide()

```ts
hide(): boolean
```
Oculta el Canvas.


#### toggle()

```ts
toggle(): boolean
```
Alterna la visibilidad del Canvas.


<a id="variablesapi"></a>
## VariablesApi

| Propiedad | Tipo | Descripción |
|---|---|---|
| `names` _(solo lectura)_ | `string[]` | Nombres de la base de datos (índice 0 = variable 1). |


#### get()

```ts
get(x: Ref<'variables'>): any
```
Devuelve el valor de una variable por nombre o número.


#### set()

```ts
set(x: Ref<'variables'>, value: any): any
```
Asigna el valor y devuelve el valor almacenado.


#### add()

```ts
add(x: Ref<'variables'>, n?: any): any
```
Suma `n` (o concatena texto / añade a la lista).


#### name()

```ts
name(id: number): string
```
Nombre en la base de datos de la variable `id`.


#### id()

```ts
id(name: string): number
```
Id de la variable por su nombre (0 si no existe).


#### all()

```ts
all(): Record<string, any>
```
Todas las variables con valor: { id: valor }.


#### reset()

```ts
reset(): void
```
Todas las variables vuelven a 0.


#### push()

```ts
push(x: Ref<'variables'>, value: any): number
```
Operaciones de lista (una variable que no es lista empieza como lista vacía).


#### pop()

```ts
pop(x: Ref<'variables'>): any
```
Retira y devuelve el último elemento; 0 si la lista está vacía.


#### shift()

```ts
shift(x: Ref<'variables'>): any
```
Retira y devuelve el primer elemento; 0 si la lista está vacía.


#### unshift()

```ts
unshift(x: Ref<'variables'>, value: any): number
```
Inserta al principio y devuelve la longitud resultante.


#### insert()

```ts
insert(x: Ref<'variables'>, index: number, value: any): number
```
Inserta en el índice indicado (acotado a la lista); devuelve la longitud.


#### removeAt()

```ts
removeAt(x: Ref<'variables'>, index: number): any
```
Retira y devuelve el elemento del índice; 0 si no existe.


#### remove()

```ts
remove(x: Ref<'variables'>, value: any): boolean
```
Quita la primera aparición del valor; true si estaba.


#### at()

```ts
at(x: Ref<'variables'>, index: number): any
```
Lee el elemento del índice, comenzando en 0; devuelve 0 si no existe.


#### setAt()

```ts
setAt(x: Ref<'variables'>, index: number, value: any): number
```
Asigna un índice desde 0, rellenando huecos con ceros; devuelve la longitud.


#### length()

```ts
length(x: Ref<'variables'>): number
```
Cantidad de elementos de la lista.


#### clear()

```ts
clear(x: Ref<'variables'>): void
```
Vacía la lista.


#### includes()

```ts
includes(x: Ref<'variables'>, value: any): boolean
```
Comprueba si contiene el valor mediante comparación de contenido JSON.


#### indexOf()

```ts
indexOf(x: Ref<'variables'>, value: any): number
```
Índice desde 0 de la primera coincidencia por contenido; -1 si no existe.


#### shuffle()

```ts
shuffle(x: Ref<'variables'>): void
```
Mezcla los elementos de la lista al azar.


#### sort()

```ts
sort(x: Ref<'variables'>): void
```
Ordena números por valor y otros elementos por su representación textual.


#### reverse()

```ts
reverse(x: Ref<'variables'>): void
```
Invierte el orden de la lista.


#### join()

```ts
join(x: Ref<'variables'>, separator?: string): string
```
Une las representaciones textuales; el separador por defecto es coma y espacio.


#### sum()

```ts
sum(x: Ref<'variables'>): number
```
Suma los elementos convertidos a números.


#### min()

```ts
min(x: Ref<'variables'>): number
```
Mínimo numérico; 0 si la lista está vacía.


#### max()

```ts
max(x: Ref<'variables'>): number
```
Máximo numérico; 0 si la lista está vacía.


#### random()

```ts
random(x: Ref<'variables'>): any
```
Devuelve un elemento al azar; 0 si la lista está vacía.


<a id="saveinfo"></a>
## SaveInfo

| Propiedad | Tipo | Descripción |
|---|---|---|
| `slot` | `number` | Número de ranura. |
| `auto` | `boolean` | Autoguardado (ranura 0). |
| `empty` | `boolean` | true si la ranura no tiene partida (el resto de campos no existen). |
| `name` | `string` | Nombre asignado a la partida. |
| `date` | `string` | ISO 8601. |
| `playtime` | `number` | Segundos jugados. |
| `scene` | `string` | Escena registrada en la partida. |
| `level` | `string` | Nivel registrado en la partida. |
| `gold` | `number` | Oro del grupo al guardar. |
| `party` | `string[]` | Nombres de los miembros del grupo. |


<a id="saveapi"></a>
## SaveApi

| Propiedad | Tipo | Descripción |
|---|---|---|
| `slots` _(solo lectura)_ | `number` | Número de ranuras (1..N; la 0 es el autoguardado). Se configura en Base de datos ▸ Jugador. |
| `lastSlot` _(solo lectura)_ | `number` | Última ranura guardada o cargada (0 = ninguna). |
| `canSave` | `boolean` | Permite o bloquea guardar (el autoguardado siempre puede). |
| `busy` _(solo lectura)_ | `boolean` | Indica que hay una operación de guardado o carga en curso. |


#### list()

```ts
list(): SaveInfo[]
```
Todas las ranuras (0..N), las vacías con `empty: true`.


#### info()

```ts
info(slot?: number | 'last' | 'auto'): SaveInfo | null
```
Consulta los datos de una ranura.


#### exists()

```ts
exists(slot?: number | 'last' | 'auto'): boolean
```
Comprueba si existe una partida en la ranura.


#### latest()

```ts
latest(): number
```
Ranura con la partida más reciente, o -1.


#### save()

```ts
save(slot?: number | 'last' | 'auto', opts?: { name?: string; meta?: Record<string, any> }): Promise<boolean>
```
Guarda interruptores, variables, grupo, inventario, diario, game.state, escena, posición, hora, clima y objetos en las manos. false si está bloqueado.


#### load()

```ts
load(slot?: number | 'last' | 'auto'): Promise<boolean>
```
Carga la ranura y devuelve al jugador a donde estaba. false si está vacía.


#### delete()

```ts
delete(slot?: number | 'last' | 'auto'): boolean
```
Borra la ranura; true si había algo.


#### autosave()

```ts
autosave(): Promise<boolean>
```
Guarda en la ranura de autoguardado.


<a id="levelapi"></a>
## LevelApi

| Propiedad | Tipo | Descripción |
|---|---|---|
| `name` _(solo lectura)_ | `string` | Nombre del nivel actual. |
| `canRun` | `boolean` | ¿Puede correr? (false: la tecla de correr no hace nada). |
| `canCrouch` | `boolean` | Permite agacharse usando la configuración del jugador. |
| `canJump` | `boolean` | Permite o restringe el salto en este nivel. |
| `speedScale` | `number` | Multiplica la velocidad del jugador (0–10). |
| `gravityScale` | `number` | Multiplica la gravedad (0–10). |
| `canSwim` | `boolean` | ¿Se puede nadar en este nivel? false: en agua profunda camina por el fondo. |
| `canDive` | `boolean` | ¿Se puede bucear? false: nadando se queda en la superficie. |
| `waterCurrent` | `number` | Multiplica la fuerza de las corrientes (0–3). |


<a id="watersample"></a>
## WaterSample

Muestra del agua en un punto.

| Propiedad | Tipo | Descripción |
|---|---|---|
| `surface` | `number` | Altura de la superficie (con olas). |
| `flowX` | `number` | Corriente (m/s) en x y z. |
| `flowZ` | `number` |  |
| `edge` | `number` | Metros hacia dentro desde la orilla (≥ 0 dentro). |
| `name` | `string` |  |
| `color` | `string` |  |
| `deepColor` | `string` |  |
| `clarity` | `number` |  |


<a id="floatoptions"></a>
## FloatOptions

| Propiedad | Tipo | Descripción |
|---|---|---|
| `density` | `number` | Densidad respecto al agua: < 1 flota (0,6 madera, 0,9 casi a ras), ≥ 1 se hunde (0,6). |
| `drag` | `number` | Cuánto lo frena el agua y lo arrastra la corriente, por segundo (1,5; 0,8 en el respaldo sin Jolt). |
| `tilt` | `number` | Cuánto se inclina con las olas, 0–1 (1). |
| `current` | `number` | Multiplica la corriente que lo arrastra, 0–3 (1). |
| `sink` | `number` | Velocidad máxima de hundimiento en m/s si density ≥ 1 (1,2). Solo en el respaldo sin Jolt: con Jolt se hunde por su peso. |


<a id="bodyoptions"></a>
## BodyOptions (amplía [FloatOptions](#floatoptions))

| Propiedad | Tipo | Descripción |
|---|---|---|
| `shape` | `'box' \| 'sphere' \| 'capsule'` | Forma de colisión ajustada al objeto: 'box' (se apoya), 'sphere' (rueda) o 'capsule' ('box'). |
| `mass` | `number` | Masa en kg. Sin ella: volumen × densidad × 1000. |
| `friction` | `number` | Rozamiento 0–2 (0,6). |
| `bounce` | `number` | Rebote 0–1 (0,15). |
| `vel` | `Vec3` | Velocidad inicial [x, y, z] en m/s. |
| `float` | `boolean` | Si es true, además flota (densidad por defecto 0,6 en vez de 1,5). |


<a id="body"></a>
## Body

Un cuerpo dinámico: cae, choca, rueda, se empuja y flota o se hunde en el agua.

| Propiedad | Tipo | Descripción |
|---|---|---|
| `node` _(solo lectura)_ | `string` | Identificador del nodo asociado al cuerpo. |
| `state` _(solo lectura)_ | `'air' \| 'floating' \| 'sunk' \| 'ground'` | Estado de contacto o flotación del cuerpo. |
| `floating` _(solo lectura)_ | `boolean` | Indica si el cuerpo está flotando. |
| `mass` _(solo lectura)_ | `number` | Masa del cuerpo en kg. |
| `density` | `number` | Densidad relativa al agua. |
| `velocity` _(solo lectura)_ | `Vec3` | [x, y, z] en m/s. |
| `position` _(solo lectura)_ | `Vec3` | Origen del nodo en el mundo. |


#### push()

```ts
push(impulse: Vec3, at?: Vec3): void
```
Golpe seco en N·s (masa × velocidad). `at` = punto del mundo donde se da (hace girar).


#### setVelocity()

```ts
setVelocity(v: Vec3): void
```
Asigna la velocidad XYZ del cuerpo en m/s.


#### teleport()

```ts
teleport(x: number, y: number, z: number): void
```
Cambia la posición mundial del cuerpo.


#### stop()

```ts
stop(): void
```
Deja de ser dinámico: el objeto se queda donde está y vuelve a ser un sólido estático.


<a id="physicsapi"></a>
## PhysicsApi

| Propiedad | Tipo | Descripción |
|---|---|---|
| `bodies` _(solo lectura)_ | `Body[]` | Todos los cuerpos dinámicos de la escena. |


#### body()

```ts
body(node: NodeLike, options?: BodyOptions): Body
```
Hace dinámico un nodo (por nombre o nodo). Volver a llamarla cambia sus opciones.


#### get()

```ts
get(node: NodeLike): Body | null
```
El cuerpo de un nodo, o null si no es dinámico.


#### release()

```ts
release(node: NodeLike): void
```
Quita lo dinámico a un nodo.


#### impulse()

```ts
impulse(node: NodeLike, impulse: Vec3, at?: Vec3): void
```
Golpe seco (N·s) a un nodo dinámico.


#### explode()

```ts
explode(x: number, y: number, z: number, options?: { radius?: number; force?: number }): number
```
Empuja todo lo dinámico cercano a (x, y, z): `radius` m (6) y `force` m/s para lo pegado a la explosión (8). Devuelve cuántos cuerpos movió.


<a id="floater"></a>
## Floater

Un objeto que flota.

| Propiedad | Tipo | Descripción |
|---|---|---|
| `node` _(solo lectura)_ | `string` | Identificador del nodo que flota. |
| `state` _(solo lectura)_ | `'air' \| 'floating' \| 'sunk' \| 'ground'` | 'air' (cayendo) · 'floating' · 'sunk' (en el fondo) · 'ground' (en tierra). |
| `floating` _(solo lectura)_ | `boolean` | Indica si está flotando. |
| `density` | `number` | Densidad relativa al agua. |
| `velocity` _(solo lectura)_ | `Vec3` | [x, y, z] en m/s. |
| `position` _(solo lectura)_ | `Vec3` | Posición XYZ del objeto. |


#### stop()

```ts
stop(): void
```
Deja de flotar (el nodo se queda donde está).


<a id="splashoptions"></a>
## SplashOptions

| Propiedad | Tipo | Descripción |
|---|---|---|
| `power` | `number` | Fuerza 0–1,5: 0,2 gota suave · 0,6 chapuzón · 1 zambullida. |
| `y` | `number` | Altura de la superficie; sin ella se usa la del agua en ese punto. |
| `color` | `string` |  |
| `drops` | `number` | Número de gotas (por defecto según la fuerza; 0 = solo la onda). |


<a id="waterapi"></a>
## WaterApi

@deprecated API histórica de agua. La exposición de game.water en el intérprete está pendiente de resolución; no se garantiza disponibilidad.

| Propiedad | Tipo | Descripción |
|---|---|---|
| `floaters` _(solo lectura)_ | `Floater[]` | Los objetos que flotan ahora. |


#### at()

```ts
at(x: number, z: number): WaterSample | null
```
Muestra el agua en (x, z), o null si ahí no hay.


#### height()

```ts
height(x: number, z: number): number | null
```
Altura de la superficie en (x, z), o null.


#### splash()

```ts
splash(x: number, z: number, opts?: SplashOptions): boolean
```
Salpicadura (gotas + onda). Devuelve false si ahí no hay agua (y no se dio `y`).


#### ripple()

```ts
ripple(x: number, z: number, amp?: number): void
```
Solo una onda; `amp` 0–1,5.


#### float()

```ts
float(node: NodeLike, opts?: FloatOptions): Floater & Body
```
Hace que un nodo flote: cabecea, se inclina con las olas y la corriente lo arrastra.
API histórica: no utilizar desde scripts mientras game.water no esté disponible.


#### unfloat()

```ts
unfloat(node: NodeLike): void
```
Deja de flotar.


<a id="sceneprops"></a>
## SceneProps

Propiedades de entorno que se pueden cambiar en juego. Con Hora/Clima activos, cielo, luz y niebla los gobierna el mundo (game.clock / game.weather).

| Propiedad | Tipo | Descripción |
|---|---|---|
| `skyTop` | `string` | Color de la parte superior del cielo. |
| `skyHorizon` | `string` | Color del horizonte. |
| `ground` | `string` | Color de la parte inferior del entorno. |
| `ambientColor` | `string` | Color de la iluminación ambiente. |
| `ambient` | `number` | Intensidad de la luz ambiente (0–4). |
| `skyExposure` | `number` | Exposición del cielo. |
| `fog` | `boolean` | Habilita la niebla. |
| `fogDensity` | `number` | Densidad de la niebla (0–0.2). |
| `fogStart` | `number` | Metros a partir de los cuales empieza la niebla (0 = desde la cámara). |
| `fogColor` | `string` | Color de la niebla. |
| `fogMode` | `'simple' \| 'physical'` | Modelo de niebla: `"simple"` (exponencial uniforme, la de siempre) o `"physical"` (altura analítica, humedad, dispersión del sol, haces de sol y volúmenes atmosféricos). Necesita perfil Medio o Alto; sin él se usa la simple. |
| `fogFalloff` | `number` | Niebla física: caída de la densidad con la altura en 1/m (0 = automática por humedad: 0,00085 seco … 0,00185 saturado). |
| `fogHeight` | `number` | Niebla física: altura (m) por debajo de la cual la densidad es máxima. |
| `fogShafts` | `number` | Niebla física: intensidad de los haces de sol (0–3, 1 = normal, 0 = sin haces). |
| `fogScatter` | `number` | Niebla física: cuánta luz del sol dispersa la niebla (0–3, 1 = normal). |
| `volOn` | `boolean` | Niebla volumétrica (haces de luz): activada. Requiere perfil Medio o Alto y luces marcadas «Volumétrica». |
| `volDensity` | `number` | Densidad del efecto volumétrico. |
| `volIntensity` | `number` | Intensidad del efecto volumétrico. |
| `volNoise` | `number` | Ruido 3D animado de la niebla volumétrica (0 = lisa, 1 = bancos muy marcados). |
| `volNoiseScale` | `number` | Tamaño de los bancos de niebla (m). |
| `volNoiseSpeed` | `number` | Velocidad a la que el viento los arrastra (m/s). |


<a id="sceneapi"></a>
## SceneApi (amplía [SceneProps](#sceneprops))

| Propiedad | Tipo | Descripción |
|---|---|---|
| `name` _(solo lectura)_ | `string` |  |
| `props` _(solo lectura)_ | `(keyof SceneProps)[]` | Nombres de las propiedades editables. |


#### set()

```ts
set(values: Partial<SceneProps>): void
```
Cambia varias a la vez: `game.scene.set({ fog: true, fogDensity: 0.05 })`. Lanza un error con un nombre o valor no válido.


#### reset()

```ts
reset(): void
```
Vuelve al entorno del proyecto.


<a id="runtimeprefabsapi"></a>
## RuntimePrefabsApi

Prefabs temporales del mundo activo; nunca cambian los recursos guardados.


#### instantiate()

```ts
instantiate(prefab: Ref<'prefabs'>, options?: { parent?: NodeLike; position?: Vec3 }): NodeHandle
```
Instancia un recurso de Assets/Prefabs. La posición opcional es mundial.


#### destroy()

```ts
destroy(instance: NodeLike): boolean
```
Destruye solo una instancia dinámica creada durante Play.


<a id="runtimescenesapi"></a>
## RuntimeScenesApi

Escenas reutilizables instanciadas en la sesión activa. No cambia de nivel.


#### instantiate()

```ts
instantiate(scene: Ref<'scenes'>, options?: { parent?: NodeLike; position?: Vec3 }): Promise<NodeHandle>
```
Instancia una escena del paquete Player. Fuentes no referenciadas estáticamente deben estar en Build. Posición mundial.


#### destroy()

```ts
destroy(instance: NodeLike): boolean
```
Destruye únicamente una instancia creada por game.scenes.instantiate().


<a id="tornadosignal"></a>
## TornadoSignal

Datos comunes emitidos por el tornado de World.

| Propiedad | Tipo | Descripción |
|---|---|---|
| `id` | `string` | Identificador del tornado. |
| `position` | `Vec3` | Posición mundial XYZ del tornado. |
| `radius` | `number` | Radio del tornado en metros. |
| `height` | `number` | Altura del tornado en metros. |
| `age` | `number` | Edad del tornado en segundos. |


<a id="tornadophasesignal"></a>
## TornadoPhaseSignal (amplía [TornadoSignal](#tornadosignal))

Transición entre fases del tornado.

| Propiedad | Tipo | Descripción |
|---|---|---|
| `phase` | `string` | Fase actual del tornado. |
| `previous` | `string` | Fase anterior del tornado. |


<a id="tornadobodysignal"></a>
## TornadoBodySignal (amplía [TornadoSignal](#tornadosignal))

Entrada o salida del dominio meteorológico.

| Propiedad | Tipo | Descripción |
|---|---|---|
| `objectId` | `string` | Identificador del objeto que cruza el dominio del tornado. |


## Tipos auxiliares

| Tipo | Definición | Descripción |
|---|---|---|
| `Vec3` | `[number, number, number]` |  |
| `NodeLike` | `Ref<'nodes'> \| { id: string } \| { name: string }` | Cualquier cosa que identifique un nodo o un evento: su nombre, su id o el handle de game.node()/game.event()/event. |
| `WeatherId` | `'clear' \| 'partly' \| 'cloudy' \| 'overcast' \| 'fog' \| 'drizzle' \| 'rain' \| 'storm' \| 'snow'` |  |
| `AudioEffectName` | `'eq3' \| 'lowpass' \| 'highpass' \| 'compressor' \| 'limiter' \| 'reverb' \| 'echo' \| 'distortion'` |  |
| `RouteStep` | `string \| [string, ...any[]] \| { c: string; p?: object }` | Paso de una ruta de movimiento: ["forward", 2] · "turnPlayer" · { c: "wait", p: { seconds: 1 } } |

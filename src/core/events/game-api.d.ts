// Century · API de scripts (game, event, args).
// ESTA es la fuente única de la API para los editores: la usan el editor de scripts interno (sugerencias), la carpeta del proyecto
// (.levelforge/api.d.ts → VS Code) y la extensión de VS Code. Si añades algo a game.* en events/interpreter.js o play*.js,
// decláralo aquí (las pruebas de paridad comprueban que no se desincronicen).
//
// Los nombres de tu proyecto (objetos, interruptores, nodos…) los añade el archivo generado `.levelforge/project.d.ts`
// ampliando `LF.ProjectNames`; así el autocompletado sugiere «Poción» o «Puerta» y no solo texto libre.

declare namespace LF {
  /** Lo rellena `.levelforge/project.d.ts` (generado por Century). Claves: switches, variables, nodes, events, scenes, prefabs, timelines, uis, clips, groups, slots, items, weapons, armors, skills, actors, classes, enemies, states, quests, lore, commonEvents, texts (claves de Localización), languages. */
  interface ProjectNames {}

  /** Un nombre del proyecto (se sugieren los reales) o su número. Cualquier texto es válido: se comprueba al ejecutar. */
  type Ref<K extends string> = (K extends keyof ProjectNames ? ProjectNames[K] : never) | (string & {}) | number

  type Vec3 = [number, number, number]

  /** Animación de entrada y salida de un diálogo, unas opciones o un subtítulo. Sin ellas, la de la interfaz (diseñador). */
  interface DialogAnim {
    /** 'none' · 'fade' · 'rise' (subir) · 'pop' (escala) · 'slide' (deslizar) */
    enter?: 'none' | 'fade' | 'rise' | 'pop' | 'slide'
    /** 'none' · 'fade' · 'sink' (bajar) · 'shrink' (encoger) · 'slide' (deslizar) */
    exit?: 'none' | 'fade' | 'sink' | 'shrink' | 'slide'
    /** Segundos (0,25 por defecto; máximo 3). */
    duration?: number
  }

  /** Un Trigger tal como lo reciben game.on("triggerEnter" …) y los slots del nodo. */
  interface TriggerInfo { 
    /** Identificador del Trigger. */
    id: string; 
    /** Nombre del Trigger. */
    name: string; 
    /** Etiqueta asociada al Trigger. */
    tag: string }

  interface Hit {
    /** Punto mundial de impacto XYZ. */
    point: Vec3
    /** Normal de la superficie de impacto, si está disponible. */
    normal: Vec3 | null
    /** Distancia desde el origen del rayo. */
    distance: number
    /** Nodo alcanzado, cuando está disponible. */
    node?: NodeHandle
    /** 'solid' (geometría con colisión) o 'trigger' (volumen de un nodo Trigger; solo con `triggers: true`). */
    kind: 'solid' | 'trigger'
    /** Datos del Trigger cuando `kind` es 'trigger'. */
    trigger?: TriggerInfo
  }

  /** Filtro de game.raycast() y game.player.look(). Sin opciones, el rayo golpea lo primero sólido que encuentra. */
  interface RayOptions {
    /** Solo cuentan los nodos que estén en alguna de estas layers (nombre de Tags y Layers, o su número). El resto NO estorba: el rayo lo atraviesa. */
    layers?: string | number | (string | number)[]
    /** Solo cuentan los nodos con alguna de estas etiquetas (Tag). */
    tags?: string | string[]
    /** Nodos que el rayo atraviesa (el propio jugador, un arma en la mano…). */
    ignore?: NodeLike | NodeLike[]
    /** También detecta los volúmenes de los nodos Trigger (por defecto no: son sensores). Si el rayo entra en el Trigger antes de chocar con algo sólido, devuelve el Trigger. */
    triggers?: boolean
  }

  /** Opciones de game.sensor(). */
  interface SensorOptions {
    /** Quién mira: un nodo (nombre o id) o "player". Un nodo mira hacia su -Z local. */
    from: NodeLike | 'player'
    /** Alcance de la vista en metros (15). */
    range?: number
    /** Ángulo de visión total en grados (360 = ve a todos lados). */
    fov?: number
    /** Qué buscar. Sin nada: cualquier nodo visible (y el jugador). */
    targets?: {
      /** Incluir al jugador. */
      player?: boolean
      /** Nodos con alguna de estas etiquetas. */
      tags?: string | string[]
      /** Nodos en alguna de estas layers (nombre o número). */
      layers?: string | number | (string | number)[]
      /** Nodos concretos. */
      nodes?: NodeLike | NodeLike[]
    }
    /** Si algo sólido tapa la vista, no lo ve (true). */
    lineOfSight?: boolean
    /** Oído: dentro de este radio detecta sin importar el ángulo ni las paredes (0 = sordo). */
    hearRange?: number
    /** Segundos que recuerda lo que dejó de ver antes de dar 'lost' (0). */
    memory?: number
    /** Segundos entre miradas (0.15). Más alto = más barato. */
    interval?: number
    /** Posición de los ojos respecto al nodo, [x, y, z] ([0, 1.5, 0]). */
    eye?: Vec3
    /** Altura sobre los pies del objetivo a la que se apunta el rayo (0.9). */
    targetHeight?: number
    enabled?: boolean
  }

  /** Algo que un sensor detecta. */
  interface Detection {
    /** Identificador de la entidad detectada. */
    id: string
    /** Nombre de la entidad detectada. */
    name: string
    /** El nodo (undefined si es el jugador). */
    node?: NodeHandle
    /** Distancia a la entidad detectada. */
    distance: number
    /** Grados entre hacia dónde mira el sensor y el objetivo. */
    angle: number
    /** Lo ve ahora mismo (en rango, en el cono y sin nada en medio). */
    visible: boolean
    /** Solo lo oye (dentro de hearRange, sin verlo). */
    heard: boolean
    /** Segundos de sensor desde la última vez que lo vio u oyó. */
    lastSeen: number
    /** Posición XYZ de la entidad detectada. */
    position: Vec3
  }

  /** Sensor de visión/oído creado con game.sensor(). Vive lo que dura la escena: créalo en game.on("scene"). */
  interface Sensor {
    enabled: boolean
    range: number
    fov: number
    hearRange: number
    memory: number
    /** Todo lo detectado (visto, oído o recordado), del más cercano al más lejano. */
    readonly detections: Detection[]
    readonly nearest: Detection | null
    readonly count: number
    /** ¿Ve ahora mismo a ese nodo (o "player")? Sin argumento: ¿ve algo? */
    sees(who?: NodeLike | 'player'): boolean
    /** ¿Lo tiene detectado (visto, oído o recordado)? */
    detects(who?: NodeLike | 'player'): boolean
    /** Escucha 'detected' (entra uno nuevo), 'lost' (se pierde, tras `memory`) o 'update' (cada mirada). Devuelve la función para dejar de escuchar. */
    on(event: 'detected' | 'lost', fn: (d: Detection) => void): () => void
    on(event: 'update', fn: (all: Detection[]) => void): () => void
    /** Mira ya, sin esperar al siguiente intervalo. */
    pulse(): void
    remove(): void
  }

  /** Input Map (Ajustes del juego ▸ Input Map). Donde dice `ref` vale el nombre de una acción («jump») o una tecla suelta («KeyF», «Mouse1», «Pad0»). */
  interface InputApi {
    /** Indica si la acción o entrada está mantenida. */
    pressed(ref: string): boolean
    /** Indica si la acción o entrada acaba de pulsarse en este fotograma. */
    justPressed(ref: string): boolean
    /** Indica si la acción o entrada acaba de soltarse en este fotograma. */
    justReleased(ref: string): boolean
    /** Fuerza 0..1 de una acción (ejes del mando analógicos). */
    strength(action: string): number
    /** pos − neg, de −1 a 1: game.input.axis("move_left", "move_right"). */
    axis(negative: string, positive: string): number
    /** Combina cuatro acciones en un vector de longitud máxima 1. */
    vector(negX: string, posX: string, negY: string, posY: string): { x: number; y: number }
    /** Delta relativo del ratón capturado durante el fotograma actual; (0,0) sin captura. */
    readonly pointerDelta: { x: number; y: number }
    /** Nombres de las acciones del mapa de entrada actual. */
    readonly actions: string[]
    /** Indica si existe la acción por nombre. */
    has(action: string): boolean
    /** Entradas asignadas a la acción; lista vacía si no existe. */
    bindings(action: string): string[]
    /** Texto legible de una entrada: «KeyE» → «E». */
    label(token: string): string
    /** «E / Intro / Clic izquierdo». */
    labels(action: string): string
    /** Suscribe una función a la pulsación; devuelve una función para cancelar la suscripción. */
    onPress(ref: string, fn: () => void): () => void
    /** Suscribe una función a la liberación; devuelve una función para cancelar la suscripción. */
    onRelease(ref: string, fn: () => void): () => void
    /** Espera a que se pulse la acción o tecla. */
    wait(ref: string): Promise<void>
    /** Espera a que el jugador pulse algo y devuelve su entrada (para menús de reasignar). */
    capture(): Promise<string | null>
    /** Activa la acción; con on=false la desactiva. */
    enable(action: string, on?: boolean): void
    /** Desactiva la acción sin eliminar sus asignaciones. */
    disable(action: string): void
    /** Consulta si la acción está habilitada. */
    isEnabled(action: string): boolean
    /** Crea una acción con sus entradas iniciales en el mapa de juego. */
    create(action: string, tokens?: string[]): void
    /** Elimina una acción del mapa de juego. */
    remove(action: string): void
    /** Añade una entrada a una acción. */
    bind(action: string, token: string): void
    /** Reemplaza las entradas de una acción. */
    rebind(action: string, tokens: string[]): void
    /** Restablece las entradas predeterminadas de la acción. */
    reset(action: string): void
  }

  /** Ajustes gráficos públicos del juego; admite los demás ajustes de render existentes. */
  interface GraphicsSettings {
    /** Activa el estilo PSX y la escala de imagen con nearest. */
    psx: boolean
    /** Resolución vertical interna: 240p, 480p o 0 para resolución nativa. */
    psxHeight: 0 | 240 | 480
    /** Cuadrícula de vértices en píxeles: 0 desactiva el ajuste, 1–4 lo intensifica. */
    psxSnap: 0 | 1 | 2 | 3 | 4
    /** Interpolación affine del mapa de color en modelos GLTF/GLB compatibles con UV0. */
    psxAffine: boolean
    /** Otros ajustes gráficos públicos. */
    [key: string]: any
  }

  /** Gráficos en juego (para un menú de calidad): se superpone al render del proyecto; en el exe se recuerda entre partidas. */
  interface GraphicsApi {
    /** 'forward' (Forward+) · 'mobile' · 'compat' (Compatibility). */
    renderer: 'forward' | 'mobile' | 'compat'
    readonly renderers: { id: string; name: string }[]
    /** Calidad de sombras, reflejos y efectos. */
    quality: 'alto' | 'medio' | 'bajo'
    /** Escala de resolución 0.25–1. */
    resolutionScale: number
    /** Copia de los ajustes de render actuales (mismos nombres que Ajustes del juego ▸ Render). */
    readonly settings: GraphicsSettings
    /** Cambia ajustes sueltos: game.graphics.set({ psx: true, psxSnap: 4 }) o game.graphics.set({ bloom: 0, ao: 0 }). */
    set(patch: Partial<GraphicsSettings>): void
    /** Vuelve a lo que dice el proyecto. */
    reset(): void
  }

  interface ProfileApi {
    /** Pone el perfil (nombre o id) mezclándolo en `seconds`. Devuelve su nombre. */
    set(name: string, seconds?: number): string | null
    /** Vuelve al render del proyecto. */
    clear(seconds?: number): void
    /** Nombre del perfil activo (null = el del proyecto). */
    readonly current: string | null
  }

  /** Una animación en marcha (clip de Animación). */
  interface AnimationHandle {
    /** Nombre del clip reproducido. */
    readonly clip: string
    /** Instante actual (s). */
    readonly time: number
    /** Duración del clip en segundos. */
    readonly duration: number
    /** Multiplicador de velocidad de reproducción. */
    speed: number
    /** Indica si la animación se repite. */
    loop: boolean
    /** Indica si la animación está reproduciéndose. */
    readonly playing: boolean
    /** Indica si la animación está pausada. */
    readonly paused: boolean
    /** Indica si terminó la animación. */
    readonly finished: boolean
    /** Pausa la reproducción. */
    pause(): void
    /** Reanuda la reproducción. */
    resume(): void
    /** Sitúa la reproducción en el instante indicado en segundos. */
    seek(seconds: number): void
    /** Detiene; con `true` el nodo vuelve a su pose inicial. */
    stop(reset?: boolean): void
    /** Capa en la que suena (animaciones de modelo). */
    readonly layer: string
    /** Peso de mezcla 0–1 (animaciones de modelo; se puede cambiar en vivo). */
    weight: number
    /** Se resuelve al terminar (o al detenerla). */
    readonly done: Promise<{ stopped: boolean; clip: string }>
  }
  interface AnimationOptions {
    /** Fuerza el bucle (sí/no); por defecto el del clip. */
    loop?: boolean
    /** Multiplica la velocidad. */
    speed?: number
    /** Mezcla de entrada con la pose actual (s). */
    fade?: number
    /** Empieza en este instante (s). */
    from?: number
    /** Fuerza el modo aditivo (sí/no); por defecto el del clip. */
    additive?: boolean
    /** Animaciones de modelo (.glb): capa. Los clips de la misma capa se sustituyen; capas distintas suenan a la vez (por defecto una única capa). */
    layer?: string
    /** Animaciones de modelo: peso de mezcla 0–1 (por defecto 1). */
    weight?: number
    /** Animaciones de modelo: solo las pistas de huesos cuyo nombre contenga alguno de estos textos (`"spine, arm"` o `["spine","arm"]`) — capa de medio cuerpo. */
    mask?: string | string[]
  }
  /** Métodos de animación de un nodo o de un slot del view model. */
  interface Animatable {
    /** Reproduce un clip sobre este nodo (sus pistas se resuelven desde aquí hacia los hijos). Si ya suena, lo reinicia. */
    playAnimation(clip: string, opts?: AnimationOptions): AnimationHandle
    /** Detiene un clip (o todos) de este nodo. `reset: true` deja la pose inicial. */
    stopAnimation(clip?: string, opts?: { reset?: boolean; layer?: string }): void
    /** Pausa la animación del nodo; el clip es opcional. */
    pauseAnimation(clip?: string): void
    /** Reanuda la animación del nodo; el clip es opcional. */
    resumeAnimation(clip?: string): void
    /** Consulta si el nodo está reproduciendo una animación. */
    isAnimating(clip?: string): boolean
    /** Manejadores de animación del nodo. */
    readonly animations: AnimationHandle[]
  }
  interface AnimationApi {
    /** game.animation.play(nodo, "Beber", { loop, speed, fade }) — sin nodo, el evento en curso. */
    play(node: NodeLike | undefined, clip: string, opts?: AnimationOptions): AnimationHandle
    stop(node?: NodeLike, clip?: string, opts?: { reset?: boolean; layer?: string }): number
    isPlaying(node?: NodeLike, clip?: string): boolean
    active(node?: NodeLike): AnimationHandle[]
    /** Nombres de todos los clips del proyecto. */
    list(): string[]
    /** Animaciones embebidas en el modelo de un nodo (huesos/skinning de un .glb). node.playAnimation("Walk") las reproduce igual que los clips del proyecto. */
    modelClips(node?: NodeLike): string[]
    has(clip: string): boolean
    duration(clip: string): number
    stopAll(): void
  }

  /** Efecto visual de un nodo Camera Shake Base; no mueve al cuerpo ni modifica la receta guardada. */
  interface CameraShakeApi {
    /** Reproduce o reinicia el nodo desde cero. Intensidad de 0 a 1. false si no es válido o está deshabilitado. */
    play(node: NodeLike, opts?: { intensity?: number }): boolean
    /** Detiene el efecto; respeta Blend Out y evita el reinicio automático. */
    stop(node: NodeLike): boolean
    /** Multiplicador transitorio de 0 a 1. No cambia las propiedades del nodo. */
    setIntensity(node: NodeLike, intensity: number): boolean
    /** true mientras el efecto está en reproducción; false durante su salida o al terminar. */
    isPlaying(node: NodeLike): boolean
  }

  /** Transición única; se mide con el reloj del juego y nunca cambia el propietario de la cámara. */
  interface CameraTransitionOptions {
    /** Duración de la transición en segundos. */
    seconds?: number
    /** Interpolación lineal o suavizada de entrada y salida. */
    ease?: 'linear' | 'inOut'
  }
  /** Opciones de salida explícita. keep conserva la Camera3D viva; pose retiene un fotograma. */
  interface CameraReleaseOptions extends CameraTransitionOptions {
    /** Destino explícito al liberar la cámara. */
    to?: 'keep' | 'base' | 'camera3d' | 'previous' | 'player' | 'pose'
    /** Identificador de la cámara de destino cuando se solicita Camera3D. */
    cameraId?: string
  }
  /** Uso temporal exclusivo de una Camera3D de la escena activa. No modifica datos guardados. */
  interface CameraLease {
    /** Solicita el uso de la Camera3D indicada mediante esta concesión; devuelve si se aceptó. */
    use(cameraId: string): boolean
    /** Solicita el uso de la Camera3D indicada mediante esta concesión; devuelve si se aceptó. */
    use(cameraId: string, options: CameraTransitionOptions): boolean
    /** Libera la concesión con la política de salida indicada; devuelve si se aceptó. */
    release(options?: CameraReleaseOptions): boolean
  }

  /** Autoridad de cámara del runtime; accesible desde cualquier script sin depender de Timeline. */
  interface CameraApi {
    /** Solicita control temporal de la Camera3D indicada; null si no se concede. */
    acquire(cameraId: string): CameraLease | null
    /** Solicita control temporal de la Camera3D indicada; null si no se concede. */
    acquire(cameraId: string, options: CameraTransitionOptions): CameraLease | null
    /** Fuente de cámara actual y su identificación, si existe. */
    readonly active: { kind: 'camera3d' | 'player' | 'timeline' | 'film' | 'pose'; id?: string; requested?: boolean; held?: boolean } | null
  }

  /** Una luz (nodo Luz / Foco / Sol). Los cambios son de la partida; no tocan el proyecto. */
  interface LightHandle {
    /** Encendida o apagada. */
    on: boolean
    /** Alterna y devuelve el nuevo estado. */
    toggle(): boolean
    /** '#rrggbb' */
    color: string
    /** Energía (intensidad de la luz). */
    energy: number
    /** Alcance en metros (0 en el Sol). */
    range: number
    /** Ángulo del foco en grados (solo focos). */
    angle: number
    /** Habilita o deshabilita las sombras de la luz. */
    shadow: boolean
    /** Tipo de luz: omnidireccional, foco o direccional. */
    readonly type: 'omni' | 'spot' | 'directional'
    /** Mezcla energía, color y/o rango en `seconds`. */
    fadeTo(to: { energy?: number; color?: string; range?: number }, seconds?: number): Promise<void>
    /** Enciende con fundido opcional; `to` fija intensidad/color/alcance de destino. */
    turnOn(seconds?: number, to?: { energy?: number; color?: string; range?: number }): Promise<void>
    /** Apaga con fundido opcional (recuerda su energía para turnOn). */
    turnOff(seconds?: number): Promise<void>
  }

  /** Datos de una señal física Area3D emitida desde el sensor Jolt existente. */
  interface Area3DSignalEvent {
    areaId: string
    type: 'body' | 'area'
    id: string
  }

  interface NodeHandle extends Animatable {
    /** Comprueba si la misma instancia lógica continúa montada en esta sesión Play. */
    is_valid(): boolean
    /** Invoca un método explícitamente publicado por el Script de Nodo de esta instancia.
     * Los errores y los rechazos Promise se propagan al llamador. */
    call<T = unknown>(name: string, ...args: any[]): T
    /** Conecta un método publicado del receptor a una señal declarada por este nodo.
     * Area3D también admite body_entered, body_exited, area_entered y area_exited sin script emisor.
     * El método receptor recibe un Area3DSignalEvent para señales físicas.
     * Devuelve false si la misma conexión ya existe. */
    connect(name: string, receiver: NodeHandle, method: string): boolean
    /** Desconecta una conexión existente. Es idempotente. */
    disconnect(name: string, receiver: NodeHandle, method: string): boolean
    /** Padre actual; null en la raíz. */
    readonly parent: NodeHandle | null
    /** Hijos activos en orden de jerarquía. */
    readonly children: NodeHandle[]
    /** Resuelve rutas relativas y absolutas; null si no existe. */
    get_node(path: string): NodeHandle | null
    /** Identificador del nodo. */
    readonly id: string
    /** Nombre del nodo en la escena. */
    readonly name: string
    /** Objeto Three.js del nodo (avanzado). */
    readonly object3D: any
    /** Habilitación propia: false suspende procesamiento y física, independiente de la visibilidad. */
    active: boolean
    /** Estado visual propio. No indica si esta cámara gobierna la salida. */
    visible: boolean
    /** Posición local XYZ del nodo. */
    position: Vec3
    /** Mueve el nodo (relativo o absoluto) en `seconds`; la promesa termina al llegar. */
    move(pos: Vec3, seconds?: number, rel?: boolean): Promise<void>
    /** @deprecated Etiqueta antigua; solo para compatibilidad de proyectos existentes. */
    readonly tag: string
    /** Añade una pertenencia lógica durante esta sesión Play. */
    add_to_group(name: string): boolean
    /** Quita una pertenencia lógica durante esta sesión Play. */
    remove_from_group(name: string): boolean
    /** Comprueba la pertenencia lógica al grupo indicado. */
    is_in_group(name: string): boolean
    /** Devuelve los grupos lógicos del nodo. */
    get_groups(): string[]
    /** Nombres de sus layers (puede estar en varias). */
    readonly layers: string[]
    /** Comprueba si el nodo pertenece a la capa indicada. */
    inLayer(name: string): boolean
    /** Superficie de sus layers ('stone', 'grass'…; '' si ninguna). */
    readonly surface: string
    /** Conserva el nodo y sus descendientes al cambiar de escena durante Play. No modifica el recurso de autoría. */
    dontDestroyOnLoad: boolean
    /** Marca o desmarca persistencia de este nodo; false si no existe. @example node.keepOnLoad(true) */
    keepOnLoad(enabled?: boolean): boolean
    /** ¿Está en la mano (view model)? */
    readonly held: boolean
    /** Slot donde está ('right', 'left'…) o null. */
    readonly heldSlot: string | null
    /** Si el nodo es una luz: encender, apagar, color, energía… */
    readonly light: LightHandle | undefined
    /** Tipo de nodo: 'primitive', 'model', 'trigger', 'light'… */
    readonly type: string
    /** Rotación en grados [x, y, z]. Asignar gira el nodo al instante. */
    rotation: Vec3
    /** Escala [x, y, z] del nodo. */
    readonly scale: Vec3
    /** Posición en el mundo (position es la local si el nodo está dentro de un grupo). */
    readonly worldPosition: Vec3
    /** Dirección frontal mundial normalizada (-Z local), incluida la rotación de padres. */
    readonly worldForward: Vec3
    /** Distancia en metros entre el nodo y el jugador. */
    readonly distance: number
  }

  /** Handle del nodo dueño de un recurso de tipo Nodo, no disponible en scripts globales. */
  /** API física exclusiva del Script de Nodo adjunto a CharacterBody3D.
   * Son consultas y comandos del cuerpo Jolt real, no variables del script. */
  interface CharacterBody3DNodeScriptHandle extends NodeScriptHandle {
    /** Velocidad física [x, y, z] en m/s. La asignación solicita el cambio a Jolt. */
    velocity: Vec3
    /** Clasificación del contacto inferior por el runtime físico. */
    readonly ground: 'stable' | 'steep' | 'air'
    /** Indica contacto con el suelo en el último paso físico. */
    readonly onFloor: boolean
    /** Indica contacto con una pared en el último paso físico. */
    readonly onWall: boolean
    /** Indica contacto con el techo en el último paso físico. */
    readonly onCeiling: boolean
  }

  interface NodeScriptHandle extends NodeHandle {
    /** Publica un método de esta instancia para otros Scripts de Nodo. No expone variables privadas. */
    expose(name: string, fn: (...args: any[]) => unknown): void
    /** Declara una señal propia de esta instancia de Script de Nodo. */
    define_signal(name: string): void
    /** Emite una señal declarada de este nodo a sus receptores activos. */
    emit_signal(name: string, ...args: any[]): void
  }

  interface EventHandle {
    /** Identificador del evento. */
    readonly id: string
    /** Nombre del evento. */
    readonly name: string
    /** Objeto asociado al evento. */
    readonly node: any
    /** Posición XYZ del evento. */
    readonly position: Vec3
    /** Hace desaparecer este evento hasta recargar la escena. */
    erase(): void
    /**
     * Ejecuta los comandos de la página activa (o de `page`, desde 1, aunque no cumpla sus condiciones) en segundo plano, sin bloquear al jugador.
     * La promesa vale true al terminar y false si se detuvo o no hay página. Si esa página ya corre, devuelve la misma promesa.
     */
    run(opts?: { page?: number }): Promise<boolean>
    /** Detiene lo que está ejecutando el evento; devuelve cuántas ejecuciones paró. */
    stop(): number
    /** Indica si hay una ejecución activa del evento. */
    readonly isRunning: boolean
    /** Número (desde 1) de la página activa; 0 si ninguna. */
    readonly page: number
    /** Cantidad de páginas del evento. */
    readonly pages: number
    /** ¿Está este evento en la mano (view model)? */
    readonly held: boolean
    /** Lee el auto-interruptor A, B, C o D de este evento. */
    selfSwitch(ch: 'A' | 'B' | 'C' | 'D'): boolean
    /** Asigna el auto-interruptor A, B, C o D de este evento. */
    setSelfSwitch(ch: 'A' | 'B' | 'C' | 'D', value?: boolean): void
  }

  /** Cualquier cosa que identifique un nodo o un evento: su nombre, su id o el handle de game.node()/game.event()/event. */
  type NodeLike = Ref<'nodes'> | { id: string } | { name: string }

  /** Jugador nativo de la escena. Algunas declaraciones históricas del FPS anterior no están disponibles en el jugador actual; no usar jumpNow, airTime, groundTime, inWater, swimming, underwater, waterDepth, waterLevel, water, current, breath, verticalSpeed ni camera. */
  interface Player {
    /** CharacterBody3D nativo de la escena (ausente en el FPS heredado). */
    readonly node?: NodeScriptHandle
    /** Velocidad física XYZ del personaje nativo (m/s); no existe en el FPS heredado. */
    velocity?: Vec3
    x: number
    y: number
    z: number
    /** [x, y, z] de los pies. Asignar teletransporta. */
    position: Vec3
    /** Hacia dónde mira, en grados. */
    yaw: number
    /** Nombre del personaje de Base de datos ▸ Jugador ▸ Personaje (null si no hay). */
    readonly name: string | null
    /** Registro del personaje del jugador (null si no hay). */
    readonly actor: Record<string, any> | null
    /** Superficie que pisa ahora: 'stone', 'dirt', 'grass'… ('' si no hay suelo). */
    readonly surface: string
    control: boolean
    /** Qué hace el jugador ahora: 'free' | 'locked' | 'frozen' | 'face'. */
    readonly mode: 'free' | 'locked' | 'frozen' | 'face'
    /** Caminar (m/s). Valor inicial: Base de datos ▸ Jugador. */
    walk: number
    /** Correr (m/s). */
    run: number
    jump: number
    gravity: number
    fov: number
    sensitivity: number
    /** Altura del cuerpo (m). Cambiarla rehace la cápsula: game.player.height = 1.0 para agacharse. */
    height: number
    radius: number
    /** Altura de los ojos (m). Nunca por encima de la altura del cuerpo. */
    eyeHeight: number
    stepHeight: number
    /** Posición de los ojos (la cámara) en el mundo. */
    readonly eye: Vec3
    /** Hacia dónde mira la cámara (vector unitario). */
    readonly forward: Vec3
    /** Inclinación de la cámara en grados (+ mira hacia arriba, − hacia abajo). */
    readonly pitch: number
    /** ¿Está pisando el suelo? (estable o empinado) */
    readonly grounded: boolean
    /** Suelo estable: pendiente dentro del límite. false = en el aire o resbalando por una pendiente empinada. */
    readonly stable: boolean
    /** 'stable' | 'steep' (más empinado que la pendiente máxima) | 'air'. */
    readonly ground: 'stable' | 'steep' | 'air'
    /** ¿Está agachado? */
    readonly crouching: boolean
    /** Velocidad horizontal respecto al suelo (m/s). */
    readonly speed: number
    /** Segundos desde que dejó el suelo (0 si lo pisa). */
    readonly airTime: number
    /** Segundos que lleva pisando el suelo (0 en el aire). */
    readonly groundTime: number
    /** Agua: ¿hay agua sobre sus pies? / ¿nada? / ¿tiene la cabeza bajo la superficie? */
    readonly inWater: boolean
    readonly swimming: boolean
    readonly underwater: boolean
    /** Profundidad del agua sobre los pies (m; 0 si no hay) y altura de la superficie con olas (null si no está en el agua). */
    readonly waterDepth: number
    readonly waterLevel: number | null
    /** Nombre del objeto Agua en el que está ('' si ninguno) y la corriente [x, z] en m/s que lo empuja. */
    readonly water: string
    readonly current: [number, number]
    /** Aire bajo el agua: 1 = lleno, 0 = sin aire. Se puede asignar. */
    breath: number
    /** Salta ahora, como pulsar «jump» (respeta saltos extra y reglas del nivel). */
    jumpNow(): void
    /** Se agacha (true) o se levanta (false). Si no cabe de pie, sigue agachado. */
    crouch(on?: boolean): void
    /** Aceleración / frenado en suelo estable (m/s²). */
    groundAccel: number
    groundDecel: number
    /** Multiplica la aceleración al cambiar de dirección (×1 a 0° … este valor a 180°). */
    turnBoost: number
    slideAccel: number
    slideDecel: number
    airAccel: number
    airDecel: number
    /** Pendiente máxima caminable (grados). */
    slopeLimit: number
    jumpOnSteep: boolean
    /** Con jumpAuto, gravedad y velocidad de salto salen de jumpHeight y jumpTime. */
    jumpAuto: boolean
    jumpHeight: number
    jumpTime: number
    fallGravity: number
    terminalSpeed: number
    /** Tiempo de gracia para saltar tras dejar el suelo (s). */
    coyote: number
    /** Si pulsas saltar tan poco antes de aterrizar (s), se salta al tocar el suelo. */
    jumpBuffer: number
    /** Saltos extra en el aire (1 = doble salto). */
    airJumps: number
    jumpCutEnabled: boolean
    jumpCut: number
    jumpCutMin: number
    jumpCutMax: number
    crouchEnabled: boolean
    crouchToggle: boolean
    crouchAir: boolean
    crouchHeight: number
    crouchSpeed: number
    crouchLerp: number
    inheritGround: boolean
    inheritMin: number
    inheritMult: number
    /** Agua (Base de datos ▸ Jugador ▸ Agua). */
    swimEnabled: boolean
    wadeDepth: number
    wadeSlow: number
    swimDepth: number
    swimSpeed: number
    swimRun: number
    swimAccel: number
    swimDrag: number
    diveEnabled: boolean
    diveSpeed: number
    swimUp: number
    buoyancy: number
    swimEyeAbove: number
    swimExitJump: number
    currentPush: number
    breathTime: number
    uwEffect: boolean
    uwDensity: number
    uwMuffle: number
    /** El color bajo el agua se oscurece con la luz de la escena (noche, tormenta, poca luz ambiente). */
    uwLight: boolean
    /** Salpicaduras (gotas) y ondas al caer, nadar o vadear. */
    waterFx: boolean
    /** Velocidad vertical en m/s (+ sube, − cae). */
    readonly verticalSpeed: number
    /** Cámara de Three.js del jugador (avanzado). */
    readonly camera: any
    /**
     * Lo que el jugador tiene delante: un rayo desde sus ojos hacia donde mira. `distance` = alcance en metros (3 por defecto).
     * Acepta el mismo filtro que game.raycast. Devuelve null si no hay nada dentro del alcance.
     * @example
     * // «¿hay algo usable delante?» (layer «Interactuable»)
     * game.on("update", () => {
     *   const hit = game.player.look({ distance: 2.5, layers: "Interactuable" })
     *   game.ui.canvas("Mirilla")?.[hit ? "show" : "hide"]()
     * })
     */
    look(opts?: RayOptions & { distance?: number }): Hit | null
  }

  interface ViewModelOptions {
    /** Slot de destino (id de Base de datos ▸ Jugador). Por defecto «right». */
    slot?: Ref<'slots'>
    /** Ajuste de posición respecto al slot (m). */
    pos?: Vec3
    /** Ajuste de rotación respecto al slot (°). */
    rot?: Vec3
    /** Multiplica el tamaño del objeto. */
    scale?: number
    /** Duración de la transición; por defecto 0.25. */
    seconds?: number
  }

  interface ViewModelSlot extends Animatable {
    readonly id: string
    readonly label: string
    /** Anclaje Three.js (avanzado). */
    readonly object3D: any
    position: Vec3
    /** En grados. */
    rotation: Vec3
    scale: number
    /** Ids de los nodos que hay ahora en este slot. */
    readonly items: string[]
    /** Lleva un nodo a este slot. Sin objetivo: el evento en curso. */
    attach(target?: NodeLike, opts?: Omit<ViewModelOptions, 'slot'>): Promise<void>
    /** Suelta todo lo que haya en el slot. */
    clear(): Promise<void[]>
  }

  interface ViewModel {
    /** Muestra u oculta todo el view model (por ejemplo durante una conversación). */
    visible: boolean
    /** Ids de los slots. */
    readonly slots: string[]
    /** Nodos que hay en el view model ahora. */
    readonly held: { id: string; name: string; slot: string }[]
    /** Un slot de Base de datos ▸ Jugador: game.viewModel.slot("left"). */
    slot(key: Ref<'slots'>): ViewModelSlot
    /** Lleva un nodo —un evento, un trigger, un modelo— al view model. Sin objetivo: el evento que ejecuta el código. Equivale al comando «Mover al view model». */
    attach(target?: NodeLike, opts?: ViewModelOptions): Promise<void>
    /** Devuelve un nodo al mundo: `at` = posición; sin `at`, delante del jugador en el suelo. Sin objetivo: el evento en curso. */
    release(target?: NodeLike, opts?: { at?: Vec3; seconds?: number; upright?: boolean }): Promise<void>
    /** Lanza un nodo de la mano hacia donde miras (`speed` en m/s): gira, rebota y queda en el suelo. Se resuelve al detenerse. */
    throw(target?: NodeLike, opts?: { speed?: number; up?: number }): Promise<void>
    /** Fuerza acumulada (0..1) mientras mantienes la acción «drop» con algo en la mano: úsala para una barra de carga en un Canvas. */
    readonly throwCharge: number
    /** Activa o desactiva soltar/tirar con la acción «drop» (toque corto = soltar, mantener = tirar). */
    dropEnabled: boolean
    /**
     * Quita un nodo de la mano (o del mundo) y lo esconde sin destruirlo: sin colisiones ni eventos. Devuelve `{ id, name }` —sirve para guardarlo en
     * una variable, por ejemplo `game.variables.set('Item', game.viewModel.stash())`— o `null` si no había nada. Sin objetivo: lo último del slot (`right` por defecto).
     */
    stash(target?: NodeLike, opts?: { slot?: Ref<'slots'> }): { id: string; name: string } | null
    /** Devuelve un objeto guardado, a la mano (`to: 'hand'`, por defecto) o al mundo (`to: 'world'`, en `at` o delante del jugador). `false` si no estaba guardado. */
    unstash(target: NodeLike | 0 | null | undefined, opts?: { to?: 'hand' | 'world'; slot?: Ref<'slots'>; at?: Vec3; pos?: Vec3; rot?: Vec3; scale?: number; seconds?: number }): Promise<boolean>
    isStashed(target: NodeLike): boolean
    /** Objetos guardados ahora. */
    readonly stashed: { id: string; name: string }[]
    /** Suelta todo lo del slot indicado (o de todo el view model). */
    clear(slot?: Ref<'slots'>): Promise<void[]>
    /** ¿Está el nodo en la mano? Con `slot`, en ese slot concreto. Sin objetivo: el evento en curso. */
    isHeld(target?: NodeLike, slot?: Ref<'slots'>): boolean
    /** ¿Está vacío el slot (o, sin slot, todo el view model)? */
    isEmpty(slot?: Ref<'slots'>): boolean
    /** Qué hay en un slot. */
    heldIn(slot: Ref<'slots'>): { id: string; name: string }[]
  }

  interface Battler {
    readonly id: number
    name: string
    nickname: string
    level: number
    exp: number
    hp: number
    mp: number
    readonly mhp: number
    readonly mmp: number
    readonly atk: number
    readonly def: number
    readonly mat: number
    readonly mdf: number
    readonly agi: number
    readonly luk: number
    readonly skills: number[]
    readonly states: number[]
    readonly alive: boolean
  }

  interface Party {
    gold: number
    /** Ids de los personajes del grupo. */
    members: number[]
    /** Cantidad que tiene el grupo: game.party.count("items", "Poción"). */
    count(kind: 'items' | 'weapons' | 'armors', x: Ref<'items' | 'weapons' | 'armors'>): number
    has(kind: 'items' | 'weapons' | 'armors', x: Ref<'items' | 'weapons' | 'armors'>, n?: number): boolean
    /** Da (n > 0) o quita (n < 0) objetos, armas o armaduras: game.party.gain("items", "Poción", 2). */
    gain(kind: 'items' | 'weapons' | 'armors', x: Ref<'items' | 'weapons' | 'armors'>, n?: number): number
    /** Fija la cantidad exacta (0 = lo quita del inventario). Devuelve la cantidad resultante. */
    set(kind: 'items' | 'weapons' | 'armors', x: Ref<'items' | 'weapons' | 'armors'>, n: number): number
    /** Quita todo lo de ese tipo (o todo el inventario sin argumento). */
    clearInventory(kind?: 'items' | 'weapons' | 'armors'): void
    /** El inventario como lista: [{ kind, id, name, count }]. */
    list(kind?: 'items' | 'weapons' | 'armors'): { kind: string; id: number; name: string; count: number }[]
    addGold(n: number): number
    join(actor: Ref<'actors'>): Battler
    leave(actor: Ref<'actors'>): void
    /** {enemy:id} sigue apuntando a la instancia predeterminada del tipo. */
    battler(actor: Ref<'actors'> | { enemy: Ref<'enemies'> } | { enemyInstance: string }): Battler
    enemy(x: Ref<'enemies'>): Battler & { readonly instanceId: string }
    /** Crea un enemigo independiente y devuelve su referencia de instancia. */
    spawnEnemy(x: Ref<'enemies'>): Battler & { readonly instanceId: string }
    enemyInstance(instanceId: string): Battler & { readonly instanceId: string }
    removeEnemy(instanceId: string): boolean
    setLevel(actor: Ref<'actors'>, level: number): any
    gainExp(actor: Ref<'actors'>, n: number): any
    equip(actor: Ref<'actors'>, slot: number, item: Ref<'weapons' | 'armors'> | 0): void
    /** Ejecuta la habilidad configurada en el arma equipada; no requiere que el personaje la aprenda aparte. */
    weaponAction(actor: Ref<'actors'>, target?: Ref<'actors'> | { enemy: Ref<'enemies'> } | { enemyInstance: string }): any
    addState(actor: Ref<'actors'>, state: Ref<'states'>, chance?: number): void
    removeState(actor: Ref<'actors'>, state: Ref<'states'>): void
    /** Un paso lógico explícito. Sin argumento procesa el grupo; acepta instancia enemiga. */
    tick(target?: Ref<'actors'> | { enemy: Ref<'enemies'> } | { enemyInstance: string }): [string, number][]
    recoverAll(): void
    /** El contexto predeterminado es event para conservar los scripts existentes. */
    useItem(item: Ref<'items'>, target?: Ref<'actors'> | { enemy: Ref<'enemies'> } | { enemyInstance: string }, user?: Ref<'actors'> | null, context?: 'event' | 'menu'): any
    /** Ejecuta una vez los eventos comunes declarados en un resultado de uso válido. */
    runEvents(result: { events?: number[] }): Promise<void>
    useSkill(skill: Ref<'skills'>, user: Ref<'actors'>, target?: Ref<'actors'> | { enemy: Ref<'enemies'> } | { enemyInstance: string }): any
    /** Texto de un término del sistema (Base de datos ▸ Sistema ▸ Términos), p. ej. game.party.term("gold"). Si no existe devuelve la clave. */
    term(key: string): string
    quest(x: Ref<'quests'>): { id: number; name: string; status: 'none' | 'active' | 'done' | 'failed'; done: number[]; total: number }
    setQuest(x: Ref<'quests'>, action: 'start' | 'objective' | 'complete' | 'fail' | 'reset', objective?: number): any
    collect(doc: Ref<'lore'>, on?: boolean): void
  }

  type WeatherId = 'clear' | 'partly' | 'cloudy' | 'overcast' | 'fog' | 'drizzle' | 'rain' | 'storm' | 'snow'
  interface ClockApi {
    /** Hora del día, 0–24 (12 = mediodía). Escribirla la cambia al instante. */
    hour: number
    /** La hora como texto, «14:30». */
    readonly text: string
    /** Pasa a esa hora; con `seconds` el reloj avanza hasta ella (el sol siempre avanza, no retrocede). */
    set(hour: number, seconds?: number): void
    /** Hace que el tiempo transcurra (`dayMinutes` = minutos reales por día) o lo detiene. */
    flow(on?: boolean, dayMinutes?: number): void
    readonly running: boolean
    readonly isNight: boolean
    /** Altura del sol sobre el horizonte, en grados (negativa = bajo el horizonte). */
    readonly sunElevation: number
    /** Elige la fecha: día del año (1–366; 172 = 21 de junio) y año (1800–2050). Activa la astronomía real: sol, luna con fases, planetas y estrellas de ese día. */
    setDate(day: number, year?: number): void
    /** Día del año actual (1–366); con «El tiempo transcurre» avanza al pasar la medianoche. */
    readonly day: number
    readonly year: number
    /** La luna: iluminación 0 (nueva) – 1 (llena), nombre de la fase («Cuarto creciente»…), si crece, y su posición (°). Sin astronomía real: siempre «Luna llena». */
    readonly moon: { illumination: number; name: string; waxing: boolean; elevation: number; azimuth: number }
    /** Mercurio, Venus, Marte, Júpiter y Saturno: altura y azimut (°, desde el norte hacia el este) y magnitud. Vacío sin astronomía real. */
    readonly planets: { name: string; elevation: number; azimuth: number; magnitude: number }[]
  }
  interface WeatherApi {
    /** Cambia el tiempo; con `seconds` la transición es gradual. Devuelve false si el tiempo no existe. */
    set(id: WeatherId, intensity?: number, seconds?: number): boolean
    readonly preset: WeatherId
    readonly intensity: number
    readonly list: WeatherId[]
    /** Viento ahora mismo: velocidad (m/s), dirección (°, hacia donde sopla) y componentes x, z. */
    readonly wind: { speed: number; dir: number; x: number; z: number }
    /**
     * Viento local en el punto (x, z) tras aplicar los obstáculos del viento registrados (Bloque F).
     * `factor` 0–2 (1 = libre). Sin obstáculos registrados devuelve el viento global con `factor: 1`.
     */
    windAt(x: number, z: number): { speed: number; dir: number; x: number; z: number; factor: number }
    /** Escala de Beaufort: [0–12, nombre]. */
    readonly beaufort: [number, string]
    readonly raining: boolean
    readonly snowing: boolean
    readonly foggy: boolean
    /** Visibilidad horizontal en metros a nivel del suelo (ley de Koschmieder V = 3,912/β). `Infinity` sin niebla. Con «Niebla: Física» cuenta la humedad y la altura. */
    readonly visibility: number
    /** Visibilidad horizontal (m) a la altura `y` (metros): con niebla física crece al subir, con la simple es la misma. */
    visibilityAt(y?: number): number
    /** Temperatura del aire (°C): la base de la escena, el desvío del tiempo (lluvia, niebla, nieve…) y el ciclo del día (máxima a las 15 h). */
    readonly temperature: number
    /** Humedad relativa 0–1 (con «Humedad y niebla realistas» sube de noche, cuando el aire se enfría). */
    readonly humidity: number
    /** Precipitación en mm/h donde está el jugador (lluvia a pleno = 45; la nieve cuenta como agua equivalente). Con «Tipo de nubes: por celdas» es la que cae bajo la nube de ahí: puede ser 0 a un kilómetro de una tormenta. */
    readonly precipitation: number
    /** Modelo de nubes de la escena: `classic` (ruido global, el tiempo es igual en todas partes) o `cells` (campo de celdas de Frost: hay nubes, huecos y tormentas localizadas). */
    readonly cloudModel: 'classic' | 'cells'
    /** Cielo cubierto 0–1 sobre el jugador. Con `cells` es el medido (profundidad óptica de las nubes sobre su cabeza); con `classic` la cobertura del tiempo. */
    readonly cloudCoverage: number
    /** Fracción de sol directo que llega al jugador, 0–1. Con `cells`, exp(−τ) a lo largo del rayo hacia el sol (una nube delante la baja); con `classic`, el factor del tiempo. */
    readonly sunTransmission: number
    /** Precipitación (mm/h) en el punto (x, z) del mundo. Con `cells`, la de la nube que haya allí (huella desplazada por el viento); con `classic`, la misma en todas partes. */
    precipitationAt(x: number, z: number): number
    /** Cumulonimbo apto para rayos más cercano al jugador (hasta `maxDistance` m, 8000 por defecto): distancia y rumbo (° desde el norte hacia el este). `null` si no hay (y siempre con `classic`). */
    nearestStorm(maxDistance?: number): { distance: number; bearing: number } | null
    /** ¿El director de clima está cambiando el tiempo solo? */
    readonly autoChange: boolean
    /** Activa (`true`), apaga (`false`) o devuelve al ajuste del inspector (`null`) el director de clima. */
    auto(on?: boolean | null): void
    /** Pasa ya al siguiente tiempo que elegiría el director (con `seconds` de transición). Devuelve su id. */
    next(seconds?: number): WeatherId | null
    /** Lanza un rayo: destello y, tras distance/343 s, el trueno (eventos `lightning` y `thunder`, y su sonido). distance en metros (30–8000). */
    strike(opts?: number | { distance?: number; bearing?: number }): { distance: number; delay: number } | null
    /** Silencia (true) o devuelve (false) los sonidos del clima: lluvia, viento y truenos. */
    muteSounds(on?: boolean): void
    readonly soundsMuted: boolean
    /** Región acústica donde está el oyente (`open`, `forest`, `valley`, `city`, `interior`): la de Escena ▸ Clima ▸ Regiones acústicas o la de por defecto. */
    readonly thunderRegion: string
    /** Oclusión actual del sonido del clima (0 al aire libre – 0,92 tapado por techos y paredes), ya suavizada. Solo la usa el trueno procedural. */
    readonly occlusion: number
    /** Fuerza la oclusión (0–1) desde un script, p. ej. al cerrar una puerta; `null` vuelve a la automática (rayos de sonido). */
    setOcclusion(value: number | null): void
  }
  interface TimelineCameraExitPolicy {
    /** Destino de la cámara al terminar la secuencia. */
    to: 'keep' | 'camera3d' | 'previous' | 'player' | 'pose' | 'base'
    /** Requeridos para to:'camera3d'. */
    sceneId?: string
    /** Identificador de la cámara cuando el destino es Camera3D. */
    cameraId?: string
  }
  interface TimelineCameraExit {
    /** Política cuando la secuencia termina normalmente. */
    natural?: TimelineCameraExitPolicy
    /** Política cuando se detiene. */
    stop?: TimelineCameraExitPolicy
    /** Política cuando se omite. */
    skip?: TimelineCameraExitPolicy
    /** Política cuando otra operación interrumpe la secuencia. */
    interrupted?: TimelineCameraExitPolicy
  }
  interface TimelineApi {
    /** El nuevo recurso conserva fuente viva por defecto; los recursos existentes sin política no cambian. */
    play(name: Ref<'timelines'>, opts?: { speed?: number; from?: number; lock?: boolean; skippable?: boolean; cameraExit?: TimelineCameraExit }): Promise<{ stopped?: boolean; skipped?: boolean }>
    /** Detiene la secuencia indicada o la activa según el contexto. */
    stop(name?: Ref<'timelines'>): boolean
    /** Solicita omitir la secuencia. */
    skip(name?: Ref<'timelines'>): boolean
    /** Pausa la secuencia. */
    pause(name?: Ref<'timelines'>): boolean
    /** Reanuda la secuencia pausada. */
    resume(name?: Ref<'timelines'>): boolean
    /** Cambia la posición temporal de la secuencia. */
    seek(name: Ref<'timelines'>, t: number): boolean
    /** Cambia la velocidad de reproducción de la secuencia. */
    speed(name: Ref<'timelines'>, v: number): boolean
    /** Consulta si la secuencia está reproduciéndose. */
    isPlaying(name: Ref<'timelines'>): boolean
    /** Consulta información de la secuencia indicada. */
    info(name: Ref<'timelines'>): any
    /** Nombres de las secuencias disponibles. */
    list(): string[]
  }

  interface NavApi {
    /** ¿Hay un mapa de navegación horneado en la escena? */
    readonly ready: boolean
    /** Busca una ruta entre dos posiciones; null si no puede resolverla. */
    path(from: Vec3, to: Vec3, opts?: { smooth?: boolean; allowPartial?: boolean }): Vec3[] | null
    /** Busca un punto navegable cercano; null si no encuentra uno. */
    nearest(p: Vec3, max?: number): Vec3 | null
    /** Busca un punto navegable aleatorio alrededor del centro indicado. */
    randomPoint(center: Vec3, radius?: number): Vec3 | null
    /** Consulta si puede recorrer el tramo entre las dos posiciones. */
    canWalk(a: Vec3, b: Vec3): boolean
  }

  /** Una fuente de audio de la escena (nodo Fuente de audio): game.audio.source("Radio"). */
  interface AudioSourceHandle {
    readonly name: string
    readonly playing: boolean
    play(): Promise<void>
    stop(fade?: number): void
    pause(): void
    resume(): void
    /** 0–2 */
    volume: number
    pitch: number
    mute: boolean
    /** Solo escritura. */
    loop: boolean
    readonly done: Promise<void>
  }

  type AudioEffectName = 'eq3' | 'lowpass' | 'highpass' | 'compressor' | 'limiter' | 'reverb' | 'echo' | 'distortion'

  interface AudioHandle {
    readonly playing: boolean
    stop(fade?: number): void
    pause(): void
    resume(): void
    setVolume(v: number): void
    setPitch(v: number): void
    setPosition(pos: Vec3): void
    readonly done: Promise<void>
  }

  interface AudioApi {
    /** game.audio.play("explosion", { group: "sfx", volume: 1, pitch: 1, loop: false, at: [x, y, z] | node: "Puerta" }) */
    play(clip: Ref<'clips'>, opts?: { group?: Ref<'groups'>; volume?: number; pitch?: number; loop?: boolean; delay?: number; at?: Vec3; node?: NodeLike; ui?: boolean; minDistance?: number; maxDistance?: number; rolloff?: number }): AudioHandle
    /**
     * Sonido de interfaz (2D) por el grupo «UI» del mezclador: así su volumen se controla aparte del resto.
     * @example game.audio.ui("clic")  ·  game.audio.setVolume("ui", 0.5)
     */
    ui(clip: Ref<'clips'>, opts?: { group?: Ref<'groups'>; volume?: number; pitch?: number; loop?: boolean; delay?: number }): AudioHandle
    /** Una fuente de audio de la escena (nodo Fuente de audio) por nombre o id; undefined si no existe. */
    source(name: NodeLike): AudioSourceHandle | undefined
    /** Detiene todo el audio, o solo el de un grupo. */
    stopAll(group?: Ref<'groups'>, fade?: number): void
    /** Pausa (o reanuda con false) todo el audio. */
    pauseAll(on?: boolean): void
    /** Nombres de los grupos del mezclador. */
    groups(): string[]
    /** Volumen lineal 0–1 de un grupo (1 = el del mezclador). Se recuerda entre partidas salvo `save: false`. */
    setVolume(group: Ref<'groups'>, v: number, opts?: { save?: boolean }): void
    getVolume(group: Ref<'groups'>): number
    /** Silencia (o reactiva con false) un grupo. */
    mute(group: Ref<'groups'>, on?: boolean): void
    /** Lleva el volumen de un grupo a `to` (0–1) en `seconds`. */
    fade(group: Ref<'groups'>, to?: number, seconds?: number): Promise<void>
    /** Activa un efecto en un grupo (o lo añade si no existe): game.audio.effect("sfx", "lowpass", { freq: 800 }). */
    effect(group: Ref<'groups'>, name: AudioEffectName, params?: Record<string, number>): void
    effectOff(group: Ref<'groups'>, name: AudioEffectName): void
    /** Transición a un snapshot del mezclador. */
    snapshot(name: string, seconds?: number): Promise<void>
    /** Nombres de los snapshots del proyecto. */
    snapshots(): string[]
  }

  interface UiApi {
    /** Abre una interfaz del proyecto; la promesa se resuelve con lo que pase close(resultado). */
    open(name: Ref<'uis'>, props?: object, opts?: { modal?: boolean; layer?: string }): Promise<any>
    /** Cierra la interfaz y entrega el resultado a quien espera open(). */
    close(name: Ref<'uis'>, result?: any): void
    /** Alterna la apertura de la interfaz indicada. */
    toggle(name: Ref<'uis'>, props?: object, opts?: { modal?: boolean; layer?: string }): Promise<any>
    /** Comprueba si la interfaz está abierta. */
    isOpen(name: Ref<'uis'>): boolean
    /** Nodos Canvas (cada uno dibuja su recurso .ui). Se identifican por el nombre del nodo. */
    showCanvas(name: string): boolean
    /** Oculta el Canvas por nombre. */
    hideCanvas(name: string): boolean
    /** Alterna la visibilidad del Canvas por nombre. */
    toggleCanvas(name: string): boolean
    /** Consulta la visibilidad del Canvas por nombre. */
    isCanvasVisible(name: string): boolean
    /** Manejador del Canvas: `visible`, show(), hide(), toggle(). Null si no existe. */
    canvas(name: string): CanvasHandle | null
    /** Cierra todas las interfaces abiertas con open(). */
    closeAll(): void
    /** Acciones del sistema para las pantallas por defecto: avanzar el diálogo, elegir la opción `i`, reanudar la partida (pausa) y salir. */
    next(): void
    /** Selecciona la opción por índice en la interfaz de opciones. */
    pick(index: number): void
    /** Reanuda la partida desde la pantalla de pausa. */
    resume(): void
    /** Solicita salir de la partida. */
    quit(): void
  }
  interface CanvasHandle {
    /** Nombre del nodo Canvas. */
    readonly name: string
    /** Visibilidad del Canvas. */
    visible: boolean
    /** Muestra el Canvas. */
    show(): boolean
    /** Oculta el Canvas. */
    hide(): boolean
    /** Alterna la visibilidad del Canvas. */
    toggle(): boolean
  }

  /** Paso de una ruta de movimiento: ["forward", 2] · "turnPlayer" · { c: "wait", p: { seconds: 1 } } */
  type RouteStep = string | [string, ...any[]] | { c: string; p?: object }

  interface VariablesApi {
    /** Devuelve el valor de una variable por nombre o número. */
    get(x: Ref<'variables'>): any
    /** Asigna el valor y devuelve el valor almacenado. */
    set(x: Ref<'variables'>, value: any): any
    /** Suma `n` (o concatena texto / añade a la lista). */
    add(x: Ref<'variables'>, n?: any): any
    /** Nombre en la base de datos de la variable `id`. */
    name(id: number): string
    /** Id de la variable por su nombre (0 si no existe). */
    id(name: string): number
    /** Nombres de la base de datos (índice 0 = variable 1). */
    readonly names: string[]
    /** Todas las variables con valor: { id: valor }. */
    all(): Record<string, any>
    /** Todas las variables vuelven a 0. */
    reset(): void
    /** Operaciones de lista (una variable que no es lista empieza como lista vacía). */
    push(x: Ref<'variables'>, value: any): number
    /** Retira y devuelve el último elemento; 0 si la lista está vacía. */
    pop(x: Ref<'variables'>): any
    /** Retira y devuelve el primer elemento; 0 si la lista está vacía. */
    shift(x: Ref<'variables'>): any
    /** Inserta al principio y devuelve la longitud resultante. */
    unshift(x: Ref<'variables'>, value: any): number
    /** Inserta en el índice indicado (acotado a la lista); devuelve la longitud. */
    insert(x: Ref<'variables'>, index: number, value: any): number
    /** Retira y devuelve el elemento del índice; 0 si no existe. */
    removeAt(x: Ref<'variables'>, index: number): any
    /** Quita la primera aparición del valor; true si estaba. */
    remove(x: Ref<'variables'>, value: any): boolean
    /** Lee el elemento del índice, comenzando en 0; devuelve 0 si no existe. */
    at(x: Ref<'variables'>, index: number): any
    /** Asigna un índice desde 0, rellenando huecos con ceros; devuelve la longitud. */
    setAt(x: Ref<'variables'>, index: number, value: any): number
    /** Cantidad de elementos de la lista. */
    length(x: Ref<'variables'>): number
    /** Vacía la lista. */
    clear(x: Ref<'variables'>): void
    /** Comprueba si contiene el valor mediante comparación de contenido JSON. */
    includes(x: Ref<'variables'>, value: any): boolean
    /** Índice desde 0 de la primera coincidencia por contenido; -1 si no existe. */
    indexOf(x: Ref<'variables'>, value: any): number
    /** Mezcla los elementos de la lista al azar. */
    shuffle(x: Ref<'variables'>): void
    /** Ordena números por valor y otros elementos por su representación textual. */
    sort(x: Ref<'variables'>): void
    /** Invierte el orden de la lista. */
    reverse(x: Ref<'variables'>): void
    /** Une las representaciones textuales; el separador por defecto es coma y espacio. */
    join(x: Ref<'variables'>, separator?: string): string
    /** Suma los elementos convertidos a números. */
    sum(x: Ref<'variables'>): number
    /** Mínimo numérico; 0 si la lista está vacía. */
    min(x: Ref<'variables'>): number
    /** Máximo numérico; 0 si la lista está vacía. */
    max(x: Ref<'variables'>): number
    /** Devuelve un elemento al azar; 0 si la lista está vacía. */
    random(x: Ref<'variables'>): any
  }
  interface SaveInfo {
    /** Número de ranura. */
    slot: number
    /** Autoguardado (ranura 0). */
    auto: boolean
    /** true si la ranura no tiene partida (el resto de campos no existen). */
    empty?: boolean
    /** Nombre asignado a la partida. */
    name?: string
    /** ISO 8601. */
    date?: string
    /** Segundos jugados. */
    playtime?: number
    /** Escena registrada en la partida. */
    scene?: string
    /** Nivel registrado en la partida. */
    level?: string
    /** Oro del grupo al guardar. */
    gold?: number
    /** Nombres de los miembros del grupo. */
    party?: string[]
    [extra: string]: any
  }
  interface SaveApi {
    /** Número de ranuras (1..N; la 0 es el autoguardado). Se configura en Base de datos ▸ Jugador. */
    readonly slots: number
    /** Última ranura guardada o cargada (0 = ninguna). */
    readonly lastSlot: number
    /** Permite o bloquea guardar (el autoguardado siempre puede). */
    canSave: boolean
    /** Indica que hay una operación de guardado o carga en curso. */
    readonly busy: boolean
    /** Todas las ranuras (0..N), las vacías con `empty: true`. */
    list(): SaveInfo[]
    /** Consulta los datos de una ranura. */
    info(slot?: number | 'last' | 'auto'): SaveInfo | null
    /** Comprueba si existe una partida en la ranura. */
    exists(slot?: number | 'last' | 'auto'): boolean
    /** Ranura con la partida más reciente, o -1. */
    latest(): number
    /** Guarda interruptores, variables, grupo, inventario, diario, game.state, escena, posición, hora, clima y objetos en las manos. false si está bloqueado. */
    save(slot?: number | 'last' | 'auto', opts?: { name?: string; meta?: Record<string, any> }): Promise<boolean>
    /** Carga la ranura y devuelve al jugador a donde estaba. false si está vacía. */
    load(slot?: number | 'last' | 'auto'): Promise<boolean>
    /** Borra la ranura; true si había algo. */
    delete(slot?: number | 'last' | 'auto'): boolean
    /** Guarda en la ranura de autoguardado. */
    autosave(): Promise<boolean>
  }

  interface LevelApi {
    /** Nombre del nivel actual. */
    readonly name: string
    /** ¿Puede correr? (false: la tecla de correr no hace nada). */
    canRun: boolean
    /** Permite agacharse usando la configuración del jugador. */
    canCrouch: boolean
    /** Permite o restringe el salto en este nivel. */
    canJump: boolean
    /** Multiplica la velocidad del jugador (0–10). */
    speedScale: number
    /** Multiplica la gravedad (0–10). */
    gravityScale: number
    /** ¿Se puede nadar en este nivel? false: en agua profunda camina por el fondo. */
    canSwim: boolean
    /** ¿Se puede bucear? false: nadando se queda en la superficie. */
    canDive: boolean
    /** Multiplica la fuerza de las corrientes (0–3). */
    waterCurrent: number
  }

  /** Muestra del agua en un punto. */
  interface WaterSample {
    /** Altura de la superficie (con olas). */
    surface: number
    /** Corriente (m/s) en x y z. */
    flowX: number
    flowZ: number
    /** Metros hacia dentro desde la orilla (≥ 0 dentro). */
    edge: number
    name: string
    color: string
    deepColor: string
    clarity: number
  }

  interface FloatOptions {
    /** Densidad respecto al agua: < 1 flota (0,6 madera, 0,9 casi a ras), ≥ 1 se hunde (0,6). */
    density?: number
    /** Cuánto lo frena el agua y lo arrastra la corriente, por segundo (1,5; 0,8 en el respaldo sin Jolt). */
    drag?: number
    /** Cuánto se inclina con las olas, 0–1 (1). */
    tilt?: number
    /** Multiplica la corriente que lo arrastra, 0–3 (1). */
    current?: number
    /** Velocidad máxima de hundimiento en m/s si density ≥ 1 (1,2). Solo en el respaldo sin Jolt: con Jolt se hunde por su peso. */
    sink?: number
  }

  interface BodyOptions extends FloatOptions {
    /** Forma de colisión ajustada al objeto: 'box' (se apoya), 'sphere' (rueda) o 'capsule' ('box'). */
    shape?: 'box' | 'sphere' | 'capsule'
    /** Masa en kg. Sin ella: volumen × densidad × 1000. */
    mass?: number
    /** Rozamiento 0–2 (0,6). */
    friction?: number
    /** Rebote 0–1 (0,15). */
    bounce?: number
    /** Velocidad inicial [x, y, z] en m/s. */
    vel?: Vec3
    /** Si es true, además flota (densidad por defecto 0,6 en vez de 1,5). */
    float?: boolean
  }

  /** Un cuerpo dinámico: cae, choca, rueda, se empuja y flota o se hunde en el agua. */
  interface Body {
    /** Identificador del nodo asociado al cuerpo. */
    readonly node: string
    /** Estado de contacto o flotación del cuerpo. */
    readonly state: 'air' | 'floating' | 'sunk' | 'ground'
    /** Indica si el cuerpo está flotando. */
    readonly floating: boolean
    /** Masa del cuerpo en kg. */
    readonly mass: number
    /** Densidad relativa al agua. */
    density: number
    /** [x, y, z] en m/s. */
    readonly velocity: Vec3
    /** Origen del nodo en el mundo. */
    readonly position: Vec3
    /** Golpe seco en N·s (masa × velocidad). `at` = punto del mundo donde se da (hace girar). */
    push(impulse: Vec3, at?: Vec3): void
    /** Asigna la velocidad XYZ del cuerpo en m/s. */
    setVelocity(v: Vec3): void
    /** Cambia la posición mundial del cuerpo. */
    teleport(x: number, y: number, z: number): void
    /** Deja de ser dinámico: el objeto se queda donde está y vuelve a ser un sólido estático. */
    stop(): void
  }

  interface PhysicsApi {
    /** Hace dinámico un nodo (por nombre o nodo). Volver a llamarla cambia sus opciones. */
    body(node: NodeLike, options?: BodyOptions): Body
    /** El cuerpo de un nodo, o null si no es dinámico. */
    get(node: NodeLike): Body | null
    /** Quita lo dinámico a un nodo. */
    release(node: NodeLike): void
    /** Golpe seco (N·s) a un nodo dinámico. */
    impulse(node: NodeLike, impulse: Vec3, at?: Vec3): void
    /** Empuja todo lo dinámico cercano a (x, y, z): `radius` m (6) y `force` m/s para lo pegado a la explosión (8). Devuelve cuántos cuerpos movió. */
    explode(x: number, y: number, z: number, options?: { radius?: number; force?: number }): number
    /** Todos los cuerpos dinámicos de la escena. */
    readonly bodies: Body[]
  }

  /** Un objeto que flota. */
  interface Floater {
    /** Identificador del nodo que flota. */
    readonly node: string
    /** 'air' (cayendo) · 'floating' · 'sunk' (en el fondo) · 'ground' (en tierra). */
    readonly state: 'air' | 'floating' | 'sunk' | 'ground'
    /** Indica si está flotando. */
    readonly floating: boolean
    /** Densidad relativa al agua. */
    density: number
    /** [x, y, z] en m/s. */
    readonly velocity: Vec3
    /** Posición XYZ del objeto. */
    readonly position: Vec3
    /** Deja de flotar (el nodo se queda donde está). */
    stop(): void
  }

  interface SplashOptions {
    /** Fuerza 0–1,5: 0,2 gota suave · 0,6 chapuzón · 1 zambullida. */
    power?: number
    /** Altura de la superficie; sin ella se usa la del agua en ese punto. */
    y?: number
    color?: string
    /** Número de gotas (por defecto según la fuerza; 0 = solo la onda). */
    drops?: number
  }

  /** @deprecated API histórica de agua. La exposición de game.water en el intérprete está pendiente de resolución; no se garantiza disponibilidad. */
  interface WaterApi {
    /** Muestra el agua en (x, z), o null si ahí no hay. */
    at(x: number, z: number): WaterSample | null
    /** Altura de la superficie en (x, z), o null. */
    height(x: number, z: number): number | null
    /** Salpicadura (gotas + onda). Devuelve false si ahí no hay agua (y no se dio `y`). */
    splash(x: number, z: number, opts?: SplashOptions): boolean
    /** Solo una onda; `amp` 0–1,5. */
    ripple(x: number, z: number, amp?: number): void
    /**
     * Hace que un nodo flote: cabecea, se inclina con las olas y la corriente lo arrastra.
     * API histórica: no utilizar desde scripts mientras game.water no esté disponible.
     */
    float(node: NodeLike, opts?: FloatOptions): Floater & Body
    /** Deja de flotar. */
    unfloat(node: NodeLike): void
    /** Los objetos que flotan ahora. */
    readonly floaters: Floater[]
  }

  /** Propiedades de entorno que se pueden cambiar en juego. Con Hora/Clima activos, cielo, luz y niebla los gobierna el mundo (game.clock / game.weather). */
  interface SceneProps {
    /** Color de la parte superior del cielo. */
    skyTop: string
    /** Color del horizonte. */
    skyHorizon: string
    /** Color de la parte inferior del entorno. */
    ground: string
    /** Color de la iluminación ambiente. */
    ambientColor: string
    /** Intensidad de la luz ambiente (0–4). */
    ambient: number
    /** Exposición del cielo. */
    skyExposure: number
    /** Habilita la niebla. */
    fog: boolean
    /** Densidad de la niebla (0–0.2). */
    fogDensity: number
    /** Metros a partir de los cuales empieza la niebla (0 = desde la cámara). */
    fogStart: number
    /** Color de la niebla. */
    fogColor: string
    /** Modelo de niebla: `"simple"` (exponencial uniforme, la de siempre) o `"physical"` (altura analítica, humedad, dispersión del sol, haces de sol y volúmenes atmosféricos). Necesita perfil Medio o Alto; sin él se usa la simple. */
    fogMode: 'simple' | 'physical'
    /** Niebla física: caída de la densidad con la altura en 1/m (0 = automática por humedad: 0,00085 seco … 0,00185 saturado). */
    fogFalloff: number
    /** Niebla física: altura (m) por debajo de la cual la densidad es máxima. */
    fogHeight: number
    /** Niebla física: intensidad de los haces de sol (0–3, 1 = normal, 0 = sin haces). */
    fogShafts: number
    /** Niebla física: cuánta luz del sol dispersa la niebla (0–3, 1 = normal). */
    fogScatter: number
    /** Niebla volumétrica (haces de luz): activada. Requiere perfil Medio o Alto y luces marcadas «Volumétrica». */
    volOn: boolean
    /** Densidad del efecto volumétrico. */
    volDensity: number
    /** Intensidad del efecto volumétrico. */
    volIntensity: number
    /** Ruido 3D animado de la niebla volumétrica (0 = lisa, 1 = bancos muy marcados). */
    volNoise: number
    /** Tamaño de los bancos de niebla (m). */
    volNoiseScale: number
    /** Velocidad a la que el viento los arrastra (m/s). */
    volNoiseSpeed: number
  }

  interface SceneApi extends SceneProps {
    readonly name: string
    /** Nombres de las propiedades editables. */
    readonly props: (keyof SceneProps)[]
    /** Cambia varias a la vez: `game.scene.set({ fog: true, fogDensity: 0.05 })`. Lanza un error con un nombre o valor no válido. */
    set(values: Partial<SceneProps>): void
    /** Vuelve al entorno del proyecto. */
    reset(): void
  }

  /** Prefabs temporales del mundo activo; nunca cambian los recursos guardados. */
  interface RuntimePrefabsApi {
    /** Instancia un recurso de Assets/Prefabs. La posición opcional es mundial. */
    instantiate(prefab: Ref<'prefabs'>, options?: { parent?: NodeLike; position?: Vec3 }): NodeHandle
    /** Destruye solo una instancia dinámica creada durante Play. */
    destroy(instance: NodeLike): boolean
  }

  /** Escenas reutilizables instanciadas en la sesión activa. No cambia de nivel. */
  interface RuntimeScenesApi {
    /** Instancia una escena del paquete Player. Fuentes no referenciadas estáticamente deben estar en Build. Posición mundial. */
    instantiate(scene: Ref<'scenes'>, options?: { parent?: NodeLike; position?: Vec3 }): Promise<NodeHandle>
    /** Destruye únicamente una instancia creada por game.scenes.instantiate(). */
    destroy(instance: NodeLike): boolean
  }

  /** Datos comunes emitidos por el tornado de World. */
  interface TornadoSignal {
    /** Identificador del tornado. */
    id: string
    /** Posición mundial XYZ del tornado. */
    position: Vec3
    /** Radio del tornado en metros. */
    radius: number
    /** Altura del tornado en metros. */
    height: number
    /** Edad del tornado en segundos. */
    age: number
  }

  /** Transición entre fases del tornado. */
  interface TornadoPhaseSignal extends TornadoSignal {
    /** Fase actual del tornado. */
    phase: string
    /** Fase anterior del tornado. */
    previous: string
  }

  /** Entrada o salida del dominio meteorológico. */
  interface TornadoBodySignal extends TornadoSignal {
    /** Identificador del objeto que cruza el dominio del tornado. */
    objectId: string
  }

  interface Game {
    /** Lee un interruptor (por nombre o número). */
    switch(x: Ref<'switches'>): boolean
    /** Asigna un interruptor por nombre o número; true por defecto. */
    setSwitch(x: Ref<'switches'>, value?: boolean): void
    /** Lee una variable (por nombre o número): número, texto, sí/no, lista u objeto (0 si nunca se asignó). */
    variable(x: Ref<'variables'>): any
    /** Asigna cualquier valor JSON (número, texto, boolean, lista u objeto). */
    setVariable(x: Ref<'variables'>, value: any): void
    /** La tabla de variables como en RPG Maker MZ (id 1..N con nombre), con valores de cualquier tipo y operaciones de lista. */
    readonly variables: VariablesApi
    /** Una sola vez: como `on`, pero se desengancha tras la primera señal. */
    once(name: string, fn: (data?: any) => void | Promise<void>): () => void
    /**
     * Emite una señal propia (no vale el nombre de un evento interno del motor). La reciben game.on / game.once / game.waitFor, el comando
     * «Esperar señal» y las páginas de evento con disparador «Al recibir señal». Termina cuando acaban los game.on.
     */
    emit(name: string, data?: any): Promise<void>
    /** Promesa con el dato de la próxima señal `name`; `undefined` si pasan `timeout` segundos (0 = sin límite). */
    waitFor(name: string, timeout?: number): Promise<any>
    /** Guardar y cargar partida: ranuras 1..N y autoguardado (0). */
    readonly save: SaveApi
    /** Auto-interruptor del evento actual (o del indicado). */
    selfSwitch(ch: 'A' | 'B' | 'C' | 'D', ev?: NodeLike): boolean
    /** Asigna el auto-interruptor A, B, C o D del evento actual o del indicado. */
    setSelfSwitch(ch: 'A' | 'B' | 'C' | 'D', value?: boolean, ev?: NodeLike): void
    /** Objeto libre para guardar datos de tus scripts durante la partida. */
    state: Record<string, any>
    /**
     * Muestra un diálogo y espera a que se cierre. Admite códigos de escape (\C[2], \V[1], \N[1], \F[expresión], \FX[temblor] … \FX[0]…) y {t:clave}.
     * `opts.key`: clave de Localización (el texto sale de la tabla en el idioma actual) · `opts.voice`: audio de la voz ·
     * `opts.advance`: al terminar la voz pasa solo (true por defecto) · `opts.group`: grupo del mezclador ('voice') ·
     * `opts.enter` / `opts.exit` / `opts.duration`: animación de entrada y salida (como en el comando; sin ellas, la de la interfaz).
     * @example await game.say('No hay nadie…', '', 'center', { enter: 'fade', exit: 'fade', duration: 0.6 })
     */
    say(text: string, speaker?: string, position?: 'bottom' | 'center' | 'top', opts?: { key?: Ref<'texts'>; voice?: Ref<'clips'>; advance?: boolean; group?: Ref<'groups'> } & DialogAnim): Promise<void>
    /** Idioma actual del juego ('es', 'en'…). Asignarlo cambia el idioma (si existe en Juego ▸ Localización) y se recuerda en el juego exportado. */
    lang: string
    /** Idiomas del proyecto: [{ code: 'es', name: 'Español' }, …]. */
    readonly languages: { code: string; name: string }[]
    /** Cambia el idioma; false si no existe. Avisa con game.on('language'). */
    setLanguage(code: Ref<'languages'>): boolean
    /** Texto de una clave de Localización en el idioma actual (con respaldo en el idioma base). Si la clave no existe devuelve `fallback` o la clave. */
    t(key: Ref<'texts'>, fallback?: string): string
    /** Muestra opciones y devuelve el índice elegido (−1 si se cancela). `opts`: animación de entrada y salida. */
    choose(options: string[], cancel?: number, prompt?: string, opts?: DialogAnim): Promise<number>
    /** Espera segundos de juego (1 por defecto) antes de continuar. */
    wait(seconds?: number): Promise<void>
    /** Ejecuta un fundido de entrada o salida; duración en segundos y color opcional. */
    fade(direction?: 'out' | 'in', seconds?: number, color?: string): Promise<void>
    /** Subtítulo sin confirmación: se quita solo pasados `seconds` (la promesa se cumple entonces). Ideal para cinemáticas. */
    caption(text: string, seconds?: number, position?: 'bottom' | 'center' | 'top', opts?: DialogAnim): Promise<void>
    /**
     * Muestra el rótulo con el nombre del mapa (interfaz del sistema «Nombre del mapa»): aparece con un fundido, se queda y se va.
     * Sin texto, el nombre del nivel actual. Los tiempos y la posición por defecto son los de Escena ▸ Nivel.
     * @example game.showLevelName()                       // «Gasolinera» abajo a la derecha
     * @example game.showLevelName('Capítulo 2', { position: 'center', hold: 4 })
     */
    showLevelName(text?: string, opts?: { position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center'; delay?: number; fadeIn?: number; hold?: number; fadeOut?: number }): void
    /** Barras de cine: alto de cada barra en % de la pantalla (0–25; 0 las quita). */
    letterbox(percent?: number): void
    /** Grupo, objetos, personajes y diario. */
    readonly party: Party
    /** Registros de la base de datos (solo lectura): game.db.items, game.db.player… */
    readonly db: Record<string, any>
    /** Ejecuta un evento común de la base de datos y espera a que termine. */
    common(x: Ref<'commonEvents'>): Promise<void>
    /** Teletransporta al jugador a una posición. */
    teleport(x: number, y: number, z: number, yaw?: number): Promise<void>
    /** Teletransporta al CharacterBody3D a un nodo de la escena. */
    teleportTo(node: NodeLike, yaw?: number): Promise<void>
    /** 'free' (se mueve) · 'locked' (mira pero no se mueve) · 'frozen' (ni se mueve ni mira). true/false equivalen a 'free'/'locked'. */
    control(mode?: 'free' | 'locked' | 'frozen' | boolean): void
    /** El jugador: posición, movimiento, cuerpo y cámara. */
    readonly player: Player | null
    /** El view model: lo que cuelga de la cámara (manos, ojos…). Ver Base de datos ▸ Jugador. */
    readonly viewModel: ViewModel
    /**
     * Rayo contra la geometría sólida. Devuelve null si no toca nada. `opts` filtra por layers y etiquetas, ignora nodos e incluye Triggers.
     * @example game.raycast(game.player.eye, game.player.forward, 5, { layers: ["Interactuable", "Puertas"] })
     */
    raycast(origin: Vec3, direction: Vec3, maxDistance?: number, opts?: RayOptions): Hit | null
    /**
     * Sensor de visión y oído (estudiado en SensorToolkit): qué ve un nodo o el jugador, con ángulo, alcance, línea de vista y memoria.
     * @example const ojos = game.sensor({ from: "Guardia", range: 18, fov: 100, targets: { player: true }, memory: 3 }); ojos.on("detected", (d) => game.log("Veo a " + d.name))
     */
    sensor(opts: SensorOptions): Sensor
    /** Busca por ID, nombre o ruta absoluta (p. ej. /Raiz/Hijo). */
    node(name: NodeLike): NodeHandle | undefined
    /** Instancias de Prefabs creadas durante Play, con identificadores y ciclo de vida propios. */
    readonly prefabs: RuntimePrefabsApi
    /** Escenas dinámicas creadas durante Play; no equivale a game.goScene(). */
    readonly scenes: RuntimeScenesApi
    /** Marca o desmarca un nodo (por nombre o ID) para conservarlo con sus hijos al cambiar de escena en esta partida. Devuelve false si no existe. enabled = true por defecto. @example game.dontDestroyOnLoad("Música") */
    dontDestroyOnLoad(name: string, enabled?: boolean): boolean
    /** Aparece un jugador en escenas configuradas para aparición por API. Devuelve la raíz del Prefab. */
    spawnPlayer(prefab: Ref<'prefabs'>, options?: { position?: Vec3; parent?: NodeLike }): NodeHandle
    /** Perfiles de post-proceso (Assets/Profiles): set("Noche", 2) los mezcla en 2 s; clear() vuelve al perfil de cámara/GameManager o al render del proyecto. */
    readonly profile: ProfileApi
    /** Input Map: game.input.justPressed("jump") · game.input.pressed("KeyF") · onPress · rebind… */
    readonly input: InputApi
    /** Gráficos en juego: game.graphics.renderer = "mobile" · quality = "bajo" · resolutionScale = 0.75 */
    readonly graphics: GraphicsApi
    /** Animaciones por claves (pestaña Animación): game.animation.play(nodo, "Beber"). También node.playAnimation("Beber"). */
    readonly animation: AnimationApi
    /** Autoridad general de cámaras: game.camera.acquire(game.node("Cámara")?.id). */
    readonly camera: CameraApi
    /** Reproducción manual de Camera Shake Base; también funciona con cámaras de escena. */
    readonly cameraShake: CameraShakeApi
    /** Luces con una etiqueta (todas sin etiqueta): game.lights("Pasillo").forEach(l => l.on = false) */
    lights(tag?: string): LightHandle[]
    /** Todos los nodos con esa etiqueta (Tags y Layers). */
    /** @deprecated Compatibilidad con etiquetas antiguas. Para pertenencia lógica utiliza get_nodes_in_group. */
    findByTag(tag: string): NodeHandle[]
    /** Encuentra nodos de la escena activa con esa pertenencia lógica. */
    get_nodes_in_group(name: string): NodeHandle[]
    /** Invoca un método publicado en los Scripts de Nodo activos de un grupo; no espera las Promises. */
    call_group(group: string, method: string, ...args: any[]): void
    /** Todos los nodos que están en esa layer. */
    findByLayer(name: string): NodeHandle[]
    /** Superficie bajo el punto ('stone', 'dirt', 'grass'…; '' si no hay suelo). */
    surfaceAt(x: number, y: number, z: number): string
    /** Busca un evento por nombre. */
    event(name: Ref<'events'>): EventHandle | undefined
    /** Mueve al jugador ("player"), al evento actual ("this") o a un nodo siguiendo una ruta. */
    moveRoute(target: 'player' | 'this' | NodeLike, steps: RouteStep[], opts?: { repeat?: boolean; skip?: boolean }): Promise<void>
    /** Detiene la ruta de movimiento del objetivo; por defecto el evento actual. */
    stopRoute(target?: 'player' | 'this' | NodeLike): void
    /** Reproducción y control de secuencias Timeline. */
    readonly timeline: TimelineApi
    /** Consultas del mapa de navegación de la escena. */
    readonly nav: NavApi
    /** Carga otra escena y deja al jugador en un nodo con esa etiqueta o nombre (o en `pos`). `fadeOut`/`fadeIn`: segundos de fundido (0 = corte). */
    goScene(scene: Ref<'scenes'>, tag?: string, opts?: { pos?: Vec3; yaw?: number; fadeOut?: number; fadeIn?: number; color?: string }): Promise<void>
    /** Reproducción de audio y control del mezclador. */
    readonly audio: AudioApi
    /** Registra una función que se puede llamar desde el comando «Llamar función de script» o con game.call. */
    define(name: string, fn: (...args: any[]) => any): void
    /** Invoca una función publicada con game.define y devuelve su resultado mediante una promesa. */
    call(name: string, ...args: any[]): Promise<any>
    /** Escucha un evento del juego. Devuelve una función para dejar de escuchar. */
    on(name: 'start' | 'scene', fn: (payload?: any) => void | Promise<void>): () => void
    /** Cada fotograma, ANTES de mover al jugador: `dt` en segundos. Para leer al jugador ya movido usa «lateUpdate». */
    on(name: 'update', fn: (dt: number) => void): () => void
    /** Cada fotograma, al final: el jugador y los eventos ya están actualizados (cámara, seguimiento, HUD que lee posiciones). */
    on(name: 'lateUpdate', fn: (dt: number) => void): () => void
    /** Una vez por paso de física, justo antes de mover al jugador. `dt` es constante (1 / tasa de física de Ajustes del juego, 60 Hz por defecto); puede correr 0, 1 o varias veces por fotograma. */
    on(name: 'fixedUpdate', fn: (dt: number) => void): () => void
    /** Un evento de un clip de animación (nombre, clip y nodo). */
    on(name: 'animationEvent', fn: (e: { node: string; clip: string; name: string }) => void | Promise<void>): () => void
    /** Cambia una acción del Input Map (pulsada o soltada). */
    on(name: 'action', fn: (e: { action: string; pressed: boolean }) => void | Promise<void>): () => void
    /** El jugador entra en (o sale de) un nodo Trigger. */
    on(name: 'triggerEnter' | 'triggerExit', fn: (trigger: TriggerInfo) => void | Promise<void>): () => void
    /**
     * El jugador mira un Trigger con «Mirada» activada (Inspector del Trigger) a menos de su alcance, sin nada sólido en medio, o deja de mirarlo.
     * Solo hay un Trigger «mirado» a la vez. Si ningún Trigger tiene «Mirada», no se calcula nada.
     */
    on(name: 'triggerLook' | 'triggerLookEnd', fn: (trigger: TriggerInfo) => void | Promise<void>): () => void
    /** El jugador salta (`air` = salto extra en el aire). */
    on(name: 'jump', fn: (e: { air: boolean }) => void | Promise<void>): () => void
    /** El jugador aterriza. `speed` = velocidad de caída (m/s); `ground` = 'stable' | 'steep'. */
    on(name: 'land', fn: (e: { speed: number; ground: 'stable' | 'steep' }) => void | Promise<void>): () => void
    /** El jugador se agacha (`on` = true) o se levanta. */
    on(name: 'crouch', fn: (e: { on: boolean }) => void | Promise<void>): () => void
    /** El jugador toca el agua cayendo (`speed` en m/s; también al empezar a nadar). `x/y/z` = punto de la superficie. */
    on(name: 'splash', fn: (e: { speed: number; x: number; y: number; z: number; water: string; node?: string }) => void | Promise<void>): () => void
    /** Un objeto que flota cambia de estado: 'air' (cayendo), 'floating', 'sunk' (en el fondo) o 'ground' (en tierra). */
    on(name: 'float', fn: (e: { node: string; state: 'air' | 'floating' | 'sunk' | 'ground' }) => void | Promise<void>): () => void
    /** Empieza (`on` = true) o deja de nadar. */
    on(name: 'swim', fn: (e: { on: boolean }) => void | Promise<void>): () => void
    /** La cabeza entra (`on` = true) o sale del agua. */
    on(name: 'underwater', fn: (e: { on: boolean }) => void | Promise<void>): () => void
    /** Se acabó el aire: llega cada segundo mientras siga bajo el agua (el daño lo decides tú). */
    on(name: 'drown', fn: (e: { breath: 0 }) => void | Promise<void>): () => void
    /** Cada paso del jugador (y el aterrizaje): la superficie que pisa. */
    on(name: 'footstep', fn: (e: { surface: string; running: boolean; landing: boolean; /** Layer que ha sonado (Tags y Layers). */ layer: string; action: 'walk' | 'run' | 'land' | 'jump' }) => void | Promise<void>): () => void
    /** Un objeto sale de la mano: soltado (`thrown: false`) o tirado (`thrown: true`, con `force` en m/s); al detenerse llega otro con `landed: true`. */
    on(name: 'drop', fn: (e: { node: string; slot: string; thrown: boolean; force?: number; landed?: boolean; bounces?: number }) => void | Promise<void>): () => void
    /** Se guardó o se cargó una partida. */
    on(name: 'save' | 'load', fn: (e: SaveInfo) => void | Promise<void>): () => void
    /** Un relámpago (`lightning`, al verse) y su trueno (`thunder`, cuando llega el sonido). `distance` en metros. */
    on(name: 'lightning', fn: (e: { distance: number; delay: number; bearing: number; /** Corriente de pico (kA). */ peak: number }) => void | Promise<void>): () => void
    /** El trueno llega al oyente (`delay` s después del relámpago). Con «Sonido del trueno: Procedural» trae además `region`, `occlusion` y `loudness` (0–1 con el volumen aplicado). */
    on(name: 'thunder', fn: (e: { distance: number; delay: number; bearing: number; peak: number; region?: string; occlusion?: number; loudness?: number }) => void | Promise<void>): () => void
    /** Cambió el idioma del juego (game.lang = …). */
    on(name: 'language', fn: (e: { lang: string }) => void | Promise<void>): () => void
    /** Impacto de un rayo físico habilitado en Clima. No implica daño automático. */
    on(name: 'lightningImpact', fn: (e: { id: number; seed: number; peakKA: number; kind: 'terrain' | 'object' | 'water'; point: Vec3; normal: Vec3; ownerId: string | null; surface: string; materialId: string }) => void | Promise<void>): () => void
    /** Inicio o fin de un tornado meteorológico: estado espacial en metros y edad en segundos. */
    on(name: 'tornadoStart' | 'tornadoEnd', fn: (e: TornadoSignal) => void | Promise<void>): () => void
    /** Cambio de fase de un tornado. */
    on(name: 'tornadoPhase', fn: (e: TornadoPhaseSignal) => void | Promise<void>): () => void
    /** Entrada o salida de un cuerpo del dominio del tornado; objectId es su ID o 'player'. */
    on(name: 'tornadoEnter' | 'tornadoExit', fn: (e: TornadoBodySignal) => void | Promise<void>): () => void
    /** Un árbol se desprende debido a las fuerzas meteorológicas. */
    on(name: 'treeUprooted', fn: (e: { id: string; forceN: number; kind: string; position: Vec3 }) => void | Promise<void>): () => void
    /** Ignición detectada por destrucción meteorológica; source se incluye para rayos. */
    on(name: 'tornadoIgnition', fn: (e: { id: string; source?: 'lightning'; position: Vec3 }) => void | Promise<void>): () => void
    /** Señal propia: cualquier nombre que no sea un evento interno. Recibe el dato de game.emit / del comando «Emitir señal». */
    on(name: string, fn: (data?: any) => void | Promise<void>): () => void
    /** Entero aleatorio entre min y max (ambos incluidos). */
    random(min?: number, max?: number): number
    /** Envía valores a la salida de scripts del juego. */
    log(...values: any[]): void
    /** Segundos de juego transcurridos. */
    readonly time: number
    /** Apertura, cierre y control de interfaces y Canvas. */
    readonly ui: UiApi
    /** Hora del día (Escena ▸ Hora). */
    readonly clock: ClockApi
    /** Clima y viento (Escena ▸ Clima). */
    readonly weather: WeatherApi
    /** @deprecated Agua original. Declaración histórica conservada por contrato; el intérprete actual no expone esta propiedad, aunque PlayHost contiene su implementación. No usar en scripts hasta resolver la discrepancia contractual. */
    readonly water: WaterApi
    /** Cuerpos dinámicos: caen, chocan, se empujan y flotan (play-bodies.js). */
    readonly physics: PhysicsApi
    /** Reglas del nivel actual (Escena ▸ Nivel). Se pueden cambiar en vivo (`game.level.canRun = false`); al cambiar de escena vuelven a las del nivel. */
    readonly level: LevelApi
    /** Cielo, luz ambiente y niebla de la escena actual. Los cambios duran lo que la escena y no modifican el proyecto. */
    readonly scene: SceneApi
  }
}

/** La API del juego. */
declare const game: LF.Game
/** Solo en scripts marcados como Nodo: handle de la instancia que ejecuta este recurso. */
declare const node: LF.NodeScriptHandle
/** El evento que ejecuta el script (comando «Script» o condición); undefined en scripts del proyecto. */
declare const event: LF.EventHandle
/** Argumentos con los que se llamó al script. */
declare const args: any[]

// Lo mínimo del navegador que usan los scripts. La librería DOM no se carga a propósito: declara su propio `event` (un Event del DOM)
// y taparía el `event` de Century.
interface Console { log(...a: any[]): void; warn(...a: any[]): void; error(...a: any[]): void; info(...a: any[]): void }
declare var console: Console
declare function setTimeout(fn: (...a: any[]) => void, ms?: number, ...a: any[]): number
declare function clearTimeout(id?: number): void
declare function setInterval(fn: (...a: any[]) => void, ms?: number, ...a: any[]): number
declare function clearInterval(id?: number): void
declare const performance: { now(): number }

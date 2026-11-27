# Conceptos

> **Nota de versión:** la documentación oficial actual está en `public/docs/index.html` (Ayuda → Documentación). Esta guía histórica conserva ejemplos de sistemas anteriores; para física y nodos consulta el portal actualizado.

Esta página explica las piezas de LevelForge y, sobre todo, **cuándo usar cada una**.

## Nodos y jerarquía

Todo lo que hay en una escena es un **nodo**: primitivas, modelos, luces, cámaras, eventos, triggers, Canvas, fuentes de audio, agua…
Los nodos forman un árbol: **Node** organiza sin transformación espacial y **Node3D** aporta posición, rotación y escala. Un Node3D puede propagar su escala a los descendientes; algunas primitivas anteriores conservan tamaño visual propio. La jerarquía sirve para **componer**: una farola es un nodo
*Poste* con un hijo *Luz*; un coche es la carrocería con sus ruedas y un evento para subirse.

Cada nodo tiene una **Etiqueta** (*Tag*, una por nodo) y **Layers** (varias). Se buscan desde scripts con `game.findByTag('Respawn')`,
`game.findByLayer('Agua')`, y las luces con `game.lights('Pasillo')`. Se definen en *Juego ▸ Tags y Layers*.

## Recursos de proyecto en el Inspector

Los recursos de **post-proceso (`.post`)**, **material compartido (`.material`)** y **GameManager** se editan directamente en el **Inspector derecho**. En el dock *Proyecto / Assets*, selecciona un recurso con **un clic**: se muestra su formulario en la pestaña *Inspector*, sin abrir una ventana independiente. Puedes seguir seleccionando nodos en la jerarquía para volver a sus propiedades; cambiar de recurso sustituye el formulario que se ve en ese mismo dock. En interfaces estrechas se utiliza el panel lateral de Inspector existente.

| Recurso | Qué editas | Accesos vinculados |
|---|---|---|
| **`.post`** | Nombre, efectos de post-proceso y parámetros; shader de post-proceso si está asociado | Desde Assets, Cámara/Spawn o *Editar perfil…* en GameManager. **Antes/Después** compara en el visor de la escena, no en otra ventana. |
| **`.material`** | Nombre y propiedades del material compartido (PBR, propiedades físicas avanzadas y shader asociado) | Desde Assets o desde el material compartido de un objeto. Los objetos que lo referencian comparten esos cambios. |
| **GameManager** | Nombre, tipo de Player, cámara inicial y perfil `.post` predeterminado | Desde Assets o desde los ajustes de escena. *Editar perfil…* muestra ese `.post` en el mismo Inspector. |

Los recursos se mantienen por **ID**, no por el nombre visible: renombrarlos no debe requerir crear otra copia. Conservan sus datos al guardar el proyecto. Los controles de `.post` se previsualizan en la escena actual; al dejar el editor del perfil, se restaura la vista habitual. **Antes** muestra la escena sin aplicar temporalmente ese perfil.

**Deshacer y Rehacer** utilizan el historial del editor (mediante los comandos de Deshacer/Rehacer del editor) para las modificaciones confirmadas de `.post` y GameManager, además de los materiales existentes. Al arrastrar un valor numérico o modificar un color de `.post`, el visor se actualiza durante la interacción, pero la operación se consolida en el historial cuando terminas el gesto, para no producir una entrada por cada muestra intermedia.

El **Shader Graph** sigue teniendo su propio editor visual, ya que no es un formulario simple. Este Sprint solo migró los recursos de parámetros al Inspector; no rediseñó Shader Graph ni cambió su compilador.

## Camera Shake Base: movimiento visual sin alterar al jugador

**Camera Shake Base** es un nodo nativo de *Gameplay*. Cada instancia guarda una **receta de movimiento de cámara**: no es un componente obligatorio del jugador FPS ni cambia las colisiones. Puede estar en cualquier parte del árbol; ser hijo de una cámara **no basta** para moverla. En el Inspector, asigna **Cámara objetivo** a «Cámara del jugador» o a una cámara de escena. Las cámaras de escena se vinculan mediante su ID, por lo que renombrarlas no rompe la referencia. El efecto solo se aplica cuando esa cámara está activa; una cámara o un clip inexistente no recibe un efecto alternativo.

**Propiedades del Inspector**:

| Propiedad | Uso |
|---|---|
| Cámara objetivo | Cámara del jugador o ID de una cámara de escena; la selección es explícita. |
| Activado | Deshabilita el efecto sin borrar el nodo. |
| Reproducir al iniciar | Inicia automáticamente al entrar en Play; desactívalo para dispararlo desde un script. |
| Bucle | Reproduce continuamente o termina tras un ciclo. |
| Patrón | **Oscilación sinusoidal**, **Ruido suave** determinista o **Curvas de animación**. |
| Animación | En el patrón de curvas, selecciona un Animation Clip existente por ID y edítalo desde el editor de Animación. |
| Desplazamiento XYZ (m) | Amplitud local para los patrones sinusoidal y ruido. |
| Rotación XYZ (°) | Amplitud angular local para los patrones sinusoidal y ruido. |
| Frecuencia (Hz) | Ritmo de los patrones sinusoidal y ruido. |
| Blend In / Blend Out (s) | Suaviza la entrada y la salida del movimiento visual. |

**Patrón Curvas:** utiliza únicamente las pistas **raíz** de `position` y `rotation` del clip. La duración, velocidad e interpolación provienen del Animation Clip; los eventos del clip y las pistas de otros nodos no se ejecutan desde Camera Shake Base. Las posiciones son **desplazamientos locales relativos**, no posiciones absolutas del jugador; las rotaciones se interpretan en grados. La repetición y los fundidos se ajustan en el nodo Camera Shake Base.

**Control durante Play:** la API pública es `game.cameraShake`, tanto para la cámara FPS como para cámaras de escena:

```js
// El nombre identifica un nodo Camera Shake Base; también se acepta su ID.
game.cameraShake.play('Respiración', { intensity: 0.5 }) // reinicia desde el comienzo
game.cameraShake.setIntensity('Respiración', 0.25)     // multiplicador temporal 0–1
const activo = game.cameraShake.isPlaying('Respiración')
game.cameraShake.stop('Respiración')                  // respeta Blend Out
```

Las cuatro operaciones devuelven `boolean`; `isPlaying()` es `false` durante la salida por Blend Out. Los cambios de intensidad y el reloj pertenecen a Play: **no modifican las propiedades guardadas del nodo**. Si el nodo está desactivado o la referencia es inválida, no se inicia el efecto. Puedes llamar la API desde un script o un comando de evento; no hay una vinculación automática al estado agachado del FPS. Para un balanceo al agacharse, configura el clip y decide explícitamente cuándo llamar `play()`.

**Composición y límites:** se pueden sumar varios efectos sobre una misma cámara. Se aplican después de resolver la cámara de juego y se restaura su pose antes de la lógica del siguiente fotograma para no contaminar raycasts, audio ni la física. Timeline y Film Maker tienen prioridad sobre estos efectos. La pausa congela el tiempo; al salir de Play o cambiar de escena se limpia la reproducción transitoria. El rendimiento visual, Electron/Player, Jolt y la exportación siguen sujetos al QA local del proyecto; las pruebas Node no acreditan un resultado visual.

Consulta la [referencia de `CameraShakeApi`](../referencia/api.md#camerashakeapi) para las firmas y tipos de cada operación.

## El agua reacciona: salpicaduras, ondas y objetos que flotan

Al caer, nadar o caminar por el agua salen gotas y ondas (Base de datos ▸ Jugador ▸ Agua ▸ «Salpicaduras y ondas»). La flotación se configura desde las capacidades del runtime físico y de agua. Los controles físicos antiguos de una primitiva visual fueron sustituidos por cuerpos especializados; consulta el portal web para la estructura actual. Cabecea, se inclina con las olas y la corriente lo arrastra; lo que el jugador tira al agua flota si lo marcaste y, si no, se hunde. `game.water.splash(x, z)` hace una salpicadura donde quieras. Los objetos no chocan entre sí ni empujan al jugador: es un efecto de flotación, no un simulador de fluidos.

## Profundidad de campo y LUT de color

En Ajustes ▸ Render: «Profundidad de campo (px)» desenfoca lo que queda lejos del plano de enfoque (0 = apagada); con «Enfoque automático» enfoca lo que miras al jugar. «LUT de color» remapea todos los colores con una imagen de Assets: exporta una LUT neutra (`docs/lut-neutra-16.png`), retócala en tu editor de imágenes y vuelve a importarla. En Escena ▸ Entorno ▸ Niebla, «Empieza a (m)» deja la vista cercana limpia y la niebla solo a lo lejos.

## Exposición automática

En Ajustes ▸ Render ▸ Color y tonos, «Exposición automática» (0 = apagada) imita la pupila: mide el brillo de lo que ves y lo lleva poco a poco a un brillo objetivo, así una cueva se aclara al entrar y el exterior se oscurece al salir. Úsala con cuidado de noche: con fuerza 1 la noche se aclara hasta parecer de día; con 0,3–0,5 queda natural. También existe como efecto en los perfiles de post-proceso, para activarla solo en ciertas zonas.

## Sensores: que un enemigo vea u oiga

`game.sensor({ from: "Guardia", range: 18, fov: 100, targets: { player: true }, memory: 3, hearRange: 2 })` crea un sensor. Dispara `detected` cuando alguien entra en su cono de visión (con línea de vista: una pared lo tapa) o en su radio de oído, y `lost` cuando lo pierde tras `memory` segundos. También puedes preguntar `sensor.sees("player")` o leer `sensor.nearest`. Créalo en `game.on("scene")`, porque los sensores se destruyen al cambiar de escena.

## Brushes sustractivos: puertas y ventanas sin modelar

Como el BSP de Unreal: pon un muro (una caja escalada) y, encima, un **hueco** — *Añadir ▸ Primitivas ▸ Brush sustractivo* (caja, cilindro o escalera). El hueco es una primitiva marcada *Brush ▸ Sustractivo* en el Inspector: se ve como un volumen rojo translúcido con aristas y **resta su forma a todos los sólidos que toca**, así que el muro se abre al instante. Muévelo, gíralo o escálalo y el agujero lo sigue. Al jugar (y en el juego exportado) el hueco no se ve ni choca, y el jugador pasa por la puerta.

- Haz que el hueco atraviese el muro un poco por cada lado (más grueso que el muro): evita caras coplanares.
- *Brush ▸ Recibe cortes* (en los sólidos) lo desactiva donde no quieras perforar, por ejemplo en el suelo.
- Cualquier primitiva puede ser sólido o hueco: cilindros para túneles y ojos de buey, escaleras para el hueco de una escalera.
- **Material de las paredes del hueco**: es el del propio brush (su color, rugosidad, metal y shader en el Inspector); cada hueco puede tener el suyo (marco de madera en la puerta, otro color en la ventana). El brush se ve rojo en el editor, pero el color que eliges es el de las paredes que abre.
- Los huecos se calculan al cambiar la escena (≈ milisegundos por corte).
- **Hornear cortes a malla** (Inspector ▸ Brush) o **Editar malla** (Tab) convierte el sólido en una malla editable *con* los huecos ya hechos (colisión por malla, sin huecos que se rellenen); la malla tiene un solo material y deja de recibir cortes. Las caras salen como fragmentos convexos (no se vuelven a unir en una sola cara grande).

## Prefabs: reutilizar sin duplicar

Un **prefab** es un nodo con sus hijos guardado como asset (`Assets/Prefabs`). Las copias que colocas son **instancias**: si cambias el
prefab y pulsas *Aplicar*, todas se actualizan. Sirve para repetir un conjunto de nodos (un poste con su luz hija).

Un prefab también puede ser el **modelo de un registro de la base de datos** (personaje, enemigo, objeto, arma, armadura): en el campo
*Modelo* aparecen las primitivas, los modelos importados y los prefabs. Un evento con *Gráfico ▸ Objeto (base de datos)* dibuja ese
conjunto entero: la página 1 muestra el objeto «Farola» (con su luz) y la 2 «Farola rota»; cuando el interruptor cambia la página,
cambia el conjunto. Ver el [tutorial](../tutorial/vertical-slice.md#5-una-farola-que-se-rompe). (El antiguo *Gráfico ▸ Prefab* está
obsoleto: sigue funcionando en las páginas que ya lo usan, pero ya no se ofrece.)

## Sprites y pintura

Un **Sprite 3D** es una imagen como plano en el mundo (carteles, personajes planos, el plano de una casa para modelar encima) y un
**Sprite 2D** una imagen en la pantalla, dentro de un Canvas. Los *Lienzos de píxeles* nacen con una imagen en blanco: con el nodo
elegido, **Tab** entra a pintarlo con herramientas de pixel art (lápiz, borrador, cubo, cuentagotas, línea, rectángulo, elipse, spray).
Tab otra vez guarda el PNG.

## Eventos: la lógica sin programar

Un **Evento** es una zona de la escena con **páginas**, como en RPG Maker. Cada página tiene:

- **Condiciones**: interruptores, una variable, un objeto en el inventario, un personaje en el grupo, el auto-interruptor o una expresión JS.
  Gana la **última** página cuyas condiciones se cumplen; si ninguna se cumple el evento no está.
- **Gráfico**: nada, una primitiva, un modelo, un registro de la base de datos (personaje, objeto…) o un prefab.
- **Disparador**: *botón de acción* (`E` dentro del alcance), *al tocarlo*, *al mirarlo*, *automático*, *paralelo*, *al pulsar una tecla* o *al recibir una señal*.
- **Contenido**: la lista de **comandos** que se ejecutan en orden ([referencia](../referencia/comandos.md)).

### Interruptores, variables y auto-interruptores

| | Qué guarda | Alcance | Ejemplo |
|---|---|---|---|
| **Interruptor** | sí / no | todo el juego | «Llave recogida», «Farola rota» |
| **Variable** | número, texto, lista u objeto | todo el juego | «Monedas», «Visitas a la anciana» |
| **Auto-interruptor** (A–D) | sí / no | **ese evento** | «Ya abrí este cofre» (cada cofre el suyo) |

Se nombran en *Juego ▸ Base de datos*. Con ellos se hacen casi todas las mecánicas: el comando *Interruptor* cambia uno y la página de
otro evento que lo pide como condición aparece sola. Para **apagar o encender muchas cosas a la vez**, usa un interruptor como
condición de todas sus páginas, o una **etiqueta**: el comando *Controlar luz* actúa sobre todas las luces con una etiqueta.

### Señales

Para que un evento avise a otro sin interruptores: el comando *Emitir señal* («alarma») despierta a las páginas con disparador
*Al recibir señal*, a quien esté en *Esperar señal* y a los scripts con `game.on('alarma', …)`.

## Scripts

Los scripts (`Assets/Scripts/*.js`) se ejecutan al empezar el juego. Úsalos para:

- **Funciones reutilizables**: `game.define('curar', (n) => …)` y luego el comando *Llamar función de script* o `game.call('curar', 5)`.
- **Reaccionar a cosas del motor**: `game.on('update', (dt) => …)` (cada fotograma, *antes* de mover al jugador), `game.on('lateUpdate', (dt) => …)` (al final, con el jugador ya movido: cámaras, seguimiento, HUD), `game.on('fixedUpdate', (dt) => …)` (una vez por paso de física, a la tasa de Ajustes del juego ▸ Física), `game.on('footstep', (e) => …)`, `game.on('language', …)`.
- **Cálculos y bucles** que serían largos con comandos.

### El jugador (Base de datos ▸ Jugador)

El jugador en primera persona no cambia de velocidad al instante: **acelera y frena**, y su control depende de dónde pisa.

- **Suelo estable** (pendiente ≤ *Pendiente máxima*): control total (*Aceleración / Frenado en suelo*). Al dar la vuelta acelera más (*Impulso al girar*).
- **Suelo inestable** (más empinado): resbala y casi no tiene control; no puede saltar salvo que lo permitas.
- **Aire**: control reducido (*Control en el aire*) y **conserva la velocidad que llevaba** (correr + saltar = salto largo).

El **salto** se define por lo que ves: *altura* y *tiempo hasta el punto más alto* (la gravedad y la velocidad se calculan solas; puedes pasar a valores manuales). Además: *tiempo de gracia al caer* («coyote time»), *salto anticipado* (pulsar un poco antes de aterrizar), *saltos extra* (doble salto), *salto variable* (soltar pronto = salto corto) y *gravedad al caer*. **Agacharse** usa la acción `crouch` del Input Map (mantener o alternar), comprueba que haya techo para levantarse y reduce la velocidad. Al saltar o caer de una **plataforma móvil** conservas su velocidad.

El **paso de física** es fijo (Ajustes del juego ▸ Física, 60 Hz por defecto): el movimiento no depende de los FPS. En scripts: `game.on('fixedUpdate', dt)` una vez por paso, `game.on('lateUpdate', dt)` al final del fotograma, `game.on('jump' | 'land' | 'crouch' | 'splash' | 'swim' | 'underwater' | 'drown', e)`, y `game.player.speed`, `.ground`, `.crouching`, `.airTime`, `.jumpNow()`, `.crouch(true)`. Todos los ajustes son también `game.player.<campo>` (por ejemplo `game.player.airJumps = 1`).

**Agua** (Base de datos ▸ Jugador ▸ Agua). Los objetos Agua (océano, lago, estanque, río) se consultan como volúmenes con la misma superficie y olas que dibuja el shader. El jugador **vadea** (el agua lo frena según la profundidad y la corriente lo arrastra), **nada** cuando el agua pasa de cierta fracción de su altura (flota con los ojos sobre la superficie; `jump` en la superficie = salto para salir a una orilla alta) y **bucea** (`crouch` hunde, `jump` sube, con la cabeza bajo el agua se nada hacia donde se mira, la flotabilidad lo lleva a respirar). Hay aire (`game.player.breath`, evento `drown` cuando se acaba; el daño lo decides tú), **corriente** (cada objeto Agua tiene *Corriente*: en un río va a lo largo del cauce) y **efecto bajo el agua** (niebla y color del agua, sonido amortiguado) según la cámara. En scripts: `game.player.inWater / swimming / underwater / waterDepth / waterLevel / water / current`.

### Interactuables: rayo, mirada y Trigger

Para avisar al jugador de que algo se puede usar, el motor no impone ningún aspecto: te da las piezas y tú decides qué mostrar.

- **¿Qué tiene delante?** `game.player.look({ distance: 2.5, layers: 'Interactuable' })` lanza un rayo desde sus ojos y devuelve el nodo
  (o `null`). Lo que no esté en esa layer no estorba. Para otros rayos: `game.raycast(origen, dirección, distancia, { layers, tags, ignore, triggers })`.
- **Referencias del jugador**: `game.player.eye`, `.forward`, `.pitch`, `.camera`, `.grounded`.
- **Trigger con slots**: en el Inspector del Trigger, *Al entrar*, *Al salir*, y con **Mirada** activada, *Al mirar* / *Al dejar de mirar*.
  Cada slot es el nombre de una función de tus scripts (`game.define('mostrarAviso', (t) => …)`). Vacíos, no cuestan nada.

```js
// Un Trigger «Cartel» con Mirada activada y Al mirar = «mostrarAviso», Al dejar de mirar = «ocultarAviso»
game.define('mostrarAviso', (t) => game.ui.canvas('Aviso')?.show())
game.define('ocultarAviso', (t) => game.ui.canvas('Aviso')?.hide())

// O, sin Trigger: lo que haya delante en la layer «Interactuable»
game.on('update', () => {
  const hit = game.player.look({ distance: 2.5, layers: 'Interactuable' })
  game.ui.canvas('Mirilla')?.[hit ? 'show' : 'hide']()
})
```

El comando *Script* de un evento ejecuta JS en ese momento (con `event` = el propio evento). El editor de código tiene IntelliSense
completo (sugerencias por tipos, nombres de tu proyecto, ayuda de parámetros, errores mientras escribes). Ver la [API](../referencia/api.md).

### Reglas del nivel y entorno desde un script

`game.level` y `game.scene` se leen y se escriben mientras el juego corre; los cambios valen para la escena actual y no tocan el proyecto guardado.

```js
game.level.canRun = false          // el jugador ya no puede correr
game.level.speedScale = 0.5        // a mitad de velocidad
game.scene.set({ fog: true, fogDensity: 0.05, fogColor: "#112233" })
game.scene.reset()                 // vuelve al entorno del proyecto
```

Al cambiar de escena (`game.goScene`) o al parar el juego, todo vuelve a lo definido en *Escena*. Con *Hora* o *Clima* activos, cielo, luz y niebla los gobierna el mundo (`game.clock`, `game.weather`), así que `game.scene` no se verá. Propiedades y tipos: `docs/referencia/api.md`.

## Interfaz: nodos Canvas

**Toda la interfaz pasa por nodos Canvas.** Un Canvas dibuja un recurso `.ui` (plantilla Vue + script + estilo) sobre el juego.

- **Interfaz propia** (HUD, menús, inventario): Canvas con *Uso: Interfaz propia*. Se muestra/oculta con *Visible al iniciar*,
  `game.ui.canvas('HUD').visible = false` o el comando *Mostrar / cerrar interfaz*.
- **Interfaz del sistema**: un Canvas con *Uso: Diálogo* dibuja los «Mostrar texto»; también hay *Opciones, Indicación, Fundido,
  Barras de cine, Subtítulo* y *Aviso omitir*. Si la escena no tiene ninguno, se usa una interfaz por defecto con el tema del proyecto,
  así que nada deja de verse.

Detalles en [Interfaces](../referencia/ui.md).

## Base de datos

*Juego ▸ Base de datos*: personajes, clases, habilidades, objetos, armas, armaduras, enemigos, estados, eventos comunes, misiones,
documentos, el jugador (cuerpo, velocidad, cámara, slots del view model) y los nombres de interruptores y variables.

El **icono** de un registro puede ser un emoji o símbolo, o una **imagen** (png, jpg, webp…): suéltala en el recuadro (desde el panel
Proyecto o desde tu carpeta; se importa a `Assets/Icons`), elígela en la lista o pulsa *Importar imagen…*. Se ve en el inventario
(`<rt-icon :icon="it.icon" />` en tus interfaces) y en los textos con `\I[item:3]`.

## Audio

Las fuentes de audio son nodos (3D o de interfaz). El **Audio Mixer** organiza los grupos (Música, SFX, Voz, Ambiente, UI…) con volumen,
silencio y efectos. Los comandos *Reproducir sonido*, *Volumen de un grupo* y `game.audio.play('clip', { group })` usan esos grupos.
La voz de los diálogos suena en el grupo **Voz**.

El grupo **UI** es para los sonidos de interfaz (clics de botones, avisos, menús): `game.audio.ui('clic')` reproduce por él, y
`game.audio.setVolume('ui', 0.5)` baja solo esos sonidos sin tocar los efectos del juego. Los grupos y *tracks* que añades en el mezclador
se renombran con doble clic (los del sistema —Master, Música, SFX, Voz, Ambiente y UI— no).

**Pasos**: cada layer (*Juego ▸ Tags y Layers ▸ Layers*, botón ♪) puede llevar sus clips de pasos: varios para **caminar**, **correr**,
**aterrizar** y **saltar** (se eligen al azar sin repetir el último), con volumen, variación de tono y grupo del mezclador. El jugador
suena con la layer de lo que pisa (la primera con sonido del objeto; en el terreno, la layer con la superficie de esa capa de pintura).
Sin clips suena el paso sintético de la superficie. Un objeto al ras del terreno manda sobre él.

## Localización

*Juego ▸ Localización* guarda los textos por **clave** y **idioma**, con la **voz** de cada idioma. El comando *Mostrar texto* se enlaza a
una clave; en el juego exportado se muestra en el idioma del jugador (`game.lang`). En cualquier texto, `{t:clave}`; en scripts y `.ui`,
`game.t('clave')`. El apartado **Interfaz** recoge los textos de las interfaces (etiquetas, botones, casillas y el texto de ayuda de los
cuadros de texto del diseñador) en claves `ui.<interfaz>.<control>`: así el HUD y los menús también salen en el idioma del jugador.

## Cinemáticas

El **Timeline** anima la cámara, nodos y audio, y ejecuta comandos de evento en momentos concretos (diálogos que pausan la cinemática).
Se reproduce con el comando *Reproducir timeline* o `await game.timeline.play('Intro')`. Para rodar con el móvil o la webcam está
**Nether Film Maker** (aplicación aparte que usa las escenas del proyecto).

## Guardar partida

El comando *Guardar partida* / `game.save.save(1)` guarda interruptores, variables, grupo, inventario, diario, `game.state`, la escena,
la posición, la hora, el clima y lo que el jugador lleva en la mano. *Abrir pantalla de guardado* muestra el menú de ranuras.

## Físicas: objetos que caen, chocan, se empujan y flotan

Para un **cuerpo dinámico** utiliza `RigidBody3D` y una forma hija `BoxShape3D`, `SphereShape3D` o `CapsuleShape3D`. Las primitivas visuales no crean física de forma implícita. Al jugar cae, choca con el suelo y con los demás, rueda si es una esfera, y el jugador lo empuja al caminar contra él. Lo ligero se mueve con facilidad; lo muy pesado (mucha masa) casi no se mueve. «Flota en el agua» ya no es un truco visual: el objeto es un cuerpo y el agua le da un empuje real según cuánto de él está sumergido. Una densidad menor que 1 flota (0,6 madera), 1 o más se hunde. Si te subes a una balsa, tu peso la hunde un poco; la corriente la arrastra.

```js
game.physics.body('Barril', { density: 0.6 })          // flota
game.physics.body('Caja', { mass: 20, bounce: 0.3 })    // cae y rebota
game.physics.impulse('Caja', [0, 6, 0])                 // golpe seco
game.physics.explode(x, y, z, { radius: 6, force: 8 })  // empuja todo lo cercano
```

## Cómo está organizado el motor (para quien lo amplíe)

El motor crece por **módulos pequeños que se enchufan**, no por archivos gigantes. Reglas que vigila `node scripts/check-layers.mjs --check`: sin ciclos de importación, el Runtime solo importa del Runtime (nunca del editor), ni Vue ni `document` en el motor, y **ningún archivo de más de 600 líneas**. Cuando un archivo se acerca, se parte por responsabilidad: una clase se reparte en mixins (`Object.assign(Clase.prototype, misMetodos)`) y las funciones puras salen a su propio módulo. Una función nueva (como los sensores, las físicas o el agua) va en su módulo y se engancha desde un solo sitio.


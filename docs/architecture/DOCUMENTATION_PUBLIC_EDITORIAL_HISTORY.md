# Archivo interno de contenido editorial anterior

Copia de las páginas modificadas, tal como estaban en la entrega de 4.189 archivos. No se publica en el portal.


---

## agua.md

# Agua y fluidos

**Estado contractual: Deprecated (agua original); integración Century Fluids en pausa.** La enmienda CE-CF-CA-002-AM-002 devuelve al motor sus tipos `water` y `fluidcontainer3d` y sus consumidores históricos. No se exige migrar escenas ni instalar la biblioteca independiente. El puente de Century Fluids se conserva sin consumo obligatorio en Play/Jolt.

El catálogo Agua ofrece océano, lago/piscina, estanque circular y río. Sus variantes y propiedades se encuentran en el Inspector; no confundas el aspecto de superficie con una región finita de simulación. Los recipientes y las regiones históricas tienen sus propios límites. La restauración no supone certificar todas las rutas de colisión, guardado, exportación o acoplamiento hidráulico.

**API:** `game.water` conserva una declaración histórica pero el objeto público construido por el intérprete actual no la expone, aunque existe un getter en PlayHost. No utilices esa propiedad en nuevos scripts hasta resolver la discrepancia mediante el contrato correspondiente. No se ha reactivado mediante esta actualización documental.

Las descripciones técnicas del agua original se preservan en [Física](#/fisica) y [Gráficos](#/graficos). El estado de cada capacidad debe verificarse en Play antes de depender de ella.


---

## api-intro.md

# Referencia de la API JavaScript

Las firmas y tipos se derivan de **`src/core/events/game-api.d.ts`**, la misma declaración utilizada para IntelliSense en el editor de scripts y VS Code.

## Objetos de contexto

| Objeto | Dónde está disponible |
|---|---|
| `game` | Scripts globales, scripts de nodo y otros contextos soportados |
| `node` | Scripts de ejecución Nodo |
| `event` | Contextos de ejecución del nodo Evento, cuando corresponda |
| `args` | Llamadas que reciben argumentos |

## Estructura de la referencia

Cada interfaz documenta propiedades, tipos, métodos, argumentos, firmas y descripciones disponibles en la declaración real. La referencia está organizada por interfaz; por ejemplo: **Game**, **NodeHandle**, **NodeScriptHandle**, **Player** y **PhysicsApi**.

## Ejemplo

```js
const puerta = game.node('Puerta')
if (puerta) {
  puerta.visible = true
}
```

## Alcance de la fuente

Un tipo declarado proporciona autocompletado y contrato esperado; no equivale a una prueba exhaustiva de ejecución real en hardware. Consulta además las notas de cada sistema y las pruebas del proyecto.


---

## atajos.md

# Atajos y comandos del editor

El catálogo del editor define acciones en `src/core/commands.js`. La disponibilidad de cada acción puede depender del contexto, selección o modo de edición.

## Atajos principales

| Acción | Atajo |
|---|---|
| Guardar | Ctrl+S |
| Abrir proyecto | Ctrl+O |
| Copiar | Ctrl+C |
| Pegar delante de cámara | Ctrl+V |
| Duplicar | Ctrl+D |
| Duplicación vinculada | Alt+D |
| Deshacer | Ctrl+Z |
| Rehacer | Ctrl+Shift+Z |
| Renombrar | F2 |
| Agrupar | Ctrl+G |
| Desagrupar | Ctrl+Shift+G |
| Documentación | F1 |

## Edit Mesh: atajos contextuales

| Acción | Atajo |
|---|---|
| Entrar / salir de Edit Mesh | Tab |
| Seleccionar vértices / aristas / caras | 1 / 2 / 3 |
| Mover / rotar / escalar geometría | G / R / S |
| Extruir / inset (modo cara) | E / I |
| Bisel de aristas / vértices | Ctrl+B / Ctrl+Shift+B |
| Corte en bucle | Ctrl+R |
| X-ray / edición proporcional | Alt+Z / O |
| Añadir geometría | Shift+A |

Estos comandos actúan sobre la sesión de malla, no sobre los gizmos de objeto; las mismas funciones están en el panel Malla. Durante la operación modal, la barra deshabilita controles que podrían interrumpirla.

## Identificadores internos

El catálogo de comandos del editor es distinto de los comandos del nodo Evento. Aquí se registran acciones como `edit.paste`, `edit.duplicate`, `file.save` y `help.docs`.

## Consejos

Usa la búsqueda de comandos del editor para localizar acciones. Si una opción está deshabilitada, comprueba el modo activo o la selección.


---

## audio.md

# Audio y animación

Century Engine incorpora fuentes de audio, Audio Mixer, animaciones de objetos y Timeline. Son sistemas distintos, aunque pueden coordinarse desde eventos y scripts.

## Audio

Las fuentes son nodos especializados y pueden utilizar grupos del mezclador. El runtime incorpora audio posicional y oclusión, sujeto a prueba con una escena real. Consulta `game.audio` en la [API](#/api-audioapi).

## Animación

En la raíz de Assets, elige **Crear → Clip de animación**. Haz doble clic en el recurso para editarlo en **Animación**. Para importar una captura, usa **Juego → Importar captura de movimiento (.lfcap)**. Las acciones de evento incluyen reproducir o detener animación; en script se pueden utilizar métodos de `game.animation` y del handle de nodo.

## Timeline

En **Timeline**, pulsa **Nuevo Timeline**, escribe un nombre y confirma. El recurso aparece en Assets y se abre en el editor de pistas. También puedes crearlo desde **Assets → Crear → Timeline**. La biblioteca permite buscar y cambiar de secuencia. El Timeline coordina secuencias y sus operaciones de reproducción y parada tienen API propia. Consulta la interfaz `TimelineApi`.

## Efectos de cámara

`CameraShakeBase` es un nodo de gameplay con recetas de movimiento visual. No cambia por sí solo la física del jugador. Puede activarse desde `game.cameraShake`.

## Lluvia: sonidos de impacto por superficie (S08)

En **Escena → Clima → Sonido del clima**, activa «Impactos por superficie» y añade perfiles de metal, piedra, tierra, hierba u otras superficies. Asigna clips de audio importados en Assets (hasta cuatro variantes por perfil), volumen, variación de tono y máximo de impactos por segundo. Los perfiles no generan sonidos de forma automática: sin clips hay silencio de impactos.

Cada material local o `.material` compartido también permite configurar **Impactos acústicos de lluvia** en el Inspector. Allí puedes activar el perfil, elegir superficie, añadir hasta ocho clips mediante selector o arrastrando desde Assets, escucharlos con ▶ y ajustar volumen, tono y límite. Si hay un perfil activo en el material, prevalece sobre el general de la escena; en su ausencia se utiliza la superficie de Layers, Terrain pintado o agua visible.

Los impactos utilizan audio posicional y el sistema de oclusión Web Audio existente. La lluvia ambiental continúa como bucle independiente: bajo un techo puede atenuarse mientras se oyen gotas golpeando la cubierta. La simulación física del agua no depende de estos sonidos. El muestreo de gotas visibles y un presupuesto global de voces evitan reproducir miles de clips simultáneos.

**Compatibilidad:** los proyectos antiguos mantienen esta función desactivada. Para comprobarla en Player se requiere QA local con clips reales y auriculares. No se incluyen archivos de sonido predeterminados.


Los timelines nativos admiten renombrar, duplicar, mover, copiar su ruta lógica, exportar como `.levelpackage` y eliminar desde Assets. El renombrado conserva el ID y bloquea referencias explícitas por nombre; las referencias escritas en scripts requieren revisión. Los paquetes incluyen las dependencias detectadas, pero los enlaces a nodos deben revisarse en la escena destino.

**Cinematics** reproduce exclusivamente películas importadas de Nether FilmMaker; su biblioteca permanece separada de la autoría de Timeline.


---

## comandos-intro.md

# Referencia de comandos de eventos

La referencia se obtiene de **`commandDefs.js`**, fuente declarativa utilizada por el editor de eventos. Cada página presenta el código interno del comando y su tabla de parámetros.

## Cómo insertar un comando

Abre un nodo Evento, selecciona la página y utiliza **Insertar comando** en su contenido. Los comandos se ejecutan en el orden de la lista y pueden tener ramas o cuerpo anidado.

## Cómo consultar la referencia

Abre las páginas bajo **Comandos de evento** en la navegación lateral o utiliza la búsqueda por nombre, identificador o parámetro. Por ejemplo: `waitSignal`, `variable` y `playAnimation`.

## Relación con scripts

Algunos comandos presentan una llamada ilustrativa a `game.*`. Verifica su firma real en la sección **API JavaScript**. No se asume equivalencia para los que no tengan código de script documentado.


---

## editor.md

# Manual del editor

Century Engine utiliza una interfaz Electron con paneles adaptables, ventanas desacopladas y menús para editar proyectos, escenas, materiales, eventos y scripts.

## Barra superior

**Archivo**: abrir y guardar proyecto, crear escena, importar y exportar. **Editar**: Undo/Redo, copiar, pegar, duplicar, agrupar. **Añadir**: catálogo de nodos. **Juego**: ajustes de proyecto, Input Map y otros sistemas. **Ayuda**: documentación y referencias.

## Scene Tree

El panel jerárquico muestra los nodos de la escena activa. Permite búsqueda, selección, reparenting, renombrado con F2 y navegación por teclado. Los nodos con script muestran un indicador. Consulta [Operaciones del árbol](#/scene-tree).

## Inspector

Muestra las propiedades relacionadas con el tipo de nodo seleccionado y editores de recursos. `Node` no tiene Transform; `Node3D` y sus derivados sí. El Inspector de `RigidBody3D` contiene propiedades físicas; la primitiva visual no las tiene. Consulta [Inspector contextual](#/inspector).

## Viewport

Selecciona y transforma mediante gizmos; admite vistas y navegación con teclado/ratón, herramientas de malla y opciones de Snap. Las operaciones complejas se ajustan desde sus paneles específicos.

### Shift · transformación libre momentánea

Con Snap de movimiento, rotación o escala activado, **mantén Shift mientras arrastras un gizmo del editor de escenas** para mover, girar o escalar libremente. Suelta Shift para recuperar el ajuste. Funciona también con el gizmo universal y con selecciones múltiples. No es necesario desactivar las casillas de Snap: su configuración no cambia.

Si sueltas o pulsas Shift durante un arrastre, la posición, rotación o escala **no salta** al valor de la cuadrícula. Desde ese punto, el Snap se reanuda por incrementos de la configuración hasta soltar el ratón. En un arrastre iniciado sin Shift, el Snap inicial conserva la alineación de cuadrícula habitual. Esta función **no aplica** en Edit Mesh, FilmMaker ni al gizmo de las piezas de terreno.

Si la aplicación pierde el foco, Shift se restablece al modo normal. La transformación se confirma con el sistema habitual de Undo/Redo al soltar el ratón.

### Organización de la barra del viewport

La barra de **Escena** contiene opciones de visualización frecuentes (rejilla, malla, luces y terreno), vistas ortogonales/perspectiva, **Encuadrar todo** y un icono que alterna directamente la navegación entre ratón y trackpad. Las operaciones avanzadas de cámara se encuentran en **Ver**; no se duplican en la barra del visor. En **Edit Mesh**, la Toolbar sustituye los gizmos de objetos y herramientas de entorno por selección vértice/arista/cara, operaciones contextuales, transformaciones de geometría y acceso al panel Malla. Consulta [Edit Mesh](#/mesh-edit) para detalles; se conservan los controles del viewport y el modo Juego.

- **FOV horizontal de la cámara editorial:** **Editar → Preferencias del editor → Viewport** (40–120°, predeterminado 90°). **Restablecer** recupera 90°. No modifica las cámaras del juego ni el FOV del jugador.
- **Tamaño de los gizmos:** **Preferencias del editor**. **Ratón / Trackpad:** icono sin texto en la barra superior de Escena, pulsable para alternar el modo. El icono representa el dispositivo activo y se sincroniza con **Preferencias del editor → Navegación** y **Ver → Navegación**. Mantiene sensibilidades, gestos y persistencia existentes.
- **Render del viewport:** exclusivamente en **Ver → Render del viewport**. Las opciones **Usar render del proyecto**, **Forward+**, **Mobile** y **Compatibility** usan `store.view.renderMethod` sin modificar `project.render`, el Player exportado ni **Editar → Ajustes del motor**. El control retirado PC/Portátil de ViewBar no era un selector de ratón/trackpad y quedó supersedido por CA-002.
- **Orbitar selección y acciones de cámara:** **Ver**. Los atajos de vistas y las acciones de alinear y pilotar se conservan.

### Escala uniforme de objetos (S04)

En **Object Mode**, selecciona un objeto escalable o varios nodos y pulsa **S**, escribe el factor (por ejemplo `2`, `0.5` o `1`) y confirma con **Enter**. **Esc** cancela y restaura la transformación inicial. Mientras escribes aparece una indicación temporal en la barra superior. Un factor `2` transforma `[2, 3, 4]` en `[4, 6, 8]` sin igualar sus ejes. Un factor `1` no modifica el objeto. No se admiten factores negativos, cero ni valores que infrinjan las restricciones físicas o el tamaño mínimo.

El comando **R** continúa mostrando el gizmo de escala normal. **Ctrl+S** sigue guardando; si se pulsa durante la operación numérica, cancela la vista previa y ejecuta Guardar. Para varios objetos, se conservan las distancias relativas respecto al centro de la selección y se transforman únicamente las raíces, sin aplicar escala doble a hijos seleccionados.

En el **Inspector → Transformación** se conservan los campos XYZ absolutos de **Tamaño/Escala** y se añade **Escala ×**, que aplica un multiplicador relativo al estado inicial de ese gesto y registra una sola operación de Undo/Redo. Los nodos sin escala propia no ofrecen ese campo. En primitivas, se mantienen los vínculos de radio/esfera establecidos.

## Ventanas

Edit Mode, Play Mode y Code disponen de vistas editoriales que se pueden acoplar y desacoplar. Arrastra las pestañas para reorganizar el espacio de trabajo. En Electron, las ventanas de herramientas y recursos utilizan el alojamiento nativo disponible; el contenido conserva su autoridad en el documento del editor. Consulta [Preferencias](#/preferencias).


Los scripts se crean en Assets, se nombran antes de editarse y pueden asignarse al nodo desde el Inspector mediante selector o arrastre. El doble clic en un recurso JavaScript abre el editor de código integrado. En Electron, Código, Eventos, Base de datos, Localización y varias herramientas de los menús abren en ventanas propias. En Eventos, **Insertar comando** permite buscar por nombre o categoría. El panel de documentación abre un portal HTML local, con búsqueda y navegación por capítulos.

## Estadísticas de rendimiento

**Stats** muestra FPS durante el juego, tiempos de dibujo y contadores de escena. Ábrelo desde los controles de juego o con **F3**.

## Atajos verificados en el catálogo

| Acción | Acceso |
|---|---|
| Guardar proyecto | Ctrl+S |
| Deshacer / rehacer | Ctrl+Z / Ctrl+Shift+Z |
| Copiar / pegar delante de la cámara | Ctrl+C / Ctrl+V |
| Duplicar / duplicación vinculada | Ctrl+D / Alt+D |
| Renombrar | F2 |
| Agrupar | Ctrl+G |
| Eliminar selección | Supr |
| Documentación | F1 |

Las acciones contextuales pueden quedar deshabilitadas en determinados estados del editor.

## Control de versiones

La sección **Control de versiones** del dock inferior ofrece **Cambios**, **Historial**, **Ramas** y **Remoto**. Está disponible para proyectos guardados en disco desde Electron. Consulta la [guía Git](#/vcs-intro) para guardar commits, comparar revisiones y sincronizar por HTTPS.

## HUB de proyectos

El HUB ofrece proyectos recientes, búsqueda, ordenación, lista o cuadrícula, información del proyecto seleccionado, importación y creación desde plantillas. Las miniaturas solo aparecen cuando hay una imagen real del proyecto; de lo contrario se muestra un icono neutral. La creación conserva nombre, ubicación y renderizador.

**Errores y recuperación (HF-G001):** los fallos de abrir, crear, importar, duplicar o quitar proyectos se presentan en un aviso persistente dentro del HUB, con la causa devuelta por el sistema cuando está disponible. Un fallo de lectura de la biblioteca permite **Actualizar lista** sin borrar la lista anterior ni quedar en «Cargando…». El aviso puede descartarse; cancelar un selector de archivos o una confirmación no se trata como fallo. Estas incidencias operativas del HUB no se incorporan a la consola del Editor, pero sus excepciones técnicas continúan disponibles en DevTools.

## Assets Browser (S03)

**Arrastrar recursos (S01-G001–G003):** el emisor de Assets y los receptores comparten validación por tipo e identificador existente. Los slots de imagen/icono, scripts, terreno e Inspector conservan sus funciones. Los editores especializados de materiales, shaders de superficie, VFX y UI Designer aceptan tipos compatibles mediante el receptor común; las propiedades del UI Designer y audio de eventos que almacenan nombres mantienen ese contrato. La prueba de integración general del Sprint S01 (G004) continúa **pendiente planificada**.

El panel Assets ofrece **lista compacta** (predeterminada) y **cuadrícula**, ordenación por nombre o tipo, búsqueda, rutas navegables, árbol de carpetas, selección múltiple y menú contextual. Conserva el arrastre de recursos a Inspector, Scene Tree y viewport. El control de tamaño se muestra en cuadrícula.

Los proyectos nuevos solo declaran inicialmente `Assets/` y `Assets/Scenes/`; los recursos de interfaz nativos se generan donde corresponde. Importar en `Assets/` respeta esa ubicación en vez de generar una carpeta por tipo. Las carpetas de proyectos existentes se preservan al abrirlos y las rutas necesarias se crean cuando aparece un recurso.

> **Estado del agua:** las secciones siguientes sobre el agua original describen el sistema restaurado, marcado Deprecated. No representan una integración activa de Century Fluids. Consulta [Agua y fluidos](#/agua) antes de aplicar los procedimientos. La verificación integral del sistema restaurado continúa pendiente.

### Hidrología física por capas de Terrain (S06)

En **Terreno → Capas de pintura**, cuando la escena tiene una región de agua física activada,
se puede activar **Hidrología física en las regiones de Terrain**. Cada capa admite cuatro
propiedades opcionales y explícitas: **Infiltración** (mm/h), **Retención** (mm),
**Saturación inicial** (0–1) y **Drenaje** (mm/h). Los perfiles no se deducen del
nombre ni de la textura de la capa. Las escenas anteriores siguen sin hidrología.

La pintura se interpola a las celdas de la región física (máximo **4096 celdas** por
escena); el agua de lluvia entra una sola vez al solver, pasa de superficie a suelo
según capacidad y velocidad y el exceso queda disponible para la escorrentía por
`WaterRegion`. El drenaje configurado es una **salida externa contabilizada**.
El agua del suelo permanece bajo autoridad de `WaterWorld`, también en snapshots.

El aspecto oscuro del terreno en estas regiones deriva del nivel local de saturación;
los charcos visibles son superficie real de `WaterRegion`, no otro volumen ni un
shader que aporte agua. Las zonas sin región física conservan el render anterior.
Este Sprint no cubre tejados, otros objetos 3D, el sonido de impactos, recipientes,
ni transferencias automáticas con cuerpos de agua heredados. Esas funciones están
planificadas para S07–S10.

### Agua física sobre geometría (S07)

El editor conserva los paneles existentes. En Terrain puedes habilitar el escurrimiento por escena. Los recursos `.material` y los materiales locales permiten ajustar retención (mm) y velocidad de escurrimiento (m/s). La simulación utiliza la región física de agua en Play y el material asignado a la superficie; no crea otro sistema de partículas ni otro volumen. En materiales compartidos, modificar el recurso afecta a sus usuarios; la edición se registra mediante el historial de materiales habitual.

### Recursos VFX en Inspector (LF-VFX-INSPECTOR-S01-G001)

Seleccionar un `.vfx` en Assets abre su definición compartida en el Inspector de recursos, sin ventana flotante. Edita emisión, nacimiento, movimiento, apariencia, texturas por ID y curvas de tamaño/opacidad/color usando los controles originales y Undo/Redo. La vista previa es opcional y usa el viewport del editor temporalmente: al cerrarla se restauran cámara y escena; al cambiar de recurso, pestaña o iniciar Play se libera. Los nodos VFX3D conservan referencias y simulaciones separadas. Los datos heredados `movement.tornadoFlow` se mantienen por compatibilidad, sin control meteorológico nuevo en S01; transición World/scripting pendiente de S02.


---

## escenas.md

# Escenas y nodos

Century Engine sigue una arquitectura de **nodos**, no ECS. Cada tipo implementa una responsabilidad y puede organizarse como hijo de otros nodos.

## Node y Node3D

`Node` almacena identidad, nombre y jerarquía; **no** tiene transformaciones espaciales. `Node3D` añade posición, rotación y escala, y puede transmitir transformaciones a sus descendientes. La escala de algunas primitivas antiguas sigue siendo tamaño visual propio, por lo que no debe suponerse el mismo comportamiento en cada tipo.

## Escenas instanciables (G001)

Una **escena** es un recurso en `Assets/Scenes` que puede contener un árbol de nodos. Crea una escena vacía `Casa`, añade mallas, cuerpos físicos y scripts; vuelve a la escena `Mundo` y arrastra `Casa` desde Assets al viewport o a la jerarquía. En la cabecera de **Jerarquía** utiliza el botón **Instanciar escena** (icono de escena), separado de **+ Añadir nodo**. Busca una escena por nombre o carpeta, selecciónala y confirma: la nueva instancia se crea en la raíz y queda seleccionada. Para incluirla dentro de un padre concreto, haz clic derecho sobre ese nodo y elige **Instanciar escena hija…**. También puedes arrastrar la escena desde Assets al viewport o a la Jerarquía. Puedes abrir el mismo selector en cualquier área del Editor mediante **Ctrl + Shift + A**, aunque la Jerarquía esté oculta. **Shift + A** sigue añadiendo nodos y **Ctrl + A** sigue seleccionándolos. En el Inspector de una instancia encontrarás **Abrir escena fuente**; el doble clic sobre su raíz en Jerarquía abre la fuente directamente.

La instancia es un `sceneInstance`, un nodo espacial con transformación propia. Puedes colocar varias copias de `Casa` con posiciones distintas. Sus nodos hijos se generan desde la escena fuente y se muestran para inspección, pero se editan en el recurso original. No hay un sistema de overrides independientes para cada hijo; duplicar un nodo de instancia solo duplica la referencia, no crea otra escena fuente.

Las referencias anidadas se resuelven por árbol y se bloquean los ciclos directos o indirectos. Si una escena referenciada falta o es incompatible, la operación informa un error. El **terreno y las propiedades de ambiente** de una escena fuente no se importan como nodos espaciales: pertenecen al nivel activo, no a cada copia de la casa.

En scripts de Play, `await game.scenes.instantiate('Casa', { position: [x, y, z], parent: game.node('Contenedor') })` crea un subárbol transitorio y devuelve un `NodeHandle`. `game.scenes.destroy(handle)` destruye únicamente ese subárbol temporal. `game.goScene('Mundo')` sigue cambiando el nivel; no instancia objetos. En Play dinámico, los nodos `event`, `navigation`, `liquid` y `terrain` no están admitidos, porque requieren propietarios de nivel adicionales.

**Build:** las escenas referenciadas por instancias colocadas en otras escenas (incluidas referencias transitivas) se incluyen automáticamente como recursos del Player, sin cambiar la escena inicial. Para instanciación puramente dinámica desde scripts, añade la escena fuente a la lista Build si no está referenciada por otra escena; de otro modo el paquete exportado no podrá resolverla.

**Persistencia:** se guardan las referencias autorales y las transformaciones de raíz, no las copias derivadas ni las instancias temporales de Play. Modificar `Casa` se refleja al cargar nuevamente `Mundo`. Para editar un hijo, abre su escena fuente.

## Componer en lugar de acoplar

Para un muro sólido, crea un `StaticBody3D` con `BoxShape3D` y la malla visual adecuada. El cuerpo administra Jolt; la forma define colisión; la malla representa. Para una caja dinámica, utiliza `RigidBody3D`.

## Tipos disponibles

El catálogo incluye geometría, luces, cámaras, audio, áreas, cuerpos físicos, eventos y UI. Consulta la sección **Tipos de nodo** para ver las referencias individuales extraídas del registro.

## Scripts opcionales

Cada nodo puede referenciar varios recursos JavaScript de ejecución Nodo por `scriptIds`. El campo anterior `scriptId` se conserva como lectura de compatibilidad. Su estado es independiente por instancia. Consulta [Scripts asociados a nodos](#/scripts-nodo).

## Guardado y ejecución

El proyecto almacena objetos y recursos; PlayMode crea representaciones y servicios de ejecución para el Editor y el Player. No confundas los marcadores editoriales de cuerpos y formas con geometría exportable.

## Rayos físicos e impactos sobre el mundo (S11)

En **Escena → Clima**, habilita el clima y selecciona una tormenta, **Tipo de rayos: Físicos** y **Impactos físicos sobre el mundo**. Esa última opción está apagada en proyectos anteriores y no se aplica al modo de rayos sencillos.

La descarga utiliza su canal original (FrostEngine/Heidler), ahora con una posición mundial compartida entre render y runtime. El primer contacto compatible con Terrain, geometría estática o agua genera el evento `game.on('lightningImpact', (impact) => { ... })`. `impact` incluye `id`, `seed`, `peakKA`, `kind` (`terrain`, `object` o `water`), `point` `[x,y,z]`, `normal`, `ownerId`, `surface` y `materialId` cuando existen. Los eventos `lightning` y `thunder` permanecen disponibles con su retardo acústico.

Puedes activar **Impulsos Jolt** y configurar **Radio físico (m)** e **Impulso máx. (m/s)**; solo se aplica a cuerpos dinámicos compatibles ya registrados. **Perturbar agua** crea una ondulación de superficie sin añadir volumen. No existe electrocución, daño universal, fuego, electricidad en cables o propagación eléctrica por agua en esta versión.

**Limitaciones:** raycasts de objetos compatibles según el sistema actual de impactos; no garantiza intersección de todas las ramas contra cada malla o cuerpo Jolt. Los canales muy lejanos no se desplazan artificialmente hacia la cámara. Ejecuta QA de Editor y Player antes de considerar los efectos validados visualmente.

## Tornados e interacción física (S12)

En **Escena → Clima**, activa el clima y **Tornado en escena**. Configura centro X/Y/Z, radio, altura, intensidad tangencial (m/s), duración, rumbo y velocidad de desplazamiento. Un tornado por escena usa el paso físico fijo y el mismo `World` meteorológico que el viento y los rayos. Si no se habilita, el comportamiento histórico no cambia.

Para desplazar objetos físicos, activa **Afectar cuerpos Jolt**; se aplican impulsos limitados a `RigidBody3D` compatibles, mientras que los estáticos y las entidades gobernadas por Timeline no reciben esa fuerza. **Afectar jugador FPS** habilita una deriva separada de su cápsula Jolt, sin sustituir el controlador de movimiento. Ambos ajustes son optativos.

**Columna visual:** crea o reutiliza un recurso `.vfx` en Assets. En el Inspector de ese recurso selecciona **Espacio Mundo**. Los proyectos antiguos que ya tienen `movement.tornadoFlow` continúan funcionando; su control de autoría meteorológica fue retirado del `.vfx` en S01. La vinculación automática desde World/scripting para nuevos tornados queda pendiente de S02. Asígnalo a un nodo `VFX3D` existente; después elige ese nodo en el campo **Emisor VFX3D del tornado** de Clima. El VFX no genera física ni partículas fuera de su nodo; cada instancia tiene su propia simulación. No se crea un tornado visual automáticamente si falta esta referencia. La posición original del emisor se restaura al detener Play.

Scripts: `game.on('tornadoStart', callback)`, `game.on('tornadoEnter', callback)`, `game.on('tornadoExit', callback)`, `game.on('tornadoEnd', callback)`. Los eventos contienen ID, posición mundial, dimensiones, edad y `objectId` cuando procede. No se aplica daño automático a enemigos ni destrucción de edificios. El sistema de agua y sus volúmenes permanecen intactos.

## Tornado destructivo: árboles, agua y brasas (S12A)

En **Escena → Clima** habilita el tornado de S12 y, expresamente, las nuevas funciones de **vegetación destructible**, **agua suspendida** y **combustión** que necesites. El campo tridimensional de `WindField` es único; los tres efectos reaccionan a su intensidad y posición.

En **Terrain → Vegetación**, configura por tipo **Destructible**, resistencia de raíz y tronco (newtons), **Combustible** y humedad. Los árboles permanecen en sus instancias optimizadas mientras la fuerza no supera sus límites. Cuando se desprenden durante Play, pasan a cuerpos Jolt acotados y la instancia original deja de dibujarse. Las formas procedurales compatibles admiten separación tronco/copa; una malla importada arbitraria no se fractura automáticamente.

Para agua levantada, selecciona un cuerpo de agua bajo el tornado y activa el transporte físico. Una región simulada descuenta de su inventario el agua suspendida; los cuerpos tradicionales actúan como fronteras externas. El agua vuelve a regiones compatibles o se registra como salida. El volumen y su conservación no dependen de partículas visibles.

En el Inspector de nodos compatibles, la sección **Combustión meteorológica** controla si puede arder, humedad, umbral térmico e ignición inicial. Los impactos físicos de rayo pueden encender fuentes cercanas. Lluvia, agua física y depósitos de agua suspendida pueden enfriar fuentes encendidas. El fuego se calcula mediante fuentes térmicas y brasas limitadas; no es incendio volumétrico de cualquier malla.

Los efectos visuales de agua y brasas deben vincularse a **VFX3D** existentes, con recursos `.vfx` reutilizables. Si el estado físico está inactivo, no se generan nuevas partículas del efecto condicionado. Sin recurso asignado no aparece un emisor global de sustitución. Los efectos no representan un sistema de inventario líquido alternativo.

**Límites:** máximo 64 paquetes de agua suspendida, 64 focos térmicos, 96 brasas y presupuesto configurado de árboles desprendidos. No hay CFD, fractura universal de edificios ni fuego realista sobre superficies no configuradas. Guarda y vuelve a abrir el proyecto; comprueba Play/Stop, Player y Film Maker en QA local.


---

## eventos.md

# Eventos y Event Order Flow

Los nodos **Evento** contienen páginas y comandos. La ejecución visual de eventos es distinta del scripting asociado a nodos. La refactorización de arquitectura Node3D preserva su intérprete y sus señales.

## Páginas y condiciones

Cada página define condiciones para estar activa y una lista ordenada de comandos. Los comandos se ejecutan secuencialmente; algunos esperan diálogo, señal, cinemática o entrada del jugador antes de continuar.

## Orden y reentrada

Event Order Flow controla la selección y ejecución de las páginas. Un cambio de página no debe dejar el movimiento bloqueado ni mantener comandos obsoletos. La coordinación de `game.update`, `game.fixedUpdate` y la física pertenece al runtime del juego y **no es lo mismo** que el orden interno de páginas.

## Comandos

La referencia de **66 comandos** se genera desde `src/engine/runtime/events/commandDefs.js`. Incluye identificador, descripción, parámetros, valores por defecto y equivalente de script cuando existe.

## Señales y comandos avanzados

Los comandos permiten emitir o esperar señales, ejecutar otro evento y construir bloques de control. Consulta [Comandos de evento](#/comandos-intro) y busca `signal`, `waitSignal`, `match` o `runEvent`.

## Comandos y API JavaScript

No todos los comandos tienen equivalente directo en script. Cuando existe, la referencia indica la llamada ilustrativa correspondiente y enlaza a la API.

## Edición segura

Las páginas, condiciones, intérprete y comandos del runtime no han sido rediseñados por este portal. La documentación describe el baseline, no promete nuevos controles.


---

## exportacion.md

# Exportación y Player

La exportación de Century Engine produce un ejecutable que usa el runtime del motor, no el editor completo. El Player reutiliza `PlayMode` y las mismas rutas de scripting y física utilizadas durante la reproducción en el editor.

## Preparar un juego

1. Guarda el proyecto.
2. Configura el GameManager, el Spawn o una cámara principal según el tipo de juego.
3. Abre **Archivo → Exportar juego**.
4. Selecciona las escenas que se incluirán y su orden inicial.
5. Revisa los avisos del Build y ejecuta la exportación.

## Plataformas

El baseline incluye exportación integrada de AppImage para Linux. Las opciones de otras plataformas dependen de los mecanismos implementados y no deben darse por habilitadas sin comprobar la ventana Build de la versión instalada.

## Player y pruebas

Comprueba en el ejecutable independiente lo mismo que verificaste en PlayMode: referencias de escena, recursos, audio, scripts, cuerpos físicos, Input Map y guardados.

## Diferencia respecto a empaquetar el editor

Los objetivos de distribución del Editor en `package.json` no implican automáticamente los mismos destinos de exportación para juegos. Consulta las opciones reales del diálogo Build.


---

## fisica.md

# Física y colisiones

Century Engine utiliza **Jolt Physics WASM**. Los cuerpos y las formas se representan mediante nodos especializados en el árbol.

## StaticBody3D

Representa colisión estática. Puede agrupar una o varias `CollisionShape3D` como hijas, sin necesidad de que la malla visual participe en física.

## RigidBody3D

Cuerpo dinámico con masa, gravedad, amortiguación, fricción y restitución. La simulación calcula su movimiento; las mallas visuales descendientes se sincronizan.

## CharacterBody3D

Cuerpo para movimiento controlado, basado en personajes virtuales de Jolt. Ofrece velocidad, deslizamiento, consulta de suelo/pared/techo, pendientes y opciones de escalón. No es un controlador FPS obligatorio.

### Control desde un Script de Nodo (S16-G003)

Un Script de Nodo asignado a `CharacterBody3D` puede usar `node.velocity = [vx, vy, vz]` (m/s). `node.velocity` devuelve una copia de la velocidad efectiva del cuerpo, y `node.ground` indica `stable`, `steep` o `air`. Las consultas de solo lectura `node.onFloor`, `node.onWall` y `node.onCeiling` reflejan el último paso físico. No hay que seleccionar el nodo durante Play.

```js
function _physics_process(delta) {
  const [vx, vy, vz] = node.velocity
  node.velocity = [1, vy, vz]
  if (node.onFloor) console.log('En suelo')
}
```

El ejemplo solo demuestra el acceso a la velocidad; no es una locomoción FPS terminada. El callback se ejecuta antes de Jolt y el movimiento físico se resuelve en su paso existente. La gravedad vertical se aplica por el propietario `NodeSpatialRuntime`. Los valores modificados durante Play no reemplazan las propiedades guardadas del nodo.

Estas propiedades están disponibles únicamente para un `CharacterBody3D` con cuerpo Jolt activo. Si falta la forma física, el cuerpo está inactivo, la escena cambió o el handle dejó de ser válido, la operación informa un error. La API no crea un jugador FPS, no modifica `game.player` y no duplica el controlador heredado. **NGM Runtime** es el entorno de ejecución independiente, no el personaje FPS.

## Area3D

Sensor de solapamientos. Detecta entradas y salidas de cuerpos y otras áreas; no bloquea el movimiento como un cuerpo sólido. La API interna de notificaciones existe, pero no debe confundirse con los comandos tradicionales de evento.

## Formas

Las entradas del catálogo son **BoxShape3D**, **SphereShape3D**, **CapsuleShape3D** y **TriMeshShape3D**. Internamente usan el mismo nodo `collisionshape3d` con un recurso de forma diferente. Deben ser hijas directas de un cuerpo o área compatible. Las escalas degeneradas se rechazan.

### Ajustar BoxShape3D a una primitiva o malla

Si `StaticBody3D` incluye una primitiva o malla editable y añades una nueva `BoxShape3D`, la forma puede tomar automáticamente la envolvente y el centro de la geometría visual. En el Inspector de `CollisionShape3D`, marca **Autoajuste a geometría** para mantener sus dimensiones o pulsa **Ajustar a geometría** para recalcular solo una vez. Editar tamaño o posición manualmente desactiva el seguimiento. El sistema no cambia la escala del cuerpo ni duplica colisiones.

> Las formas de proyectos antiguos conservan sus tamaños manuales, incluso cuando se muestran como `1 × 1 × 1 m`. Si no hay geometría válida, la caja conserva sus dimensiones.

`TriMeshShape3D` es distinta de Box: sigue triángulos de una primitiva o malla editable y solo está admitida bajo `StaticBody3D`. Para objetos dinámicos, utiliza formas convexas. Una caja de autoajuste sigue siendo una envolvente aproximada.

## Orden de actualización

El ciclo físico lo coordina PlayMode y Jolt avanza durante el paso fijo. No hay otro mundo físico por cada cuerpo. El juego exportado reutiliza ese runtime; las pruebas con Jolt WASM real y Player deben verificarse en cada plataforma.

## Relación con eventos

La API `game.physics` y los cuerpos especiales de gameplay son parte del runtime existente. Las páginas, condiciones y comandos del Event Order Flow siguen siendo un sistema distinto.

> **Estado del agua:** las secciones siguientes sobre el agua original describen el sistema restaurado, marcado Deprecated. No representan una integración activa de Century Fluids. Consulta [Agua y fluidos](#/agua) antes de aplicar los procedimientos. La verificación integral del sistema restaurado continúa pendiente.

## Acoplamiento hidráulico (S09)

Las regiones de agua física pueden enlazarse expresamente desde **Terrain → Agua física → Conexiones hidráulicas**. Primero activa simulación, crea las regiones compatibles y selecciona un origen y destino. Cada puerto tiene sección en m², coeficiente, caudal máximo en m³/s y sentido de flujo. Las entradas y salidas de un cuerpo de agua heredado se contabilizan como flujos externos, porque ese cuerpo no tiene un volumen físico finito.

Los nodos **Lago / piscina** y **Río** crean automáticamente una región física en Editor y Play. La forma del nodo determina el agua inicial; el fondo procede de Terrain cuando existe. Sobre terreno se reserva un margen de dos pasos de autoría alrededor de la huella para que el agua pueda avanzar sobre suelo seco. Ese margen se reduce cerca de otros dominios. Sin terreno se conserva el fondo parametrizado y la huella original. Para un dominio mayor o conexiones entre regiones, configura regiones explícitas desde Terrain y asigna **Dominio físico** en el Inspector de Agua. El océano utiliza olas espectrales y rompientes costeras; no se convierte en una cuadrícula finita del tamaño del mar.

Una región de Terrain vacía que se asocia automáticamente a un lago o río recibe el agua inicial de ese nodo. Esto evita que añadir un lago dentro de una región vacía lo haga desaparecer al entrar en Play. Si asignas **Dominio físico** explícitamente, prevalece el inventario de la región, incluido empezar seca. Una profundidad inicial manual positiva conserva su volumen.

El agua comparte el núcleo `src/engine/runtime/fluids`: profundidad, momento, gravedad, caras impermeables y balance de volumen. El render, la natación y la flotación consultan el mismo `WaterWorld`. La simulación avanza durante el paso físico fijo y el juego exportado utiliza el mismo código.

Los cuerpos Jolt dinámicos compatibles desplazan agua mediante su geometría sumergida, incluidas cajas orientadas, esferas y cápsulas. Se recorta su intersección con cada región aunque el centro del cuerpo esté fuera. Las formas compuestas o de malla no disponen de este acoplamiento. Los colliders estáticos se registran antes de muestrear las barreras; los dinámicos se excluyen de ese muestreo. Al mover, desactivar o eliminar nodos estáticos, las barreras y la cobertura de lluvia se actualizan cada medio segundo, incluso con escurrimiento desactivado. Los cambios del nivel de agua también actualizan las caras afectadas, con invalidación cada 10 cm o al pasar de seco a mojado. Esa discretización solo decide cuándo repetir raycasts; no cuantiza el estado del fluido. Los puentes por encima de la columna de agua no actúan como paredes.

**Alcance:** aguas someras en una cuadrícula horizontal (2.5D), con un máximo compartido de 4096 celdas. Las caras sólidas muestreadas son impermeables; todavía no representan el desborde por encima de una pared baja. La ocupación dinámica es una aproximación por columnas, limitada a 64 sólidos, no resuelve presión volumétrica alrededor de cuerpos sumergidos ni mezcla de líquidos. El borde del dominio sigue siendo cerrado salvo configuración explícita. Esta cuadrícula no simula cascadas libres ni cavidades. Los recipientes utilizan un dominio de partículas separado, conectado al inventario de WaterWorld. Los cambios de geometría del dominio pueden hacer incompatibles las partidas guardadas con la discretización anterior.

## Recipientes de fluido

En **Añadir / Shift+A → Utilería** elige **Recipiente · taza**, **Recipiente · botella** o **Recipiente · depósito**. El Inspector permite cambiar las dimensiones interiores en metros, la cantidad inicial en litros, el líquido, la calidad y el cierre del envase. En botellas puedes ajustar también la boca. La capacidad procede de la forma interior, incluido el estrechamiento del cuello.

El nodo incluye un envase de referencia. Puedes ocultarlo y añadir tu modelo como hijo. Para moverlo mediante física, coloca el recipiente como hijo de un `RigidBody3D` con sus colliders. La forma interior del líquido sigue siendo la configurada en el Inspector; no se deduce de la malla artística.

En Play, el líquido se simula mediante partículas MLS-MPM, adaptadas de **Splash (MIT)** para funcionar en CPU con el renderer WebGL existente. La superficie volumétrica se reconstruye con esas mismas partículas. Responde a gravedad, movimiento, inclinación y paredes; una botella cerrada retiene su contenido. Al salir por la boca, el volumen pasa a partículas libres que pueden entrar en otro recipiente compatible, alcanzar agua exterior o formar un derrame físico sobre suelo sólido. El guardado incluye partículas, velocidades y derrames. Stop restaura la cantidad inicial del proyecto.

En Assets puedes crear perfiles **Líquido (.liquid)** con densidad, viscosidad relativa, color y opacidad. Elige el perfil desde **Contenido** en el Inspector. Las sustancias distintas mantienen inventarios separados y no se mezclan.

Los recipientes antiguos configurados en `Node3D` y `RigidBody3D` mantienen su modelo analítico compatible. Para usar partículas crea el nuevo nodo de Utilería.

**Límites actuales:** hasta 8 recipientes de partículas activos, con presupuestos de 256, 512 o 1024 partículas por envase según calidad. Las formas interiores son caja, taza elíptica y botella con cuello. Es una simulación aproximada y acotada: la reconstrucción suaviza el líquido y puede desviarse de la forma exacta de la pared. No incluye mezcla de sustancias, tensión superficial calibrada, espuma volumétrica ni fuerzas de reacción del líquido sobre el cuerpo padre. Los derrames comparten el límite de 32 regiones / 4096 celdas; si se agota el presupuesto de charcos, el líquido apoyado sigue representado por partículas. El volumen que abandona el ámbito simulado se registra en el balance externo.

## Mar y superficie de ríos

El mar utiliza el FFT de cuatro cascadas de **Ultra Water (MIT)**. El terreno alimenta mapas de batimetría, propagación y abrigo para que las olas frenen cerca de la costa, rompan y produzcan espuma y avance / retroceso de la lámina sobre la orilla. Una malla polar centrada en la cámara mantiene detalle cerca del observador en océanos grandes. Se conserva la iluminación PBR del motor.

Las consultas de natación y flotación del mar leen la misma función de superficie GPU mediante un campo asíncrono de 48 × 48 muestras alrededor de la cámara, con alcance de 24 a 96 metros. Fuera de ese campo se utiliza el nivel medio del mar. Hay un pequeño retardo de lectura y la interpolación no representa cada ondulación fina. El mar es un depósito exterior, no un inventario finito de partículas; su masa no se suma a la de una taza.

Los lagos y ríos conservan su solver de profundidad, corriente, obstáculos y volumen. Reciben el detalle espectral de normales; ese detalle no sustituye ni mueve artificialmente la superficie física de su cuadrícula. Las conexiones hidráulicas explícitas permiten alimentar y drenar regiones. El oleaje espectral comparte un espectro de viento por escena; cada nodo controla su amplitud y las rompientes.

Las licencias MIT y las revisiones utilizadas se incluyen en `public/licenses/fluids` y en el módulo `runtime/fluids/vendor`.


---

## graficos.md

# Gráficos y materiales

Century Engine utiliza **Three.js** como base de renderizado. El editor ofrece materiales PBR, iluminación, entornos, postprocesado, edición de mallas y herramientas de geometría.

## Geometría

El catálogo permite primitivas, mallas editables, modelos y objetos especializados. **Edit Mesh** soporta operaciones geométricas desarrolladas en los Gates de mallas (vértices, aristas, caras, Fill, extrusión y herramientas numéricas). No sustituye a un modelador externo completo.

## Materiales PBR

El Inspector expone propiedades como color, rugosidad, metalicidad, opacidad y otras opciones físicas del material cuando corresponda. Los materiales compartidos se referencian por ID y se editan desde Assets. [Shader Graph](#/shader-graph) sigue siendo un editor especializado.

## Luces y sombras

Las luces contienen propiedades propias de iluminación. Las sombras y el resultado dependen de la configuración de render de la escena; la geometría visual no administra cuerpos físicos.

## Postproceso

Los perfiles `.post` permiten configurar efectos y previsualizarlos desde el Inspector. La cámara/Spawn/GameManager determina el perfil efectivo según contexto.

## Compatibilidad de recursos

La calidad visual y el rendimiento deben validarse en el hardware de destino. La documentación no garantiza resultados idénticos entre Electron y el Player.


> **Estado del agua:** las secciones siguientes sobre el agua original describen el sistema restaurado, marcado Deprecated. No representan una integración activa de Century Fluids. Consulta [Agua y fluidos](#/agua) antes de aplicar los procedimientos. La verificación integral del sistema restaurado continúa pendiente.

## Agua física — arquitectura de líquidos (S05)

Las regiones finitas usan `WaterWorld` y `WaterRegion` como fuente única de volumen; el shader, las gotas GPU y las salpicaduras **no agregan líquido por sí mismos**. La lluvia sobre regiones habilitadas se encola en `WaterWorld` una vez por paso de simulación. El agua de océanos, ríos y lagos heredados continúa como superficie visual consultable, **no** como depósito finito simulado.

La API de programación `WaterWorld.transferVolume(origen,destino,volumenM3,id?)` permite transferencias explícitas entre celdas válidas de regiones físicas (`{id,col,row}`) conservando masa. No configura automáticamente conexiones entre ríos ni superficies: aún no hay UI para diseñar un circuito hidráulico. `liquidBalance()` informa m³ recibidos, drenados, perdidos por bordes y transferidos internamente. Las snapshots nuevas son v2 y las anteriores v1 siguen siendo legibles.

**Pendiente:** infiltración por materiales, escorrentía sobre objetos, sonido de impacto por material, cuerpos de agua conectados hidráulicamente y líquidos contenidos en recipientes. Consultar `docs/architecture/LF-WATER-LIQUID-CA-001.md` y el QA S05.

## Lluvia y escurrimiento físico sobre superficies 3D (S07)

Dentro de **Terrain**, activa Agua física y luego **Escurrimiento sobre geometría 3D estática**. Debe existir una región física bajo la cubierta. En el Inspector de un material local o recurso `.material`, abre **Escurrimiento de lluvia (agua física)** y habilita su participación. Configura **Retención (mm)** y **Escurrimiento (m/s)**. Los perfiles son optativos: no se asignan por el color o el nombre del material.

La lluvia que golpea una cubierta compatible se contabiliza dentro de `WaterWorld` y puede recorrer las celdas de la cubierta hasta un borde, entrar en la región de Terrain y allí infiltrarse según S06. Los bordes exteriores de la región se registran como salidas del dominio. Las gotas visibles no suman agua por separado. Las cubiertas anteriores sin perfil permanecen como obstáculos de la lluvia, sin introducirles un depósito físico implícito.

**Limitaciones:** solo geometría estática superior que pueda muestrearse dentro de las regiones físicas de Terrain, a escala de celda (máximo 4096 por escena). No modela todavía lluvia sobre superficies dinámicas, películas renderizadas sobre techos, canaletas 3D complejas, charcos independientes en objetos, audio acústico de impactos, paredes verticales o recipientes.

### Movimiento VFX por viento de tornado (S12)

**Compatibilidad temporal S01/CA-001:** los recursos heredados conservan internamente `movement.tornadoFlow` cuando estaban configurados para Vórtice meteorológico, con espacio **Mundo**. No aparece una casilla meteorológica dentro del Inspector `.vfx`: su definición continúa siendo visual y los valores legacy no se borran. El reemplazo por control desde `World` y scripting corresponde a S02 PENDIENTE PLANIFICADO. El efecto VFX3D existente sigue usando el presupuesto de partículas del motor.

### VFX3D meteorológico condicionado (S12A)

Las partículas de agua suspendida y brasas se visualizan desde el nodo **VFX3D** asignado al tornado; deben estar respaldadas por recursos `.vfx` reutilizables. El runtime modifica exclusivamente la posición y la activación de emisión durante Play. Cuando no hay agua suspendida o combustión activa, se dejan de emitir partículas nuevas, pero las partículas anteriores continúan envejeciendo y desaparecen según su vida. Al terminar Play se restaura la transformación y activación originales. Ninguna partícula modifica por sí misma los inventarios físicos.

### Edición de recursos `.vfx` en Inspector (S01)

Selecciona un recurso `.vfx` desde Assets con un clic: **Emisión, Nacimiento, Movimiento, Apariencia y Evolución** se editan en el Inspector derecho. El doble clic enfoca el mismo recurso. Texturas se asignan desde el slot de Assets; curvas, campos y cambios conservan Undo/Redo. **Vista previa** es opcional: empieza solo al pulsarla y utiliza el viewport actual, sin ventana VFX. Al cerrarla o cambiar escena/recurso/Play se restaura la cámara. La simulación visual sigue perteneciendo al nodo VFX3D en ejecución.


---

## inicio.md

# Documentación de Century Engine

Century Engine es un editor y motor 3D para crear juegos con **escenas, nodos, recursos, eventos y JavaScript**. Esta documentación describe la versión **0.26.13** del baseline de desarrollo actual.

> Esta es documentación de una versión en desarrollo. Una API documentada no implica que todas las rutas de exportación o hardware estén validadas. Consulta las limitaciones y el QA del proyecto.

## Elige tu punto de partida

| Necesitas | Empieza por |
|---|---|
| Abrir un proyecto y orientarte | [Primeros pasos](#/primeros-pasos) |
| Conocer paneles y herramientas | [Manual del editor](#/editor) |
| Crear jerarquías de nodos | [Escenas y nodos](#/escenas) |
| Programar comportamientos | [Scripts por nodo](#/scripts-nodo), [IntelliSense](#/intellisense) y [propiedades editables](#/propiedades-editables) |
| Configurar controles | [Preferencias](#/preferencias) |
| Evaluar rendimiento | [Optimización](#/optimizacion) |
| Usar la API JavaScript | [Referencia de API](#/api-intro) |
| Construir eventos narrativos | [Event Order Flow](#/eventos) y [comandos](#/comandos-intro) |
| Crear colisiones | [Física y cuerpos](#/fisica) |
| Generar una aplicación | [Exportación](#/exportacion) |
| Registrar versiones y colaborar | [Control de versiones Git](#/vcs-intro) |

## Dos modos de desarrollar

**Eventos visuales:** las páginas del nodo Evento ejecutan comandos en un orden determinado, con condiciones, señales y ramas. Ideales para interacción y narrativa.

**JavaScript:** los scripts globales actúan a nivel del juego; los scripts de nodo se asocian a una instancia concreta y utilizan callbacks de ciclo de vida. Ambos utilizan la API `game` en sus contextos correspondientes.

## Convenciones de lectura

Las rutas de código que aparecen al final de algunas referencias son **fuentes de verdad** del baseline. Los ejemplos requieren adaptar nombres de escenas, recursos y nodos al proyecto. No confundas un nombre de tipo físico con un comando de evento.

## Esta versión

La referencia de comandos se obtiene de `commandDefs.js`; la API de `game` y `node` procede de `game-api.d.ts`. La navegación funciona **sin Internet**, incluso si abres `index.html` desde una carpeta local.


---

## inspector.md

# Inspector

El Inspector presenta controles contextuales: no muestra propiedades físicas en mallas visuales ni Transform en `Node`.

## Estructura general

- **Identificación:** nombre y tipo del nodo.
- **Transform:** solamente nodos 3D.
- **Propiedades del nodo:** física, forma, luz, material, etc., según el registro.
- **Scripts:** agregar recursos desde Assets, reordenar sus asignaciones y quitarlas. El botón de cada Script de Nodo abre el archivo en el editor de código integrado. La creación y el renombrado se realizan en Assets.

## Cuerpos físicos

`StaticBody3D` ofrece parámetros de fricción y restitución. `RigidBody3D` añade masa, gravedad, amortiguación y sueño. `CharacterBody3D` expone velocidad, pendientes, escalones y gravedad. `Area3D` tiene monitorización y detección. Las formas Box/Sphere/Capsule administran sus dimensiones.

## Arrastrar recursos desde Assets (S01-G002)

En el Inspector, arrastra una **textura** a `Decal → Textura`, un **clip de audio** a `Audio Source → Clip` o un **perfil `.post`** a los campos Perfil de Cámara, Spawn o PostProcessVolume. El campo se resalta discretamente cuando pasas el recurso por encima y comprueba su ID y tipo antes de asignarlo.

Los selectores siguen disponibles para trabajar con teclado, reemplazar o quitar el recurso. Un recurso de otro tipo, una selección múltiple o una entrada eliminada no sustituyen el valor. Las referencias se guardan por ID y siguen siendo válidas tras mover o renombrar el recurso. Undo/Redo utiliza el historial normal del Inspector.

**S01-G003 — Editores especializados:** Materiales acepta `.material`; Shader de material acepta shaders de superficie (no post); textura de superficie y VFX aceptan imágenes compatibles; VFX3D recibe `.vfx`; UI Designer recibe imágenes, retratos y sonidos. `ParamForm` admite textura, audio, modelo, prefab y perfil según el tipo de campo. El Shader Graph sigue ligado al material existente, sin otro receptor paralelo. El drag-and-drop conserva el formato nominal en campos `.ui` y eventos de audio que ya guardaban nombres. G004 (QA de integración del Sprint) sigue pendiente.

## Recursos

Los recursos `.material`, `.post` y GameManager se editan desde el Inspector mediante referencias por ID. Los cambios confirmados se integran en Undo/Redo. Shader Graph conserva su editor dedicado.

## Buenas prácticas

Cambia un valor, observa el viewport y confirma una sola operación de historial por gesto. Si faltan campos, verifica el tipo seleccionado. No atribuyas física automáticamente a una malla visual.


---

## mesh-edit.md

# Edit Mesh

Las herramientas de edición de malla trabajan sobre la geometría del objeto seleccionado, diferenciando las operaciones de objeto de las operaciones de vértices, aristas y caras.

## Barra contextual de Edit Mesh (Sprint S02)

Al entrar en **Edit Mesh** con `Tab`, la barra superior cambia de las herramientas del objeto a las de geometría. Deja de mostrar los gizmos de objetos y los pinceles de carretera/terreno; en su lugar aparecen:

- **Vértices (1), Aristas (2), Caras (3):** selección contextual. El modo activo queda resaltado.
- **Mover (G), Rotar (R), Escalar (S):** transformación de la geometría seleccionada, no del nodo completo.
- **Acciones rápidas según modo:** vértices (bisel de vértices, fusionar), aristas (bisel, corte en bucle), caras (extruir, inset). Las acciones que requieren selección quedan inactivas si no existe; el corte en bucle comienza por la posición del cursor.
- **X-ray (Alt+Z), Proporcional (O), Simetría X:** mismos comandos y estado que las opciones del panel Malla.
- **Espacio global/local y Snap:** controles existentes; la pulsación Shift para suspender temporalmente Snap del gizmo **no aplica** a operaciones de malla.
- **Herramientas:** abre el panel derecho **Malla**, que conserva el catálogo completo y los parámetros numéricos. **Salir** o `Tab` vuelve a las herramientas de objetos.

**Añadir** en Edit Mesh usa el menú existente de inserción de geometría; no crea un objeto de escena nuevo. En pantallas estrechas las acciones rápidas muestran iconos y nombres accesibles y la barra permite desplazamiento horizontal. Si hay una operación modal activa, los comandos incompatibles se desactivan; confirma/cancela primero el gesto actual.

El cambio es de interfaz, no altera `PolyMesh`, la geometría serializada ni el comportamiento de las operaciones. Se requiere QA visual en Electron para confirmar que los controles son visibles y accesibles en cada resolución.

## Operaciones

Se incluyen herramientas para selección y edición de vértices, aristas y caras; Fill, extrusión, cortes y transformaciones numéricas. La primitiva Vértice permite comenzar desde topología vacía y construir superficies mediante PolyShape.

## Instancias y recursos

**Ctrl+D** duplica nodos; **Alt+D** permite duplicación vinculada de malla, donde los duplicados comparten una referencia de geometría. Se puede volver una malla independiente mediante el comando correspondiente. La duplicación vinculada se diferencia de copiar/pegar.

## Snap

Utiliza las opciones del panel de edición para configurar el ajuste. Las correcciones de Snap deben validarse en tiempo real con el modo de edición activo.

## Materiales y UV

Las mallas guardan datos geométricos y UV de los recursos. Los cambios de geometría no deberían alterar materiales compartidos ajenos a la operación.

## Límites

Las operaciones de construcción geométrica requieren QA visual y pruebas de triangulación/guardado; no toda topología degenerada puede convertirse en una superficie válida.

## Añadir geometría con Shift+A

En **modo objeto**, `Shift+A` → **Primitivas** crea Cubo, Plano, Cilindro, Cono, Esfera, Rampa y Escalera. Para iniciar una malla de construcción desde cero, abre `Shift+A` → **Herramientas de modelado**: Vértice, Rejilla, Círculo y Toro. Esas cuatro opciones generan nodos `mesh` reales; Vértice conserva la entrada automática a Edit Mesh. La antigua categoría duplicada «Malla editable» ya no aparece en este menú.

En **Edit Mesh**, `Shift+A` sigue mostrando el catálogo completo de geometrías que se añaden a la malla seleccionada. Esta limpieza de menús no convierte ni elimina los nodos `mesh` existentes, y no cambia los atajos de modelado.

## Bisel de vértices y aristas de contorno (LF-MESH-BEVEL-VERTEX-CORR-G001)

En **Edit Mesh**, el redondeado modifica **vértices y caras reales** de `PolyMesh`:

- **Bisel de aristas (`Ctrl+B`)**: selecciona aristas en modo arista (`2`) o caras en modo cara (`3`). Reutiliza el bisel existente para aristas interiores compartidas por dos caras. También acepta **aristas abiertas de caras aisladas** de cuatro o más vértices, seleccionadas sin ramificaciones, y genera una transición por segmentos sin cerrar la superficie. Las aristas de contorno conectadas a múltiples caras se rechazan con un mensaje: no se crean uniones T ni se altera el proyecto.
- **Bisel de vértices (`Ctrl+Shift+B`)**: entra en modo vértice (`1`) y selecciona uno o varios vértices de una primitiva o malla editable. Genera curvas sobre las caras y tapones triangulares en esquinas cerradas. Sirve, por ejemplo, para redondear las esquinas de una acera modelada como un bloque sólido. Se rechazan abanicos no manifold y aristas sueltas.
- **Control modal**: arrastra el ratón o escribe una anchura numérica, usa la rueda para los segmentos (1–32), `Enter` para aceptar y `Esc` para cancelar. `Bisel: ancho`, `segmentos` y `perfil` se mantienen en MeshPanel para ambos tipos. Un segmento produce chaflán; varios segmentos generan geometría curva.
- **Persistencia y física**: el mismo flujo de edición de mallas confirma cambios con Undo/Redo y guarda la geometría en `.lfproj`. Si un `TriMeshShape3D` refiere a la malla, consumirá la triangulación actualizada al reconstruirse la física; `BoxShape3D` con autoajuste activado recalcula sus dimensiones a partir de la geometría.

**Limitaciones conocidas:** el bisel de borde abierto se restringe por ahora a caras aisladas. El bisel no es un modificador no destructivo ni implementa todas las combinaciones de esquinas cóncavas, superficies no manifold o bordes de varias caras. Las geometrías de blockout de acera deben tener una topología limpia. El resultado físico en Play/exportación requiere QA con Jolt WASM instalado.


---

## problemas.md

# Solución de problemas

## El nodo no ejecuta su script

Verifica que el script esté en modo **Nodo**, asociado desde el Inspector y que estés en PlayMode. Los scripts no se ejecutan en Edit Mode. Abre Consola para ver excepciones.

## El cuerpo no colisiona

Comprueba que exista un cuerpo `StaticBody3D`, `RigidBody3D` o compatible y que tenga una forma Box/Sphere/Capsule hija directa, habilitada y de dimensiones válidas. Una malla visual no genera colisión automáticamente.

## Un comando de evento no avanza

Comprueba si el comando espera entrada, una señal o un recurso ausente. Revisa las condiciones de la página activa y los mensajes de consola.

## No encuentro una función de API

Busca por nombre en el portal, abre la interfaz correspondiente y confirma la firma publicada desde `game-api.d.ts`. Si es una función planificada pero no declarada, no forma parte de la API de esta versión.

## No veo un nodo CollisionShape3D en el catálogo

Por diseño, el catálogo presenta sus variantes **BoxShape3D**, **SphereShape3D** y **CapsuleShape3D**; son recursos del tipo interno `collisionshape3d`.

## El Player no se comporta igual que PlayMode

Comprueba las escenas incluidas en la exportación, scripts, recursos y plataforma. Las suites Node no prueban render, Jolt WASM ni la interfaz Electron; utiliza un build real para el diagnóstico.

## Git no permite cambiar de rama o descargar cambios

Comprueba que el proyecto está guardado, que Git indica estado limpio y que no hay archivos nuevos sin registrar. Los Pull remotos solo admiten avance rápido; consulta [Solución de problemas Git](#/vcs-problemas).

## La documentación no carga en Electron

Regenera el sitio con `npm run docs:build`, ejecuta `npm run build` y verifica que `dist/docs/index.html` esté presente. En desarrollo el portal es servido desde `public/docs/`.


---

## propiedades-editables.md

# Propiedades editables de scripts

Los recursos JavaScript de ejecución **Nodo** pueden declarar valores que el autor edita desde el Inspector del nodo, sin alterar el código ni compartir el estado entre instancias. La gramática la define `src/engine/runtime/scene/script-editables.js`.

```js
@header("Movimiento")
@header_descripcion("Parámetros de este personaje")
@editable
@editable_description("Velocidad en metros por segundo")
let velocidad = 4.5
@editable
let activo = true
@editable
let mensaje = "Hola"

function _ready() {
  console.log(velocidad, activo, mensaje)
}
```

| Directiva | Función |
|---|---|
| `@header("Título")` | Agrupa las siguientes propiedades. |
| `@header_descripcion("Texto")` | Describe el grupo actual. Requiere un header. |
| `@editable` | Expone una variable del ámbito superior. |
| `@editable_description("Texto")` | Describe una propiedad. También se reconoce la grafía anterior `@editable_descricption`. |

Usa una declaración `let`, `const` o `var` por línea con un literal número finito, booleano o texto. No se admiten objetos, arrays, expresiones calculadas, nombres duplicados ni anotaciones dentro de funciones. Las directivas van en líneas propias y no son decoradores estándar de JavaScript. Code y la versión de fuentes actualizada de la extensión VS Code analizan una proyección de estas líneas para IntelliSense; el documento original no se reescribe.

Asigna el script a un nodo, guarda y edita los valores desde su Inspector. El valor literal es el predeterminado y los valores personalizados pertenecen a la instancia. El runtime prepara los valores antes de ejecutar el recurso Nodo. Consulta [Ciclo de vida y Signals](#/scripts-nodo).


---

## scripts-nodo.md

# Scripts por nodo

Crea un recurso **Script de Nodo** desde **Assets → Crear → Script de Nodo (.js)**. El recurso aparece en Assets con el nombre editable; primero asígnale un nombre. Haz doble clic en el archivo para abrirlo en el editor de código integrado.

Para asignarlo, selecciona el nodo en el árbol. En **Scripts** del Inspector puedes agregar recursos desde el selector o arrastrarlos desde Assets. Cada nodo admite varios Scripts de Nodo y el Inspector permite reordenarlos, abrirlos en el editor integrado y quitar asignaciones conservando los recursos. Los scripts Global se ejecutan por su propia vía. El formato actual guarda la lista `scriptIds` y conserva compatibilidad con el `scriptId` de escenas antiguas.

El script nuevo comienza con `_ready`, `_process` y `_physics_process` vacíos. Los demás callbacks siguen disponibles aunque no aparezcan en la plantilla.

## Ciclo de vida

| Callback | Momento |
|---|---|
| `_enter_tree()` | Nodo agregado a la escena activa; padre antes que hijo |
| `_ready()` | Inicialización; hijos antes que padre |
| `_process(delta)` | Actualización normal del juego |
| `_physics_process(delta)` | Paso físico fijo, antes de Jolt |
| `_exit_tree()` | Nodo retirado, escena cambiada o Play detenido |

```js
let segundos = 0

function _ready() {
  console.log('Nodo:', node.name)
}

function _process(delta) {
  segundos += delta
}

function _exit_tree() {
  console.log('Desmontado:', node.name)
}
```

## Navegación por el árbol

`node.parent`, `node.children` y `node.get_node(path)` consultan la jerarquía. Las rutas relativas admiten `.` y `..`; las rutas que empiezan por `/` son absolutas. Para buscar por nombre en la escena, consulta `game.node(name)`.

## Instancias independientes

Si dos nodos comparten el mismo recurso, cada uno obtiene sus propias variables de ámbito. No se admite `await` en el nivel superior del recurso Nodo: utiliza funciones `async` dentro de callbacks si necesitas promesas.

## Signals

Selecciona el emisor y abre el panel **Signals**. El catálogo muestra las señales nativas del tipo de nodo seleccionado y las señales propias detectadas en sus scripts asignados. Elige una señal, selecciona el nodo receptor y elige un método publicado. Puedes abrir el script receptor en el editor integrado desde el diálogo.

En el emisor, declara una señal propia con un nombre literal y emítela cuando corresponda:

```js
node.define_signal('activado')

function _ready() {
  node.emit_signal('activado', 1)
}
```

En un Script de Nodo del receptor, publica el método que elegirá la conexión:

```js
node.expose('alActivar', (cantidad) => {
  console.log('Activaciones:', cantidad)
})
```

Guarda el proyecto desde el editor de código. Conecta **activado → alActivar** en el panel, guarda el proyecto y ejecuta Play. Las conexiones guardadas en escena se preparan antes de `_ready()`. Las señales nativas entregan los argumentos que muestra el catálogo. Para conexiones por código consulta `connect` y `disconnect` en [NodeHandle](#/api-nodehandle). Para señales de eventos del juego, consulta `game.on` y `game.emit` en la [API de game](#/api-intro).

Con la sincronización de archivos activa, escribe el método en el editor de código que estés utilizando y selecciónalo después de guardar. Century Engine bloquea la generación automática de callbacks en ese modo para proteger los cambios externos.

## Límites

Las promesas no bloquean automáticamente el ciclo físico y no se cancelan por la fuerza al salir de PlayMode. No existe hot reload de scripts durante Play. El código se ejecuta solo durante Play, no por editar un nodo.

## Más información

[Referencia de `NodeScriptHandle`](#/api-nodescripthandle) y [Referencia global de API](#/api-intro).

## IntelliSense del nodo propietario

Code y VS Code comparten la declaración pública y el criterio de asociaciones. Si todas las asociaciones conocidas en escenas y Prefabs corresponden a `CharacterBody3D`, el tipo de `node` incluye `velocity`, `ground`, `onFloor`, `onWall` y `onCeiling`. Si no se pueden leer todas las escenas, el recurso está sin asociar o sus propietarios son de tipos distintos, se conserva `NodeScriptHandle`. La selección visual no decide el tipo. `game.node()` y `node.get_node()` siguen devolviendo el tipo general.

Consulta [IntelliSense](#/intellisense) y [Propiedades editables](#/propiedades-editables).


---

## scripts.md

# Scripting JavaScript

Century Engine utiliza JavaScript como lenguaje de script. Hay dos modalidades de recurso: **Global** y **Nodo**. El editor de código integrado abre los recursos por defecto y usa las declaraciones de Century Engine para el autocompletado.

## Crear un recurso Script

Desde **Assets → Crear** elige **Script de Nodo (.js)** o **Script Global (.js)**. Century Engine crea el recurso y activa su **renombrado**. Cuando esté nombrado, haz doble clic para abrir el archivo en el editor integrado. También puedes abrir el editor desde **Juego → Editor de código**. El comando **Nuevo Script de Nodo** también lleva a Assets para nombrar el recurso.

Desde el menú contextual de un script, **Ejecución → Global** o **Nodo** cambia su modo. Para editar fuera de Century Engine, usa **VS Code** desde el editor integrado o **Juego → Abrir proyecto en VS Code**. Esta integración requiere un proyecto guardado en una carpeta. En Linux se admite también VS Code instalado desde Flathub. Century Engine instala o actualiza su extensión incluida antes de abrir, y conserva versiones superiores. Si falla, muestra la causa y permite reintentar. Si VS Code ya estaba abierto, recarga su ventana para activar la actualización. No necesitas copiar carpetas ni instalar VSIX manualmente.

Usa **Guardar** en el editor integrado para guardar el proyecto. Si editas en VS Code, guarda allí el archivo y luego guarda el proyecto en Century Engine para incorporar el texto sincronizado a `project.lfproj`. VS Code utiliza `jsconfig.json` y las declaraciones de `.levelforge/`. Si mantienes un `jsconfig.json` propio, incluye `Assets/**/*.js` y `.levelforge/*.d.ts`.

Los scripts Global se crean con `start`, `update` y `fixedUpdate` vacíos. Los scripts de Nodo se crean con `_ready`, `_process` y `_physics_process` vacíos. No incluyen diálogos ni efectos de prueba.

## Script Global

Se carga para el juego y se comunica con el runtime mediante `game`. Es apropiado para reglas generales, sistemas de estado y eventos globales. Los recursos anteriores sin campo `execution` se interpretan como globales.

## Script Nodo

Se asocia a un nodo concreto desde el Inspector. El runtime crea **una instancia por nodo** y ejecuta callbacks durante PlayMode. Un recurso configurado como Nodo no se ejecuta también como global.

## API compartida

`game` ofrece acceso a variables, escenas, audio, UI, nodos y otras capacidades. `node` existe en los scripts de Nodo; no debe suponerse disponible en los scripts globales. La referencia exacta está en [API de game](#/api-intro) y [API de NodeScriptHandle](#/api-nodescripthandle).

## Eventos y scripts

El comando Script de una página de evento utiliza un contexto distinto, con `event` y `args` cuando correspondan. El Event Order Flow determina el orden de ejecución de esas páginas; los scripts de nodo usan el ciclo de vida NodeLifecycle.

## Seguridad y errores

Los scripts de autor comparten permisos con los scripts existentes; **no** constituyen un sandbox. Los errores se reportan y las instancias se aíslan para evitar que una falla detenga todas las demás.


## Conexión con VS Code

Century Engine usa una conexión local con su extensión para abrir los scripts en la ventana del proyecto correspondiente. Con VS Code conectado, las aperturas sucesivas no vuelven a comprobar el CLI ni reinstalar la extensión. El aviso de apertura termina cuando llega la confirmación o un error.

Si VS Code estaba abierto al actualizar la extensión, puede ser necesario recargar su ventana una vez. Cerrar o cambiar de proyecto retira la sesión; el motor conserva la instalación y el lanzamiento automáticos cuando no hay conexión. La sincronización de archivos y el guardado de project.lfproj siguen funcionando como antes.


---

## ui.md

# Interfaces y localización

Century Engine ofrece nodos Canvas y recursos de interfaces `.ui`, además de un sistema de localización de textos.

## Canvas

El nodo Canvas aloja contenido de interfaz de escena. Los controles de UI se configuran en herramientas especializadas en lugar de asumir que son mallas 3D.

## Editor visual de interfaces (S03)

En la ventana del recurso `.ui`, selecciona **Plantilla → Diseño**. El editor presenta simultáneamente **Herramientas + Jerarquía**, **Canvas** e **Inspector**; ya no es necesario alternar entre tres paneles para seleccionar y editar un control.

- **Crear**: selecciona un tipo en Herramientas y dibuja sobre el Canvas, o haz doble clic en la herramienta para crear un control de tamaño predeterminado.
- **Seleccionar y organizar**: utiliza el Canvas o la Jerarquía; filtra por nombre, cambia el orden Z, duplica o elimina desde sus controles.
- **Anidar**: arrastra un elemento de la Jerarquía hasta un Panel compatible, o cambia **Contenedor** desde el Inspector. Puedes devolverlo al Formulario. No se permiten ciclos de anidamiento.
- **Editar**: propiedades geométricas, estilo, anclajes, eventos y recursos aparecen en el Inspector. Los slots compatibles admiten arrastrar recursos desde Assets Browser.
- **Redimensionar paneles**: usa los separadores laterales; también admiten las flechas del teclado cuando reciben el foco. La ventana compacta organiza las zonas verticalmente.
- **Previsualizar**: cambia resolución/zoom sobre el Canvas y abre **Simulación de juego** para mostrar diálogos y otros estados de prueba sin guardarlos en el proyecto.
- **Editar código**: las pestañas Plantilla → HTML, Script y Estilo conservan la edición manual. Si el HTML ha sido alterado respecto al diseño, se solicita una decisión explícita antes de regenerarlo.

El código generado y el estado del diseño se conservan en el `.ui` existente. El rediseño del editor no cambia la ejecución del Player.

## Recursos .ui

Los archivos `.ui` pueden representar interfaces como inventarios, diálogos y menús. El sistema de slots permite conectar acciones específicas del juego.

## Textos y localización

El Editor de Localización administra claves y traducciones. Los comandos de diálogo pueden apuntar a claves, y JavaScript puede interactuar con la API de idioma y textos disponibles.

## Seguridad

El HTML arbitrario inyectado por un script no forma parte de un sandbox de documentación. Las interfaces del juego deben utilizar los mecanismos de recursos propios de Century Engine.


---

## vcs-problemas.md

# Problemas frecuentes del control de versiones

## El panel indica «SIN CARPETA»

El proyecto no está asociado a una carpeta real autorizada. Abre o guarda primero un proyecto en disco. Git no se ejecuta directamente sobre la copia interna de IndexedDB. En el navegador web, la integración Git no está disponible: utiliza Electron.

## No se habilita «Crear commit»

Selecciona al menos un archivo, introduce el resumen, autor y correo y verifica que el proyecto se puede guardar. Si los cambios desaparecieron después de guardar, actualiza el estado y vuelve a seleccionar los archivos reales.

## El cambio de rama o la restauración están bloqueados

Revisa **Cambios**: debe estar **LIMPIO**, sin archivos nuevos no seguidos, preparados o modificados. Guarda las modificaciones de la sesión y crea un commit antes de intentarlo. Los botones de preparación también se deshabilitan mientras una operación está en curso.

## Preparé una restauración, pero ya no puedo aplicarla

El token de confirmación es temporal y solo se usa una vez. Si caducó, cambió HEAD o se modificaron los archivos, vuelve a **Preparar cambio** o **Preparar archivo** y revisa de nuevo el listado. No fuerces el sistema de respaldos.

## Fetch funciona, pero Pull se rechaza

**Fetch** no modifica el trabajo local. **Pull** solo acepta actualizaciones por avance rápido y necesita un árbol limpio y rama con seguimiento remoto válido. Si el historial local diverge del remoto, el panel no realiza merge. Conserva tus commits y resuelve la divergencia mediante un flujo Git compatible fuera del panel, sin borrar ramas ni forzar Push.

## Fallan Clone, Fetch o Push por autenticación

Comprueba que la URL sea HTTPS, que el repositorio exista y que el token tenga permisos adecuados y no haya expirado. No añadas el token en la URL. Si el servidor informa de un certificado inválido, no desactives la verificación TLS: revisa el servidor, su certificado y la configuración del sistema.

## Clone rechaza la carpeta

Selecciona una carpeta **vacía**. El repositorio debe contener un `project.lfproj` válido; Century Engine rechaza proyectos con enlaces simbólicos o tamaños y cantidades de archivos incompatibles con sus límites de seguridad. Después del clon, abre el proyecto desde Archivo, no desde un botón de ejecución automática.

## No se ven cambios en una comparación

La pestaña **Historial** muestra diferencias textuales y metadatos de archivos; algunos archivos binarios —incluido `.lfproj`— no tienen una comparación legible. Guarda los archivos al disco si deseas comparar con **Carpeta actual**. Un historial muy grande requiere **Cargar más revisiones**.

## Git funciona en desarrollo, pero no en un instalador

Verifica el empaquetado real y las dependencias del Git embebido. Linux requiere comprobar bibliotecas compartidas; Windows necesita MinGit y auxiliar HTTPS incluidos. El paso `npm run build` por sí solo no valida Git de un instalador. Para QA de distribución consulta `docs/qa/LF-VCS-S04-G001_QA.md`.

## Dónde buscar más información

Consulta [Introducción a Git](#/vcs-intro), [Ramas y restauración](#/vcs-ramas), [Repositorios remotos](#/vcs-remotos) y [Seguridad y límites](#/vcs-seguridad).


---

## vcs-seguridad.md

# Seguridad, respaldos y límites de Git

El control de versiones no sustituye un sistema de copias de seguridad. Git registra versiones de los **archivos confirmados**; las modificaciones sin guardar, los recursos no registrados y los archivos excluidos no están protegidos por un commit.

## Protección de las operaciones

- **Commit:** guarda primero y registra solo los archivos seleccionados, no todos los elementos que alguna otra herramienta haya preparado.
- **Cambio de rama o restauración:** exige estado limpio, preparación, lista de archivos, confirmación y respaldo dentro de `.git/levelforge-backups/`.
- **Fetch:** consulta el remoto sin cambiar los archivos de trabajo.
- **Pull:** necesita un árbol limpio; solo actualiza por avance rápido y solicita confirmación antes de recargar.
- **Push:** no ejecuta una actualización forzada.
- **Clone:** solo admite carpeta vacía elegida desde la interfaz y valida el contenido antes de abrir el proyecto manualmente.

El respaldo local de cambios afectados está limitado a **1.000 archivos / 128 MiB**. La recuperación automática puede rechazarse si detecta modificaciones posteriores. Para proyectos importantes conserva además una copia externa verificada del directorio de trabajo.

## Credenciales y transporte

La conexión acepta únicamente URL HTTPS sin secretos incrustados. Los procesos Git se lanzan desde Electron sin intérprete de comandos y con un catálogo cerrado de operaciones. Los tokens pueden almacenarse mediante `safeStorage` de Electron **solo cuando existe un backend de cifrado seguro**; nunca se considera seguro el backend de texto básico.

El token temporal se pasa a Git mediante el entorno del subproceso; este enfoque evita incluirlo en los argumentos de línea de comandos o en los archivos del proyecto, pero presenta un riesgo residual frente a procesos con acceso al entorno del usuario. Usa tokens de alcance mínimo y revócalos si sospechas exposición.

## Funciones no disponibles

No hay shell Git integrada, SSH, OAuth en navegador, Git LFS, merge de conflictos, rebase ni comparación semántica de `.lfproj`. Los procedimientos documentados se limitan a las operaciones del panel S01–S04.

## Distribución y estado de QA

El editor empaquetado está diseñado para incluir Git nativo, incluidos los auxiliares HTTPS. En Linux, el binario y sus bibliotecas dinámicas pueden depender de la distribución. En Windows, el empaquetado debe incluir MinGit y verificar certificados y transporte. **No hay evidencia suficiente para afirmar compatibilidad universal** sin ejecutar AppImage/DEB y Setup/Portable en equipos limpios, sin Git instalado.

La redistribución de Git está sujeta a **GPL-2.0** y a las licencias de sus componentes. Antes de publicar instaladores es obligatorio revisar avisos legales, fuentes correspondientes y binarios incluidos. Consulta la documentación técnica interna `docs/architecture/LF-VCS-S01-G001_IMPLEMENTATION.md` y `LF-VCS-S04-G001_IMPLEMENTATION.md`.

## Comprobaciones recomendadas antes de entregar un juego

Verifica que los commits estén completos, que el `.lfproj` abra correctamente y que el Player exportado cargue recursos y scripts. Un commit Git correcto **no garantiza** que el Editor, el runtime Jolt o el ejecutable exportado hayan superado QA.

Consulta [Problemas frecuentes](#/vcs-problemas).


---

## docs/web-src/vcs-intro.md

# Control de versiones Git en Century Engine

El panel **Control de versiones** conserva el historial de un proyecto en una carpeta local y, si se configura un servidor, permite intercambiar commits por HTTPS. El proyecto sigue siendo un proyecto Century Engine: Git no sustituye el archivo `project.lfproj`, el guardado del editor ni los respaldos de trabajo.

## Antes de empezar

- Utiliza **Century Engine de escritorio (Electron)**. La versión abierta en un navegador no puede iniciar el Git integrado.
- Guarda el proyecto **en una carpeta del disco**: Git no opera directamente sobre una copia que solo existe en memoria o IndexedDB.
- Abre **Control de versiones** en el dock inferior, pestaña **Cambios**. Si no hay repositorio, verás **Inicializar repositorio**.
- El editor incluye los binarios Git necesarios al empaquetarlo correctamente. No requiere Git instalado por separado en el equipo de destino, pero las compilaciones Linux/Windows y la compatibilidad de sistemas todavía requieren QA específico.

## Conceptos esenciales

| Término | Qué significa en Century Engine |
|---|---|
| **Carpeta de trabajo** | Archivos reales del proyecto: `project.lfproj`, Assets y scripts. |
| **Repositorio local** | Directorio oculto `.git` con el historial de commits en el propio equipo. |
| **Commit** | Instantánea de los archivos elegidos, con autor y descripción. No se envía por Internet automáticamente. |
| **Rama** | Línea local de trabajo que puede conservar cambios distintos. Crear una rama **no equivale a cambiarte a ella**. |
| **Remoto `origin`** | Dirección HTTPS opcional de un repositorio en un servidor compatible con Git, por ejemplo GitHub o GitLab. |
| **Fetch / Push / Pull** | Consultar cambios remotos / publicar commits / recibirlos y actualizar el proyecto, respectivamente. |

## Primer flujo recomendado

1. Guarda tu proyecto en una carpeta del disco con **Ctrl+S**.
2. Abre **Control de versiones → Cambios** y pulsa **Inicializar repositorio**.
3. Selecciona los archivos que quieres registrar; escribe **Resumen de los cambios**, **Autor** y **Correo**.
4. Pulsa **Crear commit** y comprueba el resultado en **Historial**.
5. Crea una nueva rama antes de ensayar cambios importantes. Para trabajar en ella, prepara y confirma el cambio desde **Ramas**.
6. Configura **Remoto** solo cuando realmente necesites compartir los commits o clonar un proyecto existente.

## Capítulos de esta guía

- [Cambios y commits](#/vcs-commits): preparación, guardado, selección y autor.
- [Historial y diferencias](#/vcs-historial): comparar revisiones y leer cambios.
- [Ramas y restauración](#/vcs-ramas): cambios seguros, confirmación y respaldos.
- [Repositorios remotos](#/vcs-remotos): HTTPS, Clone, Fetch, Push y Pull.
- [Seguridad y límites](#/vcs-seguridad): credenciales, recuperación y distribución.
- [Problemas frecuentes](#/vcs-problemas): errores y pasos de diagnóstico.

> **Estado de verificación:** las funciones Git S01–S04 están implementadas en el código y disponen de pruebas automatizadas. Las pruebas visuales en Electron, repositorios GitHub/GitLab reales y los instaladores Linux/Windows todavía requieren QA local. No interpretes este manual como una certificación de distribución.


---

## docs/web-src/preferencias.md

# Preferencias del editor

Abre **Editar → Preferencias del editor**. Las categorías laterales agrupan Navegación, Viewport, Interfaz, Proyecto y Archivo de configuración. El buscador filtra las opciones y las secciones se pueden plegar. Restablecer recupera los valores predeterminados.

## Navegación

El multiplicador general del ratón afecta a las sensibilidades de órbita, desplazamiento, rueda y mirada libre, sin multiplicar las del trackpad. Mantén botón derecho y utiliza WASD para vuelo editorial; Shift aplica el multiplicador de velocidad de vuelo. No modifica los controles del jugador. Conserva el nodo seleccionado al navegar.

## Viewport e Inspector

El FOV horizontal editorial se configura entre 40 y 120 grados; 90 es el valor predeterminado. Los ajustes de visualización editorial no cambian el perfil de renderizado exportado. Los valores de posición, rotación y escala muestran hasta dos decimales en reposo y su precisión completa al editar. No se redondean los datos internos por cambiar el formato visible.

## Persistencia

Las preferencias se guardan mediante la infraestructura `editor.toml`. Las opciones de navegación son editoriales; las del juego se configuran por separado. El espacio de trabajo conserva estado de autoría por proyecto y escena según el contrato de sesión, no como parte de las transformaciones guardadas en los nodos.


---

## docs/tutorial/vertical-slice.md

# Tutorial: un vertical slice

Vamos a hacer un juego corto y **completo** —de la primera pantalla a la aplicación exportada— que toca todas las piezas importantes:
escena, jugador, un personaje que habla (con voz y en dos idiomas), una puerta con llave, una farola que se rompe, un HUD, un diálogo con
estilo propio, una cinemática final y la partida guardada. Calcula una o dos horas.

> **La historia**: llegas de noche a la casa de una anciana. Te pide que arregles la luz; a cambio te da la llave del cobertizo.
> Dentro está lo que buscabas y termina el capítulo.

## 1. Proyecto y escena

1. En el gestor de proyectos: *Nuevo proyecto* → nombre «La anciana».
2. *Añadir ▸ Primitivas ▸ Caja* para el suelo: en el Inspector, escala `30, 0.5, 30` y posición `0, -0.25, 0`.
3. Construye la casa con cajas (paredes, tejado con una *Rampa*) y un cobertizo pequeño a un lado. Marca **Colisión** en el Inspector
   (las primitivas la traen activada).
4. *Añadir ▸ Spawn* delante de la casa, mirando hacia ella.
5. En el Inspector de la **Escena** (clic en la raíz de la Jerarquía): *Hora del día* → 21:00, *Clima* → nublado. Ya es de noche.
6. En el mismo Inspector, *Nivel*: *Nombre del nivel* «Casa de la anciana» y marca **Mostrar el nombre al entrar**: al jugar aparece
   abajo a la derecha con un fundido y se va solo.
7. `F5`: camina por la escena. `F5` otra vez para volver al editor.

## 2. La base de datos

*Juego ▸ Base de datos ▸ Interruptores y variables*:

- Interruptores: `1 Luz arreglada`, `2 Llave`, `3 Farola rota`.
- Variables: `1 Visitas`.

Usar nombres claros importa: el editor de scripts y los comandos los sugieren por nombre.

## 3. La anciana habla

1. *Añadir ▸ Evento* junto a la puerta. En el Inspector, nómbralo «Anciana». Doble clic (o *Editar páginas y comandos…*) abre el editor.
2. **Página 1** → *Gráfico*: `Cilindro`, tamaño `0.6, 1.7, 0.6` (o un modelo `.glb` de personaje). *Disparador*: `Botón de acción`. Marca
   *Sólido* y *Girarse hacia el jugador al activarse*.
3. *Contenido* → *Insertar comando…*:
   - **Variable** `Visitas` `+ 1`.
   - **Mostrar texto** — Quién habla: `Anciana`; Texto: `Buenas noches. Ya van \V[1] visitas y la farola sigue rota.`
     En *Animación de entrada* elige `Fundido` y pulsa **▶ Vista previa** para verlo como en el juego antes de aceptar.
     Si tienes un audio de voz, impórtalo (arrastra el `.ogg` al panel Proyecto) y elígelo en **Voz (audio)**: al terminar la voz el
     diálogo avanza solo (desmarca *Al terminar la voz, pasar al siguiente texto* si prefieres que el jugador pulse).
   - **Mostrar opciones**: `Yo la arreglo` / `Ahora no`. En la rama *Yo la arreglo* añade otro **Mostrar texto**: `El interruptor está en el poste.`
4. **Página 2** (botón `+`) → condición *Interruptor* `Luz arreglada`. Mismo gráfico. Contenido:
   - **Mostrar texto**: `¡Luz! Toma, la llave del cobertizo.`
   - **Interruptor** `Llave` → ON.
   - **Auto-interruptor** `A` → ON (para no repetir la entrega).
5. **Página 3** → condición *Auto-interruptor* `A`. Contenido: **Mostrar texto** `Buenas noches.`

Pulsa `F5` y habla con ella (`E`). La página que manda es la **última** que cumple sus condiciones: por eso la 3 sustituye a la 2.

## 4. El interruptor de la luz (un evento sin gráfico)

1. *Añadir ▸ Evento* pegado a un poste, «Caja de fusibles». Gráfico: `Caja` pequeña. Disparador: `Botón de acción`.
2. Crea dos páginas: la 1 sin condiciones, con el contenido de abajo; la 2 con condición *Interruptor* `Luz arreglada` y sin contenido
   (una vez arreglada, pulsar ya no hace nada: la página 2 manda).
3. Contenido de la página 1:
   - **Reproducir sonido** `click.ogg` (si lo tienes).
   - **Controlar luz** → *Luz*: ninguna; *O todas las luces con la etiqueta*: `Farolas`; *Estado*: `Encender`; *Fundido*: `1`.
   - **Interruptor** `Luz arreglada` → ON.

El comando *Controlar luz* actúa sobre **todas** las luces con la etiqueta `Farolas`: así se encienden o apagan por lotes.

## 5. Una farola que se rompe

Vamos a reutilizar un conjunto con **prefabs** en vez de duplicarlo.

1. Crea un *Cilindro* fino de 3 m («Poste») y, como hijo, una *Luz de punto* arriba («Bombilla»). En el Inspector de la luz:
   *Etiqueta* → `Farolas` (créala en *Juego ▸ Tags y Layers*), energía baja.
2. Clic derecho en «Poste» → **Crear prefab** → se guarda como `Farola.prefab`.
3. Duplica el poste, inclínalo y quítale la luz → **Crear prefab** «FarolaRota».
4. Borra los dos de la escena (quedan en *Assets/Prefabs*). En *Juego ▸ Base de datos ▸ Objetos* crea dos objetos, «Farola» y
   «Farola rota», y en su *Modelo* elige los prefabs `Farola` y `FarolaRota` (salen en el grupo *Prefabs*).
5. *Añadir ▸ Evento* «Farola del camino»:
   - Página 1: *Gráfico* `Objeto (base de datos)` → `Farola`, *Sólido*. Sin contenido.
   - Página 2: condición *Interruptor* `Farola rota`; *Gráfico* `Objeto (base de datos)` → `Farola rota`.
6. Otro evento en el camino, sin gráfico, con disparador *Contacto con el jugador* y escala de zona `3, 2, 1`: **Interruptor** `Farola rota`
   → ON, **Reproducir sonido** `cristal.ogg`, **Borrar este evento**.

Al pasar, la farola cambia **entera** (modelo y luz) porque cambia la página del evento.

## 6. La puerta del cobertizo

1. Un evento «Puerta» con *Gráfico* `Caja` (`1, 2, 0.1`), *Sólido*, disparador *Botón de acción*.
2. Página 1 (sin condiciones): **Mostrar texto** `Está cerrada con llave.`
3. Página 2 (condición *Interruptor* `Llave`): **Mostrar texto** `Clic.`, **Mover nodo** (la propia puerta, `0, 0, 1.2`, relativo, 1 s) y
   **Borrar este evento**.

## 7. Un HUD con un Canvas

1. *Añadir ▸ Interfaz ▸ Canvas (interfaz propia)*. En el Inspector → **Crear .ui nuevo**: se abre el editor de interfaces.
2. En la pestaña **Plantilla** (vista HTML) escribe:

   ```html
   <div class="hud">
     <span v-if="game.switch('Llave')">🔑 {{ game.t('hud.llave', 'Llave') }}</span>
   </div>
   ```

   y en **Estilo**: `.hud { position: absolute; right: 24px; top: 20px; font-size: 20px; }`.
3. Mientras escribes, el IntelliSense sugiere `game.switch`, y dentro de las comillas los nombres de tus interruptores.

## 8. Un diálogo con estilo propio

Los «Mostrar texto» ya se ven con la interfaz por defecto. Para cambiarla:

1. *Añadir ▸ Interfaz ▸ Canvas · Diálogo («Mostrar texto»)*.
2. Inspector → **Crear .ui nuevo**: se abre una copia del diálogo por defecto (`dialogo.ui`) **en el diseñador visual**. Prueba
   *Plantilla ▸ Novela visual*, arrastra el cuadro, cambia colores, añade un **Retrato** (filas Personaje / expresión / imagen) y un
   **Sonido de tecleo** en el *Texto del diálogo*. **▶ Reproducir** en la vista previa lo escribe como en el juego.
   Mientras este Canvas exista, es el que dibuja los diálogos. Con `\F[triste]` en un texto cambias la expresión del retrato.
3. ¿Más inquietante? Plantilla *Subtítulos de terror* (sin cuadro, el texto sube desde abajo) y, en un Canvas · Opciones, *Debajo del
   texto*. Escribe el grito de la anciana como `\FX[temblor]¡No entres ahí!\FX[0]`: las letras tiemblan.

El tema global (fuente, colores, velocidad de escritura) está en *Juego ▸ Tema de interfaz*.

## 9. En dos idiomas

1. *Juego ▸ Localización…* → **＋ Idioma** → English.
2. **Recoger textos**: se crea una clave por cada «Mostrar texto» de la escena y una por cada nombre que habla (`speaker.anciana`).
3. Escribe las traducciones en la columna *English* (las que faltan salen en ámbar; el filtro *Faltan* las lista). En cada celda puedes
   elegir la **voz** de ese idioma.
4. Añade con **＋ Clave** la clave `hud.llave` (usada en el HUD): `Llave` / `Key`.
5. Marca **Probar en el editor** → English y pulsa `F5`: todo sale en inglés, con su voz.
6. En un menú de opciones del juego, `game.lang = 'en'` cambia el idioma al momento (y el juego exportado lo recuerda).

## 10. La cinemática final

1. Pestaña **Timeline** → *Nuevo timeline* «Final». Pista **Cámara**: dos claves (captura la vista del editor dentro del cobertizo y otra
   más cerca). Pista **Comandos** al final: **Mostrar texto** `Por fin.` con *Pausar el timeline hasta que terminen*.
2. Activa *barras de cine* en las opciones del timeline.
3. Dentro del cobertizo, un evento con disparador *Contacto con el jugador*:
   - **Reproducir timeline** `Final` (esperar a que termine).
   - **Fundido de pantalla** salir, 2 s.
   - **Guardar partida** (autoguardado).
   - **Mostrar / cerrar interfaz** → abrir tu pantalla de créditos (o **Ir a otra escena**).

## 11. Un poco de script

Crea `Assets/Scripts/juego.js`:

```js
// Al empezar: recordar cuántas veces has jugado
game.state.partidas = (game.state.partidas || 0) + 1

// Función reutilizable desde cualquier evento (comando «Llamar función de script»)
game.define('parpadeo', async (veces = 3) => {
  for (let i = 0; i < veces; i++) {
    game.lights('Farolas').forEach((l) => (l.on = !l.on))
    await game.wait(0.15)
  }
})

// Pasos más fuertes sobre la madera
game.on('footstep', (e) => {
  if (e.surface === 'wood') game.audio.play('paso_madera.ogg', { group: 'sfx', volume: 0.8 })
})
```

Llámala en la caja de fusibles con **Llamar función de script** `parpadeo` antes de encender. El editor marca en rojo los errores, en
amarillo lo que no existe (`game.ligths`) y te avisa si olvidas un `await`.

### Opcional: avisar de lo que se puede usar

¿Quieres que la puerta del cobertizo brille o muestre un aviso cuando el jugador la mira? Pon un **Trigger** sobre ella, activa **Mirada**
en su Inspector y escribe en *Al mirar* el nombre de una función de tu script. Sin tocar el motor:

```js
game.define('puertaMirada', () => game.ui.canvas('Aviso')?.show())
game.define('puertaFuera', () => game.ui.canvas('Aviso')?.hide())
```

(*Al mirar* = `puertaMirada`, *Al dejar de mirar* = `puertaFuera`). Si prefieres detectar «cualquier cosa de la layer Interactuable», usa
`game.player.look({ layers: 'Interactuable' })` desde `game.on('update', …)`. Los sonidos de este aviso van por el grupo **UI**:
`game.audio.ui('aviso')`.

## 12. Exportar

1. `Ctrl+S` y *Archivo ▸ Exportar juego…* abre la ventana **Build**: pon el título y el icono, marca las escenas del juego y deja primera la que arranca (la escena inicial).
2. Pulsa **Build**. Obtienes la aplicación lista para repartir; el jugador elige idioma y el juego recuerda su elección.

## Qué has usado

| Pieza | Dónde |
|---|---|
| Eventos, páginas, condiciones, disparadores | 3, 4, 6 |
| Interruptores, variables, auto-interruptores | 2, 3 |
| Luces por etiqueta | 4 |
| Prefabs como modelo de un objeto de la base de datos | 5 |
| Canvas: interfaz propia y del sistema | 7, 8 |
| Localización y voz | 3, 9 |
| Timeline, fundido, guardado | 10 |
| Scripts: `game.define`, `game.on`, `game.lights` | 11 |

Consulta la [referencia de comandos](../referencia/comandos.md) y la [API](../referencia/api.md) para ir más allá.


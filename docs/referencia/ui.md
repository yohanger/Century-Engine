# Interfaces: nodos Canvas y recursos `.ui`

## El nodo Canvas

| Campo (Inspector) | Qué hace |
|---|---|
| **Uso** | *Interfaz propia* (HUD, menús) o una interfaz del sistema: *Diálogo, Opciones, Indicación de acción, Fundido, Barras de cine, Subtítulo, Nombre del mapa, Aviso «omitir»*. |
| **Recurso UI** | El `.ui` que dibuja. Con un uso del sistema y sin recurso, dibuja la interfaz por defecto de ese uso. |
| **Resolución** | Tamaño de referencia (1920×1080 por defecto): el rectángulo que ves en la escena. |
| **Capa** | Orden de apilado (mayor = delante). Cada uso tiene su capa por defecto: indicación 20, diálogo 30, opciones 40, fundido 80, nombre del mapa 88, barras 90, subtítulo 92, omitir 96. |
| **Visible al iniciar** | Si empieza mostrándose. |
| **Recibe clics** | Para menús que se usan con el ratón. |
| **Modal** | Libera el ratón y pausa el juego mientras se ve; `Esc` lo oculta. |

**Prioridad de las interfaces del sistema**: si la escena tiene un Canvas con ese uso, manda (aunque esté oculto: ocultarlo quita esa
interfaz); si no, la asignación antigua de roles del proyecto (obsoleta); si no, la interfaz por defecto con el tema del proyecto.

Desde scripts: `game.ui.canvas('HUD').visible = false`, `.show()`, `.hide()`, `.toggle()`, `game.ui.showCanvas('HUD')`,
`game.ui.isCanvasVisible('HUD')`. Desde eventos: comando *Mostrar / cerrar interfaz*.

## Diseñar el diálogo, las opciones y la indicación

Todo lo del diálogo se diseña **visualmente** en el diseñador (pestaña *Plantilla ▸ Diseñador*), sin HTML:

1. *Añadir ▸ Interfaz ▸ Canvas · Diálogo* (u *Opciones*, *Indicación*) → Inspector → **Crear .ui nuevo**. Se abre una copia de la
   interfaz por defecto en el diseñador, lista para cambiar.
2. En *Propiedades del formulario*: **Tipo** (Diálogo / Opciones / Indicación: la vista previa simula ese estado), **Plantilla**
   (sustituye el diseño por una lista para usar), **Animación de entrada**, **Animación de salida** (fundido, bajar, encoger,
   deslizar: se reproduce al cerrarse la pantalla) y **Escalado**. Son las animaciones *por defecto* de la interfaz: cada
   «Mostrar texto», «Mostrar opciones» o «Subtítulo» puede elegir la suya (ver abajo).
   En **Plantilla → Diseño** se muestran simultáneamente tres zonas: **Herramientas y Jerarquía** a la izquierda, el **Canvas**
   en el centro y el **Inspector** a la derecha. Los separadores verticales permiten ajustar su anchura con el ratón o con las
   flechas izquierda/derecha al enfocarlos. Para ventanas estrechas se ordenan verticalmente. La lista dispone de búsqueda,
   selección y controles para orden Z, duplicar y eliminar. Arrastrar un control de la jerarquía a un **Panel** lo anida;
   arrastrarlo a **Formulario** lo devuelve a la raíz. El campo **Contenedor** del Inspector ofrece la misma operación por teclado.
   Se conservan las coordenadas absolutas al cambiar de contenedor, siempre que el destino sea válido (sin ciclos).
   La vista previa marca con un **marco negro** los límites de la resolución del formulario.
3. Mueve, redimensiona y cambia las propiedades de cada pieza. La vista previa lo muestra como en el juego: **▶ Reproducir** escribe el
   texto de ejemplo letra a letra (con colores `\C[n]` y expresiones `\F[…]`), *Arriba / Centro / Abajo* prueba la posición del comando
   y *Sin nombre* prueba el narrador.

### Piezas (caja de herramientas ▸ «Diálogo, opciones e indicación»)

| Pieza | Qué es | Propiedades principales |
|---|---|---|
| **Texto del diálogo** | El texto de «Mostrar texto», con sus códigos de color, tamaño y efectos `\FX[…]`. El hueco se reserva desde el principio: las líneas no saltan al escribirse. | *Aparición* (letra a letra, letra a letra con fundido, de golpe), *Velocidad* (letras/s; 0 = la del tema), *Sonido de tecleo* (audio, cada N letras, variación de tono, volumen; no suena si el texto tiene voz), tamaño, interlineado, color, alineación. *Crecer desde el borde anclado* (sin reservar el hueco: anclado abajo, el bloque sube con cada línea, como unos subtítulos). *Fondo del texto*: ninguno (pensamiento) o una franja detrás de cada línea, con su color. *Nombre de quien habla* dentro del texto: encima en pequeño o en la línea («NICK: …»), con color y mayúsculas. |
| **Nombre de quien habla** | Solo se ve si el texto tiene «Quién habla». | Fondo, color, tamaño, negrita, mayúsculas, radio, alineación. |
| **Retrato** | La imagen de quien habla. | *Retratos*: filas Personaje / expresión / imagen (`*` = cualquier otro). La expresión se elige en el texto con `\F[triste]` y puede cambiar a mitad de frase. Sin filas: el *Retrato* del personaje en la Base de datos. *Imagen de respaldo*, ajuste, radio, borde. |
| **Indicador «continuar»** | Aparece cuando el texto termina y espera la pulsación (no en modo automático ni con `\D`). | Símbolo (vacío = el del tema), color, tamaño, animación (parpadeo, rebote). |
| **Lista de opciones** | Las opciones de «Mostrar opciones», con ratón y teclado. | Alto de cada opción, separación, *Alto según las opciones*, *Con ventana*, pregunta, números, marca de la elegida (`▶`), colores normal/elegida, radio, alineación, mayúsculas. |
| **Indicación de acción** | «E · Hablar» con la tecla dibujada. | Tamaño, colores, fondo de la tecla, radio. |

Todas las piezas con texto (texto, nombre, indicador, opciones, indicación y etiquetas) tienen **Contorno del texto** (grosor y color:
se lee sobre cualquier fondo, sin cuadro) y **Sombra del texto**. (La *Animación al aparecer / al desaparecer* de cada pieza está
obsoleta: solo se muestra en los diseños que ya la usan. La animación se elige en el comando.)

### Animación de entrada y salida en los comandos

«Mostrar texto», «Mostrar opciones» y «Subtítulo» tienen **Animación de entrada** (fundido, subir, aparecer con escala, deslizar),
**Animación de salida** (fundido, bajar, encoger, deslizar) y **Duración**. *Según la interfaz* usa la del diseño. La entrada se
reproduce con cada texto; la salida, al cerrarse el diálogo. Desde scripts: `game.say(texto, quien, pos, { enter: 'fade', exit: 'sink',
duration: 0.4 })`, `game.choose(opciones, cancelar, pregunta, { enter: 'pop' })`, `game.caption(texto, s, pos, { exit: 'fade' })`.

**▶ Vista previa** (abajo a la izquierda de la ventana del comando, también en «Mostrar nombre del mapa») muestra el comando como en el
juego: la interfaz de la escena para ese uso (o la de por defecto), el tema, los códigos de texto y la animación elegida.

**La frase se queda bajo las opciones**: cuando a un «Mostrar texto» le sigue un «Mostrar opciones», la frase sigue en pantalla
(sin el indicador «continuar») mientras el jugador elige, y se va al elegir. Si no le siguen opciones, se queda un instante (0,16 s)
para que se vea su animación de salida.

Y en el **Panel** (el cuadro): *Posición* «La del comando» (diseñas el cuadro abajo; «Arriba» lo refleja y «Centro» lo centra),
*Imagen de fondo* (con ajuste o mosaico: marcos dibujados), *Sombra*, *Desenfoque del fondo* (cristal esmerilado), color, borde, radio, opacidad.

### Plantillas incluidas

- Diálogo: **Clásico** (la de por defecto), **Novela visual** (retrato grande), **Cinemático** (sin cuadro, texto con sombra),
  **Globo** (compacto), **Terror / máquina de escribir**, **Pensamiento** (sin fondo, texto con contorno en el centro, con fundido)
  y **Subtítulos de terror** (sin cuadro, crece hacia arriba desde abajo, nombre pequeño en mayúsculas encima, «■ …» al terminar).
- Opciones: **Centradas** (por defecto), **A la derecha** y **Debajo del texto** (sin ventana, bajo la frase que sigue visible:
  pequeñas, en mayúsculas, marca ■, sin números). Indicación: **Abajo al centro**.

Para unos diálogos como los de *Fear to Fathom*: Canvas · Diálogo con *Subtítulos de terror*, Canvas · Opciones con *Debajo del
texto*, y en los textos `\FX[temblor]` para los gritos. En el evento, *Durante el evento ▸ Mirar al que habla* gira la cámara.

### Escalado

Con *Escalado: Escalar con la pantalla* (por defecto en los diseños nuevos) se diseña a la resolución del formulario (1280×720) y en el
juego se escala al tamaño de la ventana, como el *Canvas Scaler* de Unity: el **anclaje** decide qué se estira cuando la pantalla es
más ancha (un cuadro anclado a izquierda y derecha se alarga en 21:9). Los diseños anteriores a esta opción siguen en *Píxeles fijos*.

## Nombre del mapa

*Escena ▸ Nivel ▸ Mostrar el nombre al entrar*: al empezar a jugar (o al llegar con *Ir a otra escena*) aparece el *Nombre del nivel*
con un fundido suave, se queda y se va. Se ajusta la posición (abajo a la derecha por defecto), el retraso, el fundido de entrada,
lo que se queda y el fundido de salida. También con el comando **Mostrar nombre del mapa** y `game.showLevelName(texto?, { position,
delay, fadeIn, hold, fadeOut })`. Su aspecto es una interfaz del sistema: un Canvas con *Uso: Nombre del mapa* la sustituye
(`play.levelTitle` = `{ text, pos, alpha }`).

## ID y clases CSS de los controles

Cada control genera un elemento con la clase de su **Nombre** (`.etiqueta1`), su tipo (`.rt-label`) y, si los rellenas en
*Propiedades ▸ Diseño*, un **ID (CSS)** (`id="titulo"` → `#titulo { … }`) y **Clases CSS** extra (`grande rojo` → `.grande { … }`).
La fila *Reglas en Estilo* los lista; un clic crea la regla vacía en la pestaña *Estilo* (o salta a ella si ya existe).

## El formato `.ui`

Un `.ui` tiene tres bloques, como un componente de Vue:

```html
<template>
  <div class="hud">
    <rt-bar :value="vida" :max="100" color="#e0524a" style="width:200px;height:12px" />
    <span v-if="game.switch('Llave')">🔑</span>
  </div>
</template>

<script>
// cuerpo de setup(): lo que devuelves se usa en la plantilla
const vida = computed(() => game.variable('Vida'))
return { vida }
</script>

<style>
.hud { position: absolute; left: 24px; bottom: 24px; display: flex; gap: 12px; align-items: center; }
</style>
```

- El CSS queda **aislado** en cada pantalla.
- `<template modal layer="60">`: pantalla modal (para las que se abren con `game.ui.open`).
- El editor de interfaces tiene **diseñador visual** con jerarquía, canvas e Inspector simultáneos, y vista **HTML** para edición manual,
  además de vista previa a varias resoluciones e inspección de elementos. Los datos de prueba se despliegan en **Simulación de juego**.
  El selector de recursos del Inspector admite Drag & Drop desde Assets Browser cuando el campo es compatible.
- Cambiar a **HTML**, **Script** o **Estilo** no obliga a regenerar el diseño: las plantillas HTML editadas a mano siguen protegidas.
  Si la plantilla quedó desincronizada, el editor solicita elegir entre regenerarla o conservar el HTML.

## Qué hay disponible en la plantilla y en `<script>`

| Nombre | Qué es |
|---|---|
| `game` | La [API completa](api.md). Leer `game.switch()`, `game.variable()`, `game.t()`… hace que la pantalla se redibuje sola cuando cambian. |
| `play` | Estado de la partida (abajo). |
| `props` | Parámetros de `game.ui.open('nombre', props)`. |
| `ui` | `ui.open / close / toggle / isOpen / showCanvas / hideCanvas / canvas`, `ui.pick(i)` (elige una opción), `ui.resume()`, `ui.quit()`. |
| `close(resultado)` | Cierra esta pantalla; `await game.ui.open(…)` devuelve `resultado`. |
| `call(nombre, ...args)` | Igual que `game.call`. |
| `asset('img.png')` | URL de un archivo del proyecto (imágenes, fuentes). |
| `ref`, `reactive`, `computed`, `watch`, `watchEffect`, `onMounted`, `onUnmounted`, `nextTick` | Vue. |
| `onUpdate((dt) => …)` | Cada fotograma (`dt` en segundos). |

### `play`

| Campo | Contenido | Lo usa |
|---|---|---|
| `play.dialog` | `{ speaker, text, runs, pos, shown, done, auto, stay, lingering }` o `null`. `shown` = letras ya escritas; `runs` = trozos con color/tamaño/efecto (`fx`, `fxk`); `lingering` = la frase ya cerrada que sigue visible bajo las opciones; `anim` = `{ in, out, ms }` elegida en el comando. | Diálogo |
| `play.choices` | `{ options, index, prompt, cancel }` o `null`. | Opciones |
| `play.prompt` | Texto de la indicación («E · Abrir»). | Indicación |
| `play.fade` | `{ color, alpha, ms }`. | Fundido |
| `play.letterbox` | % de alto de cada barra de cine. | Barras |
| `play.caption` | `{ text, pos, anim }` o `null`. | Subtítulo |
| `play.levelTitle` | `{ text, pos, alpha }` o `null` (rótulo con el nombre del mapa). | Nombre del mapa |
| `play.timeline` | Cinemática en curso (`skippable`…). | Omitir |
| `play.focus` | El juego tiene el ratón. | — |
| `play.lang` | Idioma actual. | — |
| `play.party` | `{ gold, members, items, weapons, armors, quests, lore }` (inventario y diario). | Menús |

## Componentes incluidos

- `<rt-bar :value="70" :max="100" color="#4caf6a" back="rgba(0,0,0,.55)" />` — barra de progreso.
- `<rt-key>E</rt-key>` — tecla dibujada.
- `<rt-dialog-text reveal="type|fade|instant" :speed="40" blip="tic.wav" :blip-every="2" grow bg="none|line" bg-color="#000a" name-mode="none|above|inline" name-color="#ccc" :name-upper="true" />` — texto del diálogo.
- `<rt-portrait map="Ana=ana.png; Ana:triste=ana_t.png; *=otro.png" fallback="nadie.png" />` — retrato de quien habla.
- `<rt-choices :item-h="40" :numbers="true" mark="▶" upper />` — lista de opciones.
- `<rt-prompt />` — indicación de acción.
- `<rt-icon :icon="it.icon" size="24" />` — icono de un registro (emoji o imagen).

Son las piezas que genera el diseñador; también se pueden escribir a mano en la vista HTML.

## Proyectos creados con versiones anteriores

Hasta la versión 1 del formato, el motor usaba el prefijo `lf` (`<lf-bar>`, `.lf-panel`, `--lf-text`). Ahora es **`rt`** (`<rt-bar>`, `.rt-panel`, `--rt-text`). Al abrir un proyecto antiguo el motor reescribe tus interfaces solo y guarda una copia `project.lfproj.bak-v1` junto al proyecto. Tus **scripts** no se tocan: si buscan elementos por clase (`querySelector('.lf-panel')`), cámbialo a `rt-` a mano; la ventana «Proyecto actualizado» te dice cuáles.

## Tema

*Juego ▸ Tema de interfaz* define variables CSS que usan las interfaces por defecto y que puedes usar en las tuyas:
`--rt-font`, `--rt-fs`, `--rt-lh`, `--rt-weight`, `--rt-ls`, `--rt-text`, `--rt-text-shadow`, `--rt-accent`, `--rt-accent-text`,
`--rt-win-bg`, `--rt-win-border`, `--rt-bw`, `--rt-radius`, `--rt-pad`, `--rt-shadow`, `--rt-win-img`, `--rt-win-img-op`,
`--rt-name-bg`, `--rt-name-text`, `--rt-next`, `--rt-next-icon`, `--rt-dlg-w`, `--rt-dlg-min`, `--rt-dlg-bottom`.

```css
.panel { background: var(--rt-win-bg); border-radius: var(--rt-radius); font-family: var(--rt-font); }
```

## Textos traducidos en una interfaz

En el diseñador, los controles con texto (Etiqueta, Botón, Casilla y el texto de ayuda del Cuadro de texto) tienen **Clave de
localización** (*Propiedades ▸ Apariencia*): «＋» la crea (`ui.<interfaz>.<control>`) con el texto actual y 🌐 la abre en la tabla. Con
clave, la plantilla genera `{{ game.t('clave', 'texto') }}`. *Juego ▸ Localización ▸ Interfaz* lista las claves de las interfaces, avisa
de los textos aún sin clave y **Recoger textos de interfaz** las crea todas de una vez (los textos con `{{ expresiones }}` se traducen a
mano con `game.t`). La columna *Uso* lleva a la interfaz.

Clic derecho en un selector de *Reglas en Estilo* (`#id`, `.clase`) → *Eliminar* quita ese ID o esa clase del control (el Nombre no).

A mano:

```html
<button @click="ui.open('opciones')">{{ game.t('menu.opciones', 'Opciones') }}</button>
<select :value="game.lang" @change="game.lang = $event.target.value">
  <option v-for="l in game.languages" :key="l.code" :value="l.code">{{ l.name }}</option>
</select>
```

Al cambiar `game.lang` todas las pantallas se redibujan en el idioma nuevo.

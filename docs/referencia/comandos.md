# Referencia de comandos de evento

Los comandos se insertan en la lista **Contenido** de una página de evento (doble clic en una línea vacía o «Insertar comando…»).
Se ejecutan en orden, uno detrás de otro; los que esperan (texto, esperar, fundido, cinemática…) detienen la lista hasta terminar.
Cada comando tiene un **equivalente en script** cuando existe (ver la [API de scripts](api.md)).

Hay 73 comandos en 8 grupos:

- **Mensajes**: [Mostrar texto](#text) · [Mostrar opciones](#choices) · [Subtítulo](#caption) · [Mostrar nombre del mapa](#levelname)
- **Flujo**: [Esperar](#wait) · [Esperar entrada](#waitinput) · [Modificar Input Map](#inputaction) · [Condición (Si…)](#if) · [Match (casos)](#match) · [Bucle](#loop) · [Romper bucle](#break) · [Salir del evento](#exit) · [Comentario](#comment)
- **Datos**: [Interruptor](#switch) · [Variable](#variable) · [Variable: lista](#variablearray) · [Auto-interruptor](#selfswitch)
- **Personajes e inventario**: [Cambiar oro](#gold) · [Cambiar objetos / armas / armaduras](#items) · [Vaciar inventario](#clearitems) · [Cambiar grupo](#party) · [Cambiar vida / energía](#actorstat) · [Cambiar nivel / experiencia](#level) · [Cambiar equipo](#equip) · [Arma equipada 3D](#weapon3d) · [Aprender / olvidar habilidad](#skill) · [Cambiar estado](#state) · [Recuperar a todo el grupo](#recoverall) · [Objeto 3D de Database](#item3d) · [Usar objeto](#useitem) · [Usar habilidad](#useskill) · [Cambiar nombre / apodo](#nameactor) · [Llamar evento común](#commonevent) · [Misiones y documentos](#journal)
- **Jugador y escena**: [Guardar partida](#savegame) · [Cargar partida](#loadgame) · [Borrar partida guardada](#deletesave) · [Permitir / bloquear guardado](#saveaccess) · [Abrir pantalla de guardado / carga](#savescreen) · [Control del jugador](#control) · [Teletransportar jugador](#teleport) · [Mover al view model](#viewmodel) · [Sacar del view model](#viewmodelrelease) · [Guardar objeto en variable](#stashitem) · [Sacar objeto guardado](#unstashitem) · [Ir a otra escena](#scene) · [Fundido de pantalla](#fade) · [Barras de cine](#letterbox) · [Mostrar / cerrar interfaz](#ui)
- **Mundo**: [Reproducir timeline (cinemática)](#timeline) · [Controlar cámara](#cameracontrol) · [Detener / omitir timeline](#timelinestop) · [Mostrar / ocultar nodo](#nodevisible) · [DontDestroyOnLoad](#nodepersist) · [Reproducir animación](#playanimation) · [Detener animación](#stopanimation) · [Controlar luz](#light) · [Mover nodo](#nodemove) · [Ruta de movimiento](#moveroute) · [Cambiar el clima](#weather) · [Relámpago (sin trueno automático)](#weatherlightning) · [Trueno independiente](#weatherthunder) · [Perfil de post-proceso](#profile) · [Hora del día](#clock) · [Borrar este evento](#erase)
- **Audio**: [Reproducir sonido](#sound) · [Detener sonidos](#soundstop) · [Volumen de un grupo](#audiogroup)
- **Avanzado**: [Emitir señal](#signal) · [Esperar señal](#waitsignal) · [Ejecutar evento](#runevent) · [Script (JavaScript)](#script) · [Llamar función de script](#callfn)

## Mensajes

<a id="text"></a>
### Mostrar texto

Código interno: `text` · En script: `await game.say('Hola', 'Anciana', 'bottom', { key, voice, advance })`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Quién habla `speaker` | texto |  |  |
| Texto `text` | texto largo |  | Usa {v:3} para insertar el valor de la variable 3 |
| Posición `pos` | lista | Abajo | Valores: Abajo · Centro · Arriba |
| Localización `loc` | clave de localización |  | Enlaza el texto con una clave de Juego ▸ Localización: el juego lo muestra en el idioma del jugador |
| Voz (audio) `voice` | audio |  | Audio en el idioma base; el de cada idioma se elige en Localización |
| Al terminar la voz, pasar al siguiente texto `voiceAdvance` | sí / no | sí | Desmárcalo para que el jugador tenga que pulsar aunque la voz haya terminado |
| Grupo de la voz `voiceGroup` | grupo del mezclador | voice |  |
| Animación de entrada `enter` | lista |  | Valores: Según la interfaz · Ninguna · Fundido · Subir · Aparecer (escala) · Deslizar |
| Animación de salida `exit` | lista |  | Valores: Según la interfaz · Ninguna · Fundido · Bajar · Encoger · Deslizar |
| Duración de la animación (s) `animTime` | número | 0.25 | Solo si según «$» |

<a id="choices"></a>
### Mostrar opciones

Código interno: `choices` · En script: `const i = await game.choose(['Sí', 'No'])`

Tiene bloques anidados (ramas o cuerpo) donde se insertan más comandos.

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Opciones `options` | lista de textos | Sí, No |  |
| Al cancelar (Esc) `cancel` | lista | Nada (no se puede cancelar) | Valores: Nada (no se puede cancelar) · Opción 1 · Opción 2 · Opción 3 · Opción 4 |
| Pregunta (opcional) `prompt` | texto |  |  |
| Animación de entrada `enter` | lista |  | Valores: Según la interfaz · Ninguna · Fundido · Subir · Aparecer (escala) · Deslizar |
| Animación de salida `exit` | lista |  | Valores: Según la interfaz · Ninguna · Fundido · Bajar · Encoger · Deslizar |
| Duración de la animación (s) `animTime` | número | 0.25 | Solo si según «$» |

<a id="caption"></a>
### Subtítulo

Código interno: `caption` · En script: `await game.caption('…', 3)`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Texto `text` | texto largo |  | Se muestra sin pedir confirmación y se quita solo. Ideal para cinemáticas. Usa {v:3} para variables. |
| Duración (s) `seconds` | número | 3 |  |
| Posición `pos` | lista | Abajo | Valores: Abajo · Centro · Arriba |
| Esperar a que desaparezca `wait` | sí / no | no |  |
| Animación de entrada `enter` | lista |  | Valores: Según la interfaz · Ninguna · Fundido · Subir · Aparecer (escala) · Deslizar |
| Animación de salida `exit` | lista |  | Valores: Según la interfaz · Ninguna · Fundido · Bajar · Encoger · Deslizar |
| Duración de la animación (s) `animTime` | número | 0.25 | Solo si según «$» |

<a id="levelname"></a>
### Mostrar nombre del mapa

Código interno: `levelName`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Texto (vacío = nombre del nivel) `text` | texto |  |  |
| Posición `pos` | lista |  | Valores: La del nivel · Abajo a la derecha · Abajo a la izquierda · Arriba a la derecha · Arriba a la izquierda · Centro |

## Flujo

<a id="wait"></a>
### Esperar

Código interno: `wait` · En script: `await game.wait(1)`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Segundos `seconds` | número | 1 |  |

<a id="waitinput"></a>
### Esperar entrada

Código interno: `waitInput` · En script: `await game.input.wait('interact')`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Acción o tecla `action` | acción o tecla | interact |  |

<a id="inputaction"></a>
### Modificar Input Map

Código interno: `inputAction`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Acción `action` | acción o tecla | jump |  |
| Operación `op` | lista | Desactivar acción | Valores: Desactivar acción · Activar acción · Añadir tecla · Reasignar (sustituye todas) · Restaurar por defecto |
| Tecla `key` | tecla |  | Solo si op = bind / rebind |

<a id="if"></a>
### Condición (Si…)

Código interno: `if`

Tiene bloques anidados (ramas o cuerpo) donde se insertan más comandos.

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Comprobar `kind` | lista | Interruptor | Valores: Interruptor · Variable · Auto-interruptor · Oro · Objeto en el inventario · Personaje en el grupo · Personaje conoce habilidad · Estado de misión · En la mano (view model) · Partida guardada · Se está reproduciendo una animación · Entrada (acción o tecla) · Script |
| Nodo `node` | nodo |  | Solo si kind = animating. Opcional |
| Animación (vacío = cualquiera) `clip` | animación |  | Solo si kind = animating. Opcional |
| Comprobar `sq` | lista | La ranura tiene una partida | Valores: La ranura tiene una partida · Hay alguna partida guardada · Se puede guardar (acceso permitido). Solo si kind = save |
| Ranura `slotSrc` | lista | Número | Valores: Número · Variable · La última usada · Autoguardado (0). Solo si kind = save, sq = exists |
| Número de ranura `slot` | número | 1 | Solo si kind = save, sq = exists, slotSrc = const |
| Variable con la ranura `slotVar` | variable | 1 | Solo si kind = save, sq = exists, slotSrc = variable |
| Comprobar `what` | lista | Un nodo está en la mano | Valores: Un nodo está en la mano · Un slot tiene algo · Un slot está vacío · Hay algo en las manos · Las manos están vacías. Solo si kind = held |
| Nodo `node` | nodo |  | Solo si kind = held, what = node. Opcional |
| Slot `slot` | slot | right | Solo si kind = held, what = slotFull / slotEmpty |
| Acción o tecla `action` | acción o tecla | interact | Solo si kind = input |
| Estado `state` | lista | Mantenida | Valores: Mantenida · Se acaba de pulsar · Se acaba de soltar. Solo si kind = input |
| Interruptor `id` | interruptor | 1 | Solo si kind = switch |
| Está `on` | lista | ON | Valores: ON · OFF. Solo si kind = switch / self |
| Variable `vid` | variable | 1 | Solo si kind = variable |
| Comparación `op` | lista | ≥ | Valores: ≥ · > · = · ≤ · < · ≠ · contiene (lista o texto) · no contiene. Solo si kind = variable |
| Comparar con `src` | lista | Constante (número) | Valores: Constante (número) · Texto · Otra variable. Solo si kind = variable |
| Valor `value` | número | 0 | Solo si kind = variable, src = const |
| Texto `text` | texto |  | Solo si kind = variable, src = text |
| Variable `vid2` | variable | 1 | Solo si kind = variable, src = variable |
| Auto-interruptor `ch` | auto-interruptor | A | Solo si kind = self |
| Comparación `op2` | lista | ≥ | Valores: ≥ · > · = · ≤ · < · ≠. Solo si kind = gold / item |
| Cantidad `n` | número | 1 | Solo si kind = gold / item |
| Objeto `item` | registro de la base de datos | 1 | Solo si kind = item |
| Personaje `actor` | registro de la base de datos | 1 | Solo si kind = actor / skill |
| Habilidad `skill` | registro de la base de datos | 1 | Solo si kind = skill |
| Misión `quest` | registro de la base de datos | 1 | Solo si kind = quest |
| Estado `qs` | lista | En curso | Valores: Sin empezar · En curso · Completada · Fallida. Solo si kind = quest |
| Expresión JS `expr` | expresión JS | true | Ej. game.variable("Llaves") >= 2. Solo si kind = script |
| Con «Si no» `hasElse` | sí / no | sí |  |

<a id="match"></a>
### Match (casos)

Código interno: `match`

Tiene bloques anidados (ramas o cuerpo) donde se insertan más comandos.

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Comparar `src` | lista | Variable | Valores: Variable · Número · Texto · Sí / No · Dato de señal · Expresión JS |
| Variable `variable` | variable | 1 | Solo si src = variable |
| Número `value` | número | 0 | Solo si src = number |
| Texto `text` | texto |  | Solo si src = text |
| Valor `flag` | lista | Sí | Valores: Sí · No. Solo si src = bool |
| Campo recibido `signalField` | texto | data | Ejemplos: data, itemId, metadata.id. Solo dentro de una señal.. Solo si src = signal |
| Expresión JS `expr` | expresión JS | 0 | Solo si src = script |
| Casos `cases` | matchcases | [object Object] |  |
| Añadir Default (_) `hasDefault` | sí / no | sí |  |

<a id="loop"></a>
### Bucle

Código interno: `loop`

Tiene bloques anidados (ramas o cuerpo) donde se insertan más comandos.

_Sin parámetros._

<a id="break"></a>
### Romper bucle

Código interno: `break`

_Sin parámetros._

<a id="exit"></a>
### Salir del evento

Código interno: `exit`

_Sin parámetros._

<a id="comment"></a>
### Comentario

Código interno: `comment`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Comentario `text` | texto largo |  |  |

## Datos

<a id="switch"></a>
### Interruptor

Código interno: `switch` · En script: `game.setSwitch('Llave', true)`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Interruptor `id` | interruptor | 1 |  |
| Valor `value` | lista | ON | Valores: ON · OFF · Alternar |

<a id="variable"></a>
### Variable

Código interno: `variable` · En script: `game.setVariable('Oro', 10)`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Variable `id` | variable | 1 |  |
| Operación `op` | lista | = (asignar) | Valores: = (asignar) · + (sumar) · − (restar) · × (multiplicar) · ÷ (dividir) · % (resto) |
| Operando `src` | lista | Número | Valores: Número · Texto · Sí / No · Lista · Otra variable · Aleatorio · Script · Dato de la señal recibida |
| Campo recibido `signalField` | texto | itemId | Ejemplos: itemId, delta, objectName, data. Solo dentro de una señal.. Solo si src = signal |
| Valor `value` | número | 1 | Solo si src = const |
| Texto `text` | texto |  | Admite \V[n] y {v:n}. Con «+ (sumar)» se concatena.. Solo si src = text |
| Valor `flag` | lista | Sí | Valores: Sí · No. Solo si src = bool |
| Elementos `list` | texto |  | Separados por comas: 1, 2, hola · o JSON: [1,[2,3]]. Con «+ (sumar)» se añaden a la lista.. Solo si src = list |
| Variable `id2` | variable | 1 | Solo si src = variable |
| Mínimo `min` | número | 0 | Solo si src = random |
| Máximo `max` | número | 10 | Solo si src = random |
| Expresión JS `expr` | expresión JS | 0 | Solo si src = script |

<a id="variablearray"></a>
### Variable: lista

Código interno: `variableArray` · En script: `game.variables.push('Lista', valor)`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Variable (lista) `id` | variable | 1 |  |
| Operación `op` | lista | Añadir al final | Valores: Añadir al final · Añadir al principio · Insertar en la posición · Fijar la posición · Sacar el último (→ resultado) · Sacar el primero (→ resultado) · Quitar la posición (→ resultado) · Quitar el valor · Leer la posición (→ resultado) · Cantidad de elementos (→ resultado) · Contiene el valor (1/0 → resultado) · Posición del valor (→ resultado) · Suma (→ resultado) · Mínimo (→ resultado) · Máximo (→ resultado) · Elemento al azar (→ resultado) · Unir en texto (→ resultado) · Ordenar · Invertir · Mezclar · Vaciar |
| Posición (desde 0) `idxSrc` | lista | Número | Valores: Número · Variable. Solo si op = insert / setAt / removeAt / at |
| Posición `index` | número | 0 | Solo si op = insert / setAt / removeAt / at, idxSrc = const |
| Variable de la posición `idxVar` | variable | 1 | Solo si op = insert / setAt / removeAt / at, idxSrc = variable |
| Valor `valSrc` | lista | Número | Valores: Número · Texto · Texto / número / lista (JSON) · Variable. Solo si op = push / unshift / insert / setAt / removeValue / includes / indexOf |
| Número `value` | número | 0 | Solo si op = push / unshift / insert / setAt / removeValue / includes / indexOf, valSrc = const |
| Texto `text` | texto |  | Solo si op = push / unshift / insert / setAt / removeValue / includes / indexOf, valSrc = text |
| Valor `literal` | texto |  | 3 · hola · true · [1,2] · {"a":1}. Solo si op = push / unshift / insert / setAt / removeValue / includes / indexOf, valSrc = literal |
| Variable del valor `valVar` | variable | 1 | Solo si op = push / unshift / insert / setAt / removeValue / includes / indexOf, valSrc = variable |
| Separador `sep` | texto | ,  | Solo si op = join |
| Guardar el resultado en `out` | variable | 0 | Solo si op = pop / shift / removeAt / at / length / includes / indexOf / sum / min / max / random / join / push / unshift / insert / setAt. Opcional |

<a id="selfswitch"></a>
### Auto-interruptor

Código interno: `selfSwitch` · En script: `game.setSelfSwitch('A', true)`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Auto-interruptor `ch` | auto-interruptor | A |  |
| Valor `value` | lista | ON | Valores: ON · OFF · Alternar |

## Personajes e inventario

<a id="gold"></a>
### Cambiar oro

Código interno: `gold` · En script: `game.party.addGold(50)`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Operación `op` | lista | Aumentar | Valores: Aumentar · Disminuir · Fijar |
| Cantidad `n` | número | 10 |  |

<a id="items"></a>
### Cambiar objetos / armas / armaduras

Código interno: `items` · En script: `game.party.gain('items', 'Poción', 1)`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Tipo `kind` | lista | Objeto | Valores: Objeto · Arma · Armadura |
| Objeto `item` | registro de la base de datos | 1 | Solo si kind = items |
| Arma `weapon` | registro de la base de datos | 1 | Solo si kind = weapons |
| Armadura `armor` | registro de la base de datos | 1 | Solo si kind = armors |
| Operación `op` | lista | Dar | Valores: Dar · Quitar · Fijar la cantidad · Quitar todos los que tenga |
| Cantidad desde `nsrc` | lista | Constante | Valores: Constante · Variable. Solo si op = add / sub / set |
| Cantidad `n` | número | 1 | Solo si op = add / sub / set, nsrc = const |
| Variable con la cantidad `nvar` | variable | 1 | Solo si op = add / sub / set, nsrc = variable |
| Mostrar aviso `msg` | sí / no | no |  |

<a id="clearitems"></a>
### Vaciar inventario

Código interno: `clearItems`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Qué vaciar `kind` | lista | Todo (objetos, armas y armaduras) | Valores: Todo (objetos, armas y armaduras) · Solo objetos · Solo armas · Solo armaduras |

<a id="party"></a>
### Cambiar grupo

Código interno: `party` · En script: `game.party.join('Ana')`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Acción `action` | lista | Añadir al grupo | Valores: Añadir al grupo · Quitar del grupo |
| Personaje `actor` | registro de la base de datos | 1 |  |

<a id="actorstat"></a>
### Cambiar vida / energía

Código interno: `actorStat`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Personaje `actor` | registro de la base de datos | 0 |  |
| Parámetro `stat` | lista | Vida | Valores: Vida · Energía |
| Operación `op` | lista | Aumentar | Valores: Aumentar · Disminuir · Recuperar todo |
| Cantidad `n` | número | 10 | Solo si op = add / sub |

<a id="level"></a>
### Cambiar nivel / experiencia

Código interno: `level`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Personaje `actor` | registro de la base de datos | 1 |  |
| Qué `what` | lista | Nivel | Valores: Nivel · Experiencia |
| Operación `op` | lista | Aumentar | Valores: Aumentar · Disminuir · Fijar (solo nivel) |
| Cantidad `n` | número | 1 |  |

<a id="equip"></a>
### Cambiar equipo

Código interno: `equip`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Personaje `actor` | registro de la base de datos | 1 |  |
| Ranura `slot` | registro de la base de datos | 1 |  |
| Objeto de equipo (0 = quitar) `item` | equipitem | 0 |  |

<a id="weapon3d"></a>
### Arma equipada 3D

Código interno: `weapon3D`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Acción `action` | lista | Equipar y mostrar en la mano | Valores: Equipar y mostrar en la mano · Ejecutar acción del arma · Desequipar y guardar el modelo |
| Personaje `actor` | registro de la base de datos | 1 |  |
| Evento del arma (vacío = este evento) `node` | nodo |  | El evento debe tener el gráfico «Arma» de Database.. Solo si action = equip |
| Slot del View Model `slot` | slot | right | Solo si action = equip |
| Objetivo `targetType` | lista | Según el alcance de la habilidad | Valores: Según el alcance de la habilidad · Personaje · Enemigo de Database. Solo si action = use |
| Personaje objetivo `targetActor` | registro de la base de datos | 1 | Solo si action = use, targetType = actor |
| Enemigo objetivo `targetEnemy` | registro de la base de datos | 1 | Solo si action = use, targetType = enemy |
| Mostrar mensaje `msg` | sí / no | no | Solo si action = use |

<a id="skill"></a>
### Aprender / olvidar habilidad

Código interno: `skill`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Personaje `actor` | registro de la base de datos | 1 |  |
| Acción `action` | lista | Aprender | Valores: Aprender · Olvidar |
| Habilidad `skill` | registro de la base de datos | 1 |  |

<a id="state"></a>
### Cambiar estado

Código interno: `state`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Personaje `actor` | registro de la base de datos | 0 |  |
| Acción `action` | lista | Añadir | Valores: Añadir · Quitar |
| Estado `state` | registro de la base de datos | 1 |  |

<a id="recoverall"></a>
### Recuperar a todo el grupo

Código interno: `recoverAll`

_Sin parámetros._

<a id="item3d"></a>
### Objeto 3D de Database

Código interno: `item3D`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Acción `action` | lista | Recoger en la mano | Valores: Recoger en la mano · Usar el objeto de la mano · Guardar en el inventario · Sacar del inventario a la mano |
| Evento del objeto (vacío = este evento) `node` | nodo |  | Debe ser un nodo Evento. Su gráfico «Objeto» vincula el registro de Database. |
| Objeto de Database (0 = usar el gráfico del evento) `item` | registro de la base de datos | 0 | Solo si action = pickup. Opcional |
| Slot de la mano `slot` | slot | right | Solo si action = pickup / take |
| Usar sobre `target` | registro de la base de datos | 0 | Solo si action = use. Opcional |
| Mostrar mensaje `msg` | sí / no | no | Solo si action = use |

<a id="useitem"></a>
### Usar objeto

Código interno: `useItem`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Objeto `item` | registro de la base de datos | 1 |  |
| Sobre `target` | registro de la base de datos | 0 |  |
| Mostrar mensaje `msg` | sí / no | no |  |

<a id="useskill"></a>
### Usar habilidad

Código interno: `useSkill`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Habilidad `skill` | registro de la base de datos | 1 |  |
| Usuario `user` | registro de la base de datos | 1 |  |
| Sobre `target` | registro de la base de datos | 0 |  |
| Mostrar mensaje `msg` | sí / no | no |  |

<a id="nameactor"></a>
### Cambiar nombre / apodo

Código interno: `nameActor`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Personaje `actor` | registro de la base de datos | 1 |  |
| Nombre (vacío = no cambiar) `name` | texto |  |  |
| Apodo (vacío = no cambiar) `nickname` | texto |  |  |

<a id="commonevent"></a>
### Llamar evento común

Código interno: `commonEvent` · En script: `await game.common('Curar')`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Evento común `id` | registro de la base de datos | 1 |  |

<a id="journal"></a>
### Misiones y documentos

Código interno: `journal`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Tipo `kind` | lista | Misión | Valores: Misión · Documento |
| Misión `quest` | registro de la base de datos | 1 | Solo si kind = quest |
| Acción `qa` | lista | Empezar | Valores: Empezar · Marcar objetivo · Completar (da recompensa) · Fallar · Reiniciar. Solo si kind = quest |
| Objetivo n.º `obj` | número | 1 | Solo si kind = quest, qa = objective |
| Documento `lore` | registro de la base de datos | 1 | Solo si kind = lore |
| Acción `la` | lista | Conseguir | Valores: Conseguir · Quitar. Solo si kind = lore |
| Mostrar aviso `msg` | sí / no | no |  |

## Jugador y escena

<a id="savegame"></a>
### Guardar partida

Código interno: `saveGame` · En script: `await game.save.save(1)`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Ranura `slotSrc` | lista | Número | Valores: Número · Variable · La última usada · Autoguardado (0). Solo si  |
| Número de ranura `slot` | número | 1 | Solo si slotSrc = const |
| Variable con la ranura `slotVar` | variable | 1 | Solo si slotSrc = variable |
| Nombre de la partida `name` | texto |  | Vacío = «Partida N». Admite \V[n] y {v:n}. |
| Guardar si salió bien en el interruptor `ok` | interruptor | 0 | Se activa si se guardó y se desactiva si el guardado está bloqueado.. Opcional |

<a id="loadgame"></a>
### Cargar partida

Código interno: `loadGame` · En script: `await game.save.load(1)`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Ranura `slotSrc` | lista | Número | Valores: Número · Variable · La última usada · Autoguardado (0). Solo si  |
| Número de ranura `slot` | número | 1 | Solo si slotSrc = const |
| Variable con la ranura `slotVar` | variable | 1 | Solo si slotSrc = variable |
| Resultado en el interruptor `ok` | interruptor | 0 | ON si se cargó, OFF si la ranura estaba vacía (entonces no pasa nada).. Opcional |

<a id="deletesave"></a>
### Borrar partida guardada

Código interno: `deleteSave` · En script: `game.save.delete(1)`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Ranura `slotSrc` | lista | Número | Valores: Número · Variable · La última usada · Autoguardado (0). Solo si  |
| Número de ranura `slot` | número | 1 | Solo si slotSrc = const |
| Variable con la ranura `slotVar` | variable | 1 | Solo si slotSrc = variable |

<a id="saveaccess"></a>
### Permitir / bloquear guardado

Código interno: `saveAccess`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Guardar `value` | lista | Permitido | Valores: Permitido · Bloqueado · Alternar |

<a id="savescreen"></a>
### Abrir pantalla de guardado / carga

Código interno: `saveScreen`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Modo `mode` | lista | Guardar | Valores: Guardar · Cargar |
| Interfaz `ui` | interfaz |  | Tu pantalla de ranuras (Assets/UI). Recibe las props { mode, slots } y puede usar game.save. Vacío = la de Base de datos ▸ Jugador. |
| Esperar a que se cierre `wait` | sí / no | sí |  |

<a id="control"></a>
### Control del jugador

Código interno: `control` · En script: `game.control('locked')`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Jugador `mode` | lista | Libre (puede moverse y mirar) | Valores: Libre (puede moverse y mirar) · Bloqueado (puede mirar, no moverse) · Congelado (ni moverse ni mirar) |

<a id="teleport"></a>
### Teletransportar jugador

Código interno: `teleport` · En script: `await game.teleport(x, y, z)`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Destino `mode` | lista | Un nodo de la escena (p. ej. un Spawn) | Valores: Un nodo de la escena (p. ej. un Spawn) · Posición |
| Nodo `node` | nodo |  | Solo si mode = node |
| Posición `pos` | x, y, z | 0, 0, 0 | Solo si mode = pos |
| Mirar hacia (°, vacío = igual) `yaw` | texto |  |  |

<a id="viewmodel"></a>
### Mover al view model

Código interno: `viewModel` · En script: `await game.viewModel.attach('Linterna')`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Qué mover `node` | nodo |  | Vacío = el propio evento. O elige otro nodo: un evento, un trigger, un modelo…. Opcional |
| Slot `slot` | slot | right | Mano derecha, mano izquierda, ojos… (Base de datos ▸ Jugador) |
| Ajuste de posición `pos` | x, y, z | 0, 0, 0 | Respecto al slot, en metros |
| Ajuste de rotación (°) `rot` | x, y, z | 0, 0, 0 |  |
| Escala `scale` | número | 1 |  |
| Duración (s) `seconds` | número | 0.25 |  |
| Esperar a que termine `wait` | sí / no | no |  |

<a id="viewmodelrelease"></a>
### Sacar del view model

Código interno: `viewModelRelease` · En script: `await game.viewModel.release()`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Qué sacar `what` | lista | Un nodo (por defecto, este evento) | Valores: Un nodo (por defecto, este evento) · Todo lo que haya en un slot · Todo el view model |
| Nodo `node` | nodo |  | Solo si what = node. Opcional |
| Slot `slot` | slot | right | Solo si what = slot |
| Cómo `how` | lista | Soltar | Valores: Soltar · Tirar (lanzar hacia donde miras). Solo si what = node |
| Fuerza (m/s) `speed` | número | 8 | Solo si what = node, how = throw |
| Dónde queda `where` | lista | Delante del jugador, en el suelo | Valores: Delante del jugador, en el suelo · En una posición del mundo. Solo si what = node, how = drop |
| Posición `pos` | x, y, z | 0, 0, 0 | Solo si what = node, how = drop, where = pos |
| Duración (s) `seconds` | número | 0.35 | Solo si según «how» |
| Esperar a que termine `wait` | sí / no | no |  |

<a id="stashitem"></a>
### Guardar objeto en variable

Código interno: `stashItem` · En script: `game.viewModel.stash()`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Qué guardar `what` | lista | Lo que el jugador lleva en la mano | El objeto desaparece (sin colisión ni eventos) pero sigue existiendo: puedes devolverlo después con «Sacar objeto guardado».. Valores: Lo que el jugador lleva en la mano · Un nodo (se quita del mundo) |
| Slot `slot` | slot | right | Solo si what = hand |
| Nodo `node` | nodo |  | Solo si what = node |
| Guardarlo en la variable `out` | variable | 0 | Queda una referencia al objeto (no una copia). Con ella, «Sacar objeto guardado» lo devuelve, aunque entretanto haya cambiado de página.. Opcional |
| Interruptor: ON si había algo que guardar `okSw` | interruptor | 0 | Opcional |

<a id="unstashitem"></a>
### Sacar objeto guardado

Código interno: `unstashItem` · En script: `await game.viewModel.unstash(item)`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Qué sacar `src` | lista | El objeto guardado en una variable | Valores: El objeto guardado en una variable · Un nodo guardado |
| Variable `var` | variable | 1 | Solo si src = variable |
| Nodo `node` | nodo |  | Solo si src = node |
| Dónde aparece `to` | lista | En la mano del jugador | Valores: En la mano del jugador · En el mundo |
| Slot `slot` | slot | right | Solo si to = hand |
| Posición `where` | lista | Delante del jugador, en el suelo | Valores: Delante del jugador, en el suelo · En una posición del mundo. Solo si to = world |
| Coordenadas `pos` | x, y, z | 0, 0, 0 | Solo si to = world, where = pos |
| Vaciar la variable después `clear` | sí / no | sí | Solo si src = variable |
| Interruptor: ON si se sacó, OFF si no había nada `okSw` | interruptor | 0 | Opcional |

<a id="scene"></a>
### Ir a otra escena

Código interno: `scene` · En script: `await game.goScene('Nivel2', 'inicio')`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Escena `scene` | escena |  |  |
| Dónde aparece `where` | lista | En un nodo por etiqueta o nombre | Valores: En un nodo por etiqueta o nombre · En una posición exacta |
| Etiqueta o nombre del nodo `tag` | texto | player | Solo si where = spawn |
| Posición `pos` | x, y, z | 0, 0, 0 | Solo si where = pos |
| Mirar hacia (°, vacío = el del marcador antiguo) `yaw` | texto |  |  |
| Fundido al salir (s) `fadeOut` | número | 0.5 | 0 = corte directo |
| Fundido al llegar (s) `fadeIn` | número | 0.5 |  |
| Color del fundido `color` | color | #000000 |  |

<a id="fade"></a>
### Fundido de pantalla

Código interno: `fade` · En script: `await game.fade('out', 1, '#000')`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Fundido `dir` | lista | A color (oscurecer) | Valores: A color (oscurecer) · Desde color (aclarar) |
| Duración (s) `seconds` | número | 1 |  |
| Color `color` | color | #000000 |  |

<a id="letterbox"></a>
### Barras de cine

Código interno: `letterbox` · En script: `game.letterbox(12)`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Alto de cada barra (% de la pantalla) `percent` | número | 12 | 0 = quitar las barras. Las cinemáticas las quitan al terminar. |

<a id="ui"></a>
### Mostrar / cerrar interfaz

Código interno: `ui` · En script: `await game.ui.open('inventario')`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Acción `action` | lista | Abrir | Valores: Abrir · Cerrar · Alternar · Mostrar Canvas · Ocultar Canvas · Alternar Canvas |
| Nodo Canvas `canvas` | nodo |  | Solo si action = showCanvas / hideCanvas / toggleCanvas |
| Interfaz `ui` | interfaz |  | Solo si action = open / close / toggle |
| Datos (JSON, opcional) `props` | texto |  | Llegan a la interfaz como «props»: {"mensaje":"Hola"}. Solo si action = open / toggle |
| Modo `modal` | lista | El que indique la interfaz | Valores: El que indique la interfaz · Modal (libera el ratón y pausa) · No modal. Solo si action = open / toggle |
| Esperar a que se cierre `wait` | sí / no | no | Solo si action = open |

## Mundo

<a id="timeline"></a>
### Reproducir timeline (cinemática)

Código interno: `timeline` · En script: `await game.timeline.play('Intro')`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Timeline `timeline` | cinemática |  |  |
| Esperar a que termine `wait` | sí / no | sí |  |
| Velocidad `speed` | número | 1 |  |
| Empezar en (s) `from` | número | 0 |  |

<a id="cameracontrol"></a>
### Controlar cámara

Código interno: `cameraControl`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Acción `action` | lista | Activar Camera3D | Valores: Activar Camera3D · Cambiar Camera3D del evento · Liberar control de cámara |
| Camera3D `node` | nodo |  | Selecciona un nodo Camera3D de esta escena. No se usa la cámara de navegación del Editor.. Solo si action = activate / change |
| Al liberar `to` | lista | Mantener Camera3D viva | Mantener sigue una Camera3D viva. Pose fija conserva una captura, sin seguir al nodo.. Valores: Mantener Camera3D viva · Volver a cámara base · Activar otra Camera3D · Recuperar fuente anterior · Activar jugador · Mantener pose fija. Solo si action = release |
| Camera3D destino `cameraId` | nodo |  | Solo si action = release, to = camera3d |
| Duración (s) `seconds` | número | 0 | 0 = corte inmediato. Duración en segundos del juego. |
| Interpolación `ease` | lista | Suave (In/Out) | Durante el blend, solo el propietario puede cambiar la cámara.. Valores: Suave (In/Out) · Lineal |

<a id="timelinestop"></a>
### Detener / omitir timeline

Código interno: `timelineStop` · En script: `game.timeline.stop('Intro')`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Timeline (vacío = el último) `timeline` | cinemática |  | Opcional |
| Omitir (salta al final y ejecuta lo imprescindible) `skip` | sí / no | no |  |

<a id="nodevisible"></a>
### Mostrar / ocultar nodo

Código interno: `nodeVisible` · En script: `game.node('Puerta').visible = false`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Nodo `node` | nodo |  |  |
| Visible `visible` | sí / no | sí |  |

<a id="nodepersist"></a>
### DontDestroyOnLoad

Código interno: `nodePersist`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Nodo (vacío = este evento) `node` | nodo |  | Opcional |
| Conservar entre escenas `enabled` | sí / no | sí |  |

<a id="playanimation"></a>
### Reproducir animación

Código interno: `playAnimation` · En script: `game.node('Puerta').playAnimation('Abrir')`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Nodo `node` | nodo |  | Sobre quién se reproduce. Las pistas del clip se resuelven desde este nodo hacia sus hijos.. Opcional |
| Animación `clip` | animación |  |  |
| Bucle `loop` | lista | Como dice la animación | Valores: Como dice la animación · Sí, en bucle · No |
| Velocidad `speed` | número | 1 |  |
| Mezcla de entrada (s) `fade` | número | 0 |  |
| Empezar en (s) `from` | número | 0 |  |
| Capa (animaciones de modelo) `layer` | texto |  | Los clips de una misma capa se sustituyen entre sí; capas distintas suenan a la vez (p. ej. «piernas» y «brazos»). Vacío = capa única. |
| Solo huesos que contengan… `mask` | texto |  | Animaciones de modelo: textos separados por comas (p. ej. «spine, arm, hand») para animar solo esa parte del cuerpo. Vacío = todo. |
| Peso de mezcla (0–1) `weight` | número | 1 |  |
| Esperar a que termine `wait` | sí / no | no |  |

<a id="stopanimation"></a>
### Detener animación

Código interno: `stopAnimation` · En script: `game.node('Puerta').stopAnimation()`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Nodo `node` | nodo |  | Opcional |
| Animación (vacío = todas las del nodo) `clip` | animación |  | Opcional |
| Volver a la pose inicial `reset` | sí / no | no |  |
| Solo esta capa `layer` | texto |  | Vacío = todas las animaciones. Con nombre: solo las de esa capa (animaciones de modelo). |

<a id="light"></a>
### Controlar luz

Código interno: `light` · En script: `game.lights('Pasillo').forEach((l) => l.turnOff(1))`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Luz `node` | nodo |  | Opcional |
| O todas las luces con la etiqueta `tag` | texto |  | Si se escribe, afecta a todas las luces con esa etiqueta (Tags y Layers) |
| Estado `state` | lista | No cambiar | Valores: No cambiar · Encender · Apagar · Alternar |
| Cambiar color `setColor` | sí / no | no |  |
| Color `color` | color | #ffffff | Solo si setColor = true |
| Cambiar intensidad `setEnergy` | sí / no | no |  |
| Intensidad (energía) `energy` | número | 1.5 | Solo si setEnergy = true |
| Cambiar alcance `setRange` | sí / no | no |  |
| Alcance (m) `range` | número | 12 | Solo si setRange = true |
| Fundido (s) `seconds` | número | 0 | Encender/apagar y los cambios se mezclan en este tiempo |
| Esperar a que termine `wait` | sí / no | no |  |

<a id="nodemove"></a>
### Mover nodo

Código interno: `nodeMove` · En script: `await game.node('Caja').move([0, 1, 0], 1, true)`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Nodo `node` | nodo |  |  |
| Desplazamiento relativo `rel` | sí / no | sí |  |
| Posición / desplazamiento `pos` | x, y, z | 0, 1, 0 |  |
| Duración (s) `seconds` | número | 1 |  |
| Esperar a que termine `wait` | sí / no | sí |  |

<a id="moveroute"></a>
### Ruta de movimiento

Código interno: `moveRoute` · En script: `await game.moveRoute('this', [['forward', 2]])`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Quién se mueve `target` | lista | Este evento | Valores: Este evento · El jugador · Otro nodo |
| Nodo `node` | nodo |  | Solo si target = node |
| Ruta `route` | ruta | [object Object] |  |
| Esperar a que termine `wait` | sí / no | sí |  |

<a id="weather"></a>
### Cambiar el clima

Código interno: `weather` · En script: `game.weather.set('rain', 1, 5)`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Tiempo `preset` | lista | Lluvia | Valores: Despejado · Parcialmente nublado · Nublado · Cubierto · Niebla · Llovizna · Lluvia · Tormenta · Nieve |
| Intensidad `intensity` | número | 1 |  |
| Transición (s) `seconds` | número | 8 | 0 = cambio inmediato |
| Esperar a que termine `wait` | sí / no | no | Solo si según «seconds» |

<a id="weatherlightning"></a>
### Relámpago (sin trueno automático)

Código interno: `weatherLightning`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Distancia (m) `distance` | número | 1200 |  |
| Rumbo (°) `bearing` | número | 0 |  |

<a id="weatherthunder"></a>
### Trueno independiente

Código interno: `weatherThunder`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Distancia acústica (m) `distance` | número | 1200 |  |
| Rumbo (°) `bearing` | número | 0 |  |

<a id="profile"></a>
### Perfil de post-proceso

Código interno: `profile` · En script: `game.profile.set('Noche', 2)`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Perfil `profile` | perfil |  | Un recurso de Assets/Profiles. Vacío = restaurar Cámara, GameManager o Render |
| Transición (s) `seconds` | número | 1.5 |  |
| Esperar a que termine `wait` | sí / no | no |  |

<a id="clock"></a>
### Hora del día

Código interno: `clock` · En script: `game.clock.set(20, 5)`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Acción `action` | lista | Poner la hora | Valores: Poner la hora · Avanzar horas · Que transcurra el tiempo · Detener el tiempo |
| Hora (0–24) `hour` | número | 20 | Solo si action = set |
| Horas a avanzar `hours` | número | 6 | Solo si action = advance |
| Minutos reales por día `dayMinutes` | número | 24 | Solo si action = flow |
| Transición (s) `seconds` | número | 4 | El sol avanza hasta esa hora, no salta. Solo si action = set / advance |
| Esperar a que termine `wait` | sí / no | no | Solo si action = set / advance |

<a id="erase"></a>
### Borrar este evento

Código interno: `erase` · En script: `event.erase()`

_Sin parámetros._

## Audio

<a id="sound"></a>
### Reproducir sonido

Código interno: `sound` · En script: `game.audio.play('puerta.ogg')`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Clip `clip` | audio |  |  |
| Grupo del mezclador `group` | grupo del mezclador | sfx |  |
| Volumen `volume` | número | 1 |  |
| Tono `pitch` | número | 1 |  |
| En bucle `loop` | sí / no | no |  |
| Esperar a que termine `wait` | sí / no | no | Solo si loop = false |

<a id="soundstop"></a>
### Detener sonidos

Código interno: `soundStop`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Grupo (vacío = todos) `group` | grupo del mezclador |  | Opcional |
| Fundido (s) `fade` | número | 0 |  |

<a id="audiogroup"></a>
### Volumen de un grupo

Código interno: `audioGroup`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Grupo `group` | grupo del mezclador | music |  |
| Volumen (0–1) `volume` | número | 1 |  |
| Fundido (s) `seconds` | número | 0 |  |
| Silenciar `mute` | lista | No cambiar | Valores: No cambiar · Silenciar · Activar |
| Esperar al fundido `wait` | sí / no | no |  |

## Avanzado

<a id="signal"></a>
### Emitir señal

Código interno: `signal` · En script: `await game.emit('abrir', dato)`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Señal `name` | signal |  | Nativas y personalizadas. Emitir una señal no ejecuta su operación: solo avisa a quien la escuche. |
| Dato que lleva `dataSrc` | lista | Ninguno | Valores: Ninguno · Número · Texto · Valor de una variable · Datos de la señal recibida |
| Número `value` | número | 0 | Solo si dataSrc = number |
| Texto `text` | texto |  | Admite \V[n] y {v:n}.. Solo si dataSrc = text |
| Variable `dataVar` | variable | 1 | Solo si dataSrc = variable |
| Esperar a que terminen los game.on `wait` | sí / no | no |  |

<a id="waitsignal"></a>
### Esperar señal

Código interno: `waitSignal` · En script: `await game.waitFor('abrir')`

Tiene bloques anidados (ramas o cuerpo) donde se insertan más comandos.

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Ejecutar ramas `flow` | sí / no | sí | Los comandos nuevos tienen cuerpo propio. Desactivar conserva la espera lineal antigua. |
| Señal `name` | signal |  |  |
| Tiempo máximo (s) `timeout` | número | 0 | 0 = esperar sin límite |
| Variable (opcional, proyectos anteriores) `out` | variable | 0 | Opcional |
| Interruptor de resultado (opcional) `okSw` | interruptor | 0 | Solo si según «timeout». Opcional |

<a id="runevent"></a>
### Ejecutar evento

Código interno: `runEvent` · En script: `await game.event('Puerta').run()`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Evento `node` | nodo |  | Corre los comandos de ese evento en segundo plano (no bloquea al jugador). Si ya se está ejecutando, no se repite. |
| Página (0 = la activa) `page` | número | 0 | Número de página a ejecutar aunque no cumpla sus condiciones; 0 = la página que está activa ahora. |
| Esperar a que termine `wait` | sí / no | sí |  |

<a id="script"></a>
### Script (JavaScript)

Código interno: `script` · En script: `(el propio código)`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Código `code` | código JS | // game, event y args disponibles; se admite await |  |

<a id="callfn"></a>
### Llamar función de script

Código interno: `callFn` · En script: `await game.call('miFuncion', 1, 2)`

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Nombre de la función `name` | texto |  | Definida en un script del proyecto con game.define("nombre", fn) |
| Argumentos (JSON, lista) `args` | texto | [] |  |

## Condiciones de página

Una página está activa si se cumplen **todas** las condiciones marcadas (gana la última página activa, como en RPG Maker).

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Interruptor `sw1` | interruptor |  | Opcional |
| Interruptor `sw2` | interruptor |  | Opcional |
| Variable `vr` | variable |  | Opcional |
| Comparación `vrOp` | lista | ≥ | Valores: ≥ · > · = · ≤ · < · ≠. Solo si según «vr» |
| Valor `vrVal` | número | 0 | Solo si según «vr» |
| Objeto `item` | registro de la base de datos | 0 | Opcional |
| Personaje en el grupo `actor` | registro de la base de datos | 0 | Opcional |
| Auto-interruptor `self` | lista |  | Valores: — · A · B · C · D |
| Script (true/false) `script` | expresión JS |  | Expresión JS; ej. game.variable(3) > 2 |

## Gráfico de página

Lo que se dibuja mientras la página está activa.

| Parámetro | Tipo | Por defecto | Notas |
|---|---|---|---|
| Gráfico `kind` | lista | Ninguno | Valores: Ninguno · Caja · Esfera · Cilindro · Cono · Plano · Rampa · Escaleras · Modelo del proyecto · Prefab · Sprite (imagen) · Personaje (base de datos) · Enemigo (base de datos) · Objeto (base de datos) · Arma (base de datos) · Armadura (base de datos) |
| Modelo `modelId` | modelo |  | Solo si kind = model |
| Prefab `prefabId` | prefab |  | Se dibuja el prefab entero (mallas, modelos, luces…). Cambiar de página cambia el conjunto: una farola encendida en la página 1 y rota en la 2.. Solo si kind = prefab |
| Imagen `imageId` | image |  | Solo si kind = sprite |
| Tamaño del píxel (m) `pixelSize` | número | 0.03 | Solo si kind = sprite |
| Mirar a la cámara `billboard` | lista | Gira en vertical hacia la cámara | Valores: No (plano fijo) · Gira en vertical hacia la cámara · Siempre de frente a la cámara. Solo si kind = sprite |
| Filtro `filter` | lista | Píxeles nítidos (pixel art) | Valores: Suave · Píxeles nítidos (pixel art). Solo si kind = sprite |
| Personaje `actorId` | registro de la base de datos | 1 | El modelo, color y tamaño salen de Base de datos ▸ Personajes. En los textos, \N[0] es el nombre de este personaje.. Solo si kind = actor |
| Enemigo `enemyId` | registro de la base de datos | 1 | Solo si kind = enemy |
| Objeto `itemId` | registro de la base de datos | 1 | Solo si kind = item |
| Arma `weaponId` | registro de la base de datos | 1 | Solo si kind = weapon |
| Armadura `armorId` | registro de la base de datos | 1 | Solo si kind = armor |
| Color `color` | color | #d9a05b | Solo si kind = box / sphere / cylinder / cone / plane / ramp / stairs |
| Tamaño (m) `size` | x, y, z | 1, 1, 1 | Solo si kind = box / sphere / cylinder / cone / plane / ramp / stairs / model / prefab |
| Peldaños `steps` | número | 8 | Solo si kind = stairs |

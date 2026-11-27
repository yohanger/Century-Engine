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
3. Usa `game.switch` con el nombre del interruptor que creaste.

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

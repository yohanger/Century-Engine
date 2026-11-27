# Códigos de texto

Sirven en «Mostrar texto», «Mostrar opciones», «Subtítulo», `game.say()`, `game.t()` y las traducciones de la ventana Localización.

## Valores

| Código | Se sustituye por |
|---|---|
| `\V[n]` | Valor de la variable `n` (número o nombre: `\V[Monedas]`). También `{v:n}`. |
| `\N[n]` | Nombre del personaje `n` de la base de datos (`\N[0]` = el personaje del gráfico del evento). |
| `\P[n]` | Nombre del miembro `n` del grupo. |
| `\G` | Moneda (Base de datos ▸ Sistema). |
| `\L` | Nombre del nivel actual. |
| `\I[n]` · `\I[item:3]` | Icono del registro (objeto, arma, armadura, habilidad, estado…). Si el icono es una imagen, se dibuja la imagen dentro del texto. |
| `{t:clave}` | Texto de esa clave de Localización en el idioma actual. Ej.: `{t:objetos.llave}`. |

## Estilo

| Código | Efecto |
|---|---|
| `\C[n]` · `\C[#rrggbb]` · `\C[rojo]` | Color (0 vuelve al normal). |
| `\{` · `\}` | Texto más grande / más pequeño. |
| `\FS[n]` | Tamaño de fuente en px. |
| `\B[1]` · `\IT[1]` | Negrita / cursiva (`[0]` las quita). |

## Efectos animados

`\FX[efecto]` anima el texto que sigue, letra a letra, hasta `\FX[0]` (o `\FX[]`). Sirve para una palabra o para toda la frase.
Con `:n` se cambia la intensidad (0.1 – 5): `\FX[temblor:2]`.

| Código | Efecto |
|---|---|
| `\FX[temblor]` | Cada letra tiembla por separado (miedo, gritos). |
| `\FX[ola]` | Las letras suben y bajan en onda. |
| `\FX[pulso]` | Crece y encoge. |
| `\FX[parpadeo]` | Como una luz que falla. |
| `\FX[glitch]` | Cortes y desplazamientos de color. |
| `\FX[susurro]` | Más pequeño y tenue, con vaivén. |
| `\FX[arcoiris]` | El color recorre las letras. |
| `\FX[flotar]` | Vaivén lento de todo el trozo. |

También en inglés: `shake`, `wave`, `pulse`, `flicker`, `whisper`, `rainbow`, `float`. Se combinan con los de estilo:
`\C[2]\FX[temblor:2]¡SAL DE AHÍ!\FX[0]\C[0]`. Las palabras con efecto no se parten al cambiar de línea.

## Ritmo

| Código | Efecto |
|---|---|
| `\.` · `\|` | Pausa de 1/4 s · 1 s. |
| `\!` | Espera a que el jugador pulse. |
| `\>` … `\<` | El texto entre ellos aparece de golpe. |
| `\^` | Cierra el diálogo sin esperar. |
| `\D[s]` | El texto se queda `s` segundos y pasa solo. |
| `\F[expresión]` | Cambia la expresión del **Retrato** a partir de ese punto (`\F[triste]`). No se ve en el texto. |
| `\\` | Una barra `\`. |

## Voz y avance

Con **Voz (audio)** en «Mostrar texto» (o `game.say(texto, quien, pos, { voice })`), el diálogo pasa solo cuando termina el audio.
Desmarca *Al terminar la voz, pasar al siguiente texto* (`{ advance: false }`) para que espere a que el jugador pulse. Si el jugador
pulsa antes, la voz se corta.

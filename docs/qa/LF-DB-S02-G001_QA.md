# LF-DB-S02-G001 — Objetos e interacción 3D

**Gate:** autorizado el 23 de octubre de 2026. **Baseline recibido:** `levelforge(20261023-115326).zip`.
**QA del usuario:** pendiente. Esta entrega no cierra S02 hasta realizar las comprobaciones locales.

## Qué se implementó

Se añadió el comando de evento **Objeto 3D de Database**. No se añade otro inventario ni otro sistema de manos. El modelo sale del registro de Database mediante el gráfico **Objeto (base de datos)** que ya tiene cada página de evento.

| Acción del comando | Resultado |
|---|---|
| Recoger en la mano | Adjunta el evento al View Model y suma 1 unidad al inventario. |
| Usar el objeto de la mano | Ejecuta `Party.useItem()` con contexto `event`. Si es consumible, desaparece el modelo y se descuenta 1 unidad. Si se rechaza el uso, no cambia nada. |
| Guardar en el inventario | Oculta el evento de la mano; **no vuelve a sumar una unidad**, porque ya se contó al recoger. |
| Sacar del inventario a la mano | Recupera ese evento guardado y lo coloca en el slot elegido, sin duplicar inventario. |

Al soltar o lanzar un objeto recogido mediante este comando, vuelve al mundo y se descuenta la unidad que ya no está en posesión del jugador. Los objetos normales que no pasan por este comando siguen usando el comportamiento anterior del View Model.

El estado lógico de los objetos está en `game.state.dbItems3D` (`itemId`, `status` por ID de evento), por lo que participa del guardado existente. Al cargar o volver a la escena del evento, un objeto guardado o consumido no se debe volver a ofrecer como si fuera nuevo.

## Montar una prueba sin scripts

1. En **Base de datos → Objetos**, crea un objeto de prueba: nombre `Poción 3D`, modelo `Cubo` (o cualquier modelo importado), consumible `Sí`, alcance `Un aliado`, disponible `Siempre`, efecto `Recuperar vida +25`.
2. Coloca un **nodo Evento** en una escena con jugador. En la página 1, selecciona **Gráfico → Objeto (base de datos)** y elige `Poción 3D`. Disparador: **Botón de acción**.
3. Añade un único comando a su lista: **Objeto 3D de Database → Recoger en la mano**. Deja vacío **Evento del objeto**, porque desde esa página significa «este evento». Slot: `right`.
4. En **Jugar**, acércate y pulsa la acción de interacción. Comprueba que el cubo queda en la mano y el inventario aumenta exactamente en uno.
5. Para usarlo, crea otro evento con disparador **Al pulsar una acción** (una entrada del Input Map que no choque con `drop`). En su lista, añade **Objeto 3D de Database → Usar el objeto de la mano** y selecciona en **Evento del objeto** el primer evento. Reduce antes los HP del personaje para comprobar su recuperación.
6. Repite con un objeto cuya opción **Se consume al usarlo** esté desactivada: después del uso debe continuar en la mano y conservar la cantidad.
7. Para probar **Guardar**, crea otro evento de entrada con el comando **Objeto 3D de Database → Guardar en el inventario**, apuntando al mismo evento físico. Comprueba que se oculta el modelo y la cantidad NO aumenta por segunda vez.
8. Para probar **Sacar**, añade un evento de entrada con **Objeto 3D de Database → Sacar del inventario a la mano** para ese mismo evento. Debe volver el modelo a la mano sin crear otra unidad.
9. Con el objeto en la mano, usa **drop**: pulsación corta para soltar; mantener para lanzar. Comprueba que sale de la mano, vuelve al mundo y se descuenta una unidad del inventario. Vuelve a recogerlo una sola vez.
10. **Guarda una partida** con el objeto almacenado en inventario. Cambia el estado, **carga la partida** y vuelve a la escena: no debe duplicarse el objeto ni aparecer como disponible en el suelo.
11. Ejecuta la misma prueba en **Player exportado**. La compilación `npm run build` no sustituye a esta prueba.

**Importante:** el objeto sigue siendo un *evento físico de la escena de origen*. La cantidad de inventario persiste entre escenas; el traslado visual de ese mismo evento a otra escena no forma parte de S02. Las acciones «Guardar» y «Sacar» de este Gate requieren que ese evento exista en la escena activa. Esta limitación está registrada y no debe presentarse como resuelta en la QA.

## Pruebas automatizadas

```bash
cd "$HOME/ENGINES/lf-0.26.13/lf"
node --test scripts/test-db-contract.mjs
npm run build
```

Resultado de la batería Node implementada en esta entrega:

```text
# tests 83
# pass 83
# fail 0
# todo 0
```

**No se ejecutó `npm run build` en el entorno de preparación** porque el source ZIP no contiene `node_modules`. Requiere evidencia de compilación en tu equipo y QA visual tanto de editor como de Player.

## Qué quedó fuera

No se añadieron señales nativas automáticas para recoger, soltar, tirar, guardar ni equipar. Esa decisión permanece pospuesta hasta después de los Sprints actuales. Tampoco se añadieron armas, recarga, acciones de equipamiento ni animaciones obligatorias (S03–S04).

## Entregables

- `LF-DB-S02-G001_CHANGE.zip`: solo los archivos modificados respecto al baseline recibido.
- `LevelForge_S02_SOURCE_BASELINE.zip`: árbol completo actualizado del **código fuente y documentación** (sin `node_modules`, `dist-player` ni otros compilados). Es la base para el siguiente Sprint y evita solicitar nuevamente el proyecto entero.

# LF-GP-OBJ-G001 — Gameplay Object: integración y QA

**Baseline:** LevelForge_EV_ORDER_G001_SOURCE_BASELINE.zip  
**Estado del Gate:** implementado; pendiente de pruebas gráficas y de exportación en el equipo del usuario.  
**Alcance:** un nodo Gameplay independiente de las páginas de eventos, para Objetos/Armas de Database. No se modifican los comandos heredados `item3D`, `weapon3D` ni «Mover al View Model».

## Configuración del caso principal

1. En Database crea un Objeto con modelo 3D válido, nombre y propiedades físicas. Usa `Dynamic` para la prueba de caída y `Static` para la de objeto inmóvil. Como pruebas separadas, crea también un Arma con modelo 3D y una habilidad configurada.
2. En el editor, añade **Gameplay → Objeto interactuable** a una escena con jugador y terreno/soporte.
3. En el Inspector del nodo, selecciona **Objeto** o **Arma**, el registro de Database, la modalidad y un slot del View Model configurado en Database → Jugador.
4. La modalidad **Recoger al inventario** añade una unidad lógica al recoger; la modalidad **Sostener directamente** no modifica inventario hasta guardar. Ninguna necesita páginas, auto-interruptores o comandos de evento.
5. No uses la misma tecla en varias acciones. Los valores por defecto añadidos son **E = interactuar**, **F = usar**, **R = guardar**, **Q = sacar**; las acciones preexistentes de soltar/lanzar permanecen sujetas al Input Map del proyecto.
6. Prueba las operaciones en una escena aislada y luego con un evento narrativo que escuche las señales nativas.

## Batería automática

```bash
cd "$HOME/ENGINES/lf-0.26.13/lf"
node --test scripts/test-db-contract.mjs
npm run build
```

**Esperado del runner Node:** 204 PASS, 0 FAIL, 0 TODO. La cifra depende del baseline exacto de esta entrega. Las nuevas pruebas de GP validan datos, inventario, transiciones, equipamiento, señales y referencias de recursos mediante un host de prueba. **No simulan colisiones reales de Jolt ni ejecución visual de la interfaz.**

## Pruebas funcionales de aceptación

| ID | Procedimiento | Resultado exigido | Estado |
|---|---|---|---|
| GP-QA-01 | Crear Gameplay Object desde la categoría Gameplay | Nodo sin páginas de eventos; Inspector con Objeto/Arma | Pendiente QA local |
| GP-QA-02 | Seleccionar Objeto de Database con modelo | Modelo visible en el editor y modo Jugar | Pendiente QA local |
| GP-QA-03 | Recoger con E (modalidad inventario) | Única interacción; una unidad; modelo en mano | Pendiente QA local |
| GP-QA-04 | Recoger con E (modalidad directa) | En mano sin añadir inventario | Pendiente QA local |
| GP-QA-05 | Guardar (R), sacar (Q), repetir | Sin duplicados; mismo ejemplar | Pendiente QA local |
| GP-QA-06 | Usar (F) una poción consumible | Aplica efectos; cantidad y modelo se retiran cuando corresponde | Pendiente QA local |
| GP-QA-07 | Recoger/guardar/sacar un arma | `Party.equip()` y ranura correctos; sin equipamiento duplicado | Pendiente QA local |
| GP-QA-08 | Acción de arma con enemigo configurado | Habilidad se ejecuta sobre enemigo válido; sin objetivo no daña al jugador | Pendiente QA local |
| GP-QA-09 | Soltar un objeto Dynamic | Jolt restaura gravedad y colisiones, sin cuerpo duplicado | Pendiente QA local |
| GP-QA-10 | Lanzar un objeto Dynamic | Impulso Jolt; no hay doble balística | Pendiente QA local |
| GP-QA-11 | Soltar objeto Static o None | Respeta su configuración, sin convertir a Dynamic | Pendiente QA local |
| GP-QA-12 | Escuchar `item.picked_up` y `object.grabbed` en un Event separado | Señales una sola vez; sin página en Gameplay Object | Pendiente QA local |
| GP-QA-13 | Guardar/cargar escena tras mover, guardar o consumir objeto | Restauración por ID de instancia, sin reaparecer ni emitir señales falsas | Pendiente QA local |
| GP-QA-14 | Exportar juego y repetir GP-QA-02/03/09/12 | Modelos de Database incluidos y controles funcionales en Player | Pendiente QA local |
| GP-QA-15 | Abrir proyecto anterior que use `item3D` y `weapon3D` | Comandos heredados siguen operativos | Pendiente QA local |

**Delimitación conocida:** la continuidad física de un objeto llevado entre escenas todavía está sujeta al comportamiento existente del View Model. Esta entrega verifica el estado lógico por escena, pero no acredita transporte físico continuo entre escenas. No ocultar esta limitación ni declarar GP-QA-13/14 aprobados sin pruebas reales.

## Contrato y compatibilidad

- Database es dueño de la definición de Objeto/Arma y del perfil físico; la escena conserva una instancia independiente.
- Gameplay Object administra `world`, `hand`, `stored` y `consumed`, sin utilizar páginas de eventos.
- Inventario y mano son conceptos independientes: un objeto sostenido en modo directo no añade inventario por defecto.
- Un objeto Dynamic en el mundo lo controla Jolt; durante la manipulación, el View Model controla su transform, y al soltar vuelve a su simulación.
- Eventos narrativos siguen pudiendo reaccionar mediante señales; no hay otro EventBus.
- Los comandos antiguos `item3D`, `weapon3D` y «Mover al View Model» no se eliminan ni se migran automáticamente. Se podrá reconsiderar su visibilidad para nueva autoría únicamente después de confirmar equivalencia funcional en el editor.
- No se incorporan Match, F12 ni modificaciones ajenas al Gate.

## Evidencias que faltan

Registrar salida de los tests, compilación Vite editor/Player, capturas de interacción real, comportamiento Jolt, exportación y partida guardada/restaurada. **El Gate permanecerá pendiente de QA local hasta aprobación del usuario.**

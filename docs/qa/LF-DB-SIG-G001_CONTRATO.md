# LF-DB-SIG-G001 — Contrato de señales nativas de LevelForge

**Estado:** CONTRATO APROBADO E IMPLEMENTADO bajo autorización `Listo. LF-DB-SIG-G001 autoriza comenzar`. **Pendiente QA local y aceptación de entrega.**
**Origen:** decisión del usuario de posponer las señales nativas hasta después de S00–S05; confirmación de empezar por el contrato.
**Baseline inspeccionado:** `LevelForge_S05_SOURCE_BASELINE.zip` (632 archivos), más QA local S05: 123 PASS / 0 FAIL / 0 TODO y builds editor 682 / Player 326, aceptados por el usuario. No consta QA visual/AppImage.
**Gate integral:** `LF-DB-SIG-G001`. Una sola implementación y entrega Change ZIP + Source Baseline, sin sub-Gates.

## 1. Estado real del código

| Función actual | Archivo | Hallazgo relevante |
|---|---|---|
| Señal declarativa | `events/interpreter.js`: `Game.signal()` | Despierta `waitSignal()`, llama `host.signalEvents()` y notifica a `game.on` mediante `Game.emit()`. Rechaza ciertos nombres internos. |
| Escucha desde página | `events/play-signals.js`: `_signalEvents()` | La página «Al recibir señal» escucha el nombre y puede copiar datos a una variable. No ejecuta páginas deshabilitadas, sostenidas, guardadas ni ya ocupadas. |
| Señales de scripts | `events/interpreter.js`: `Game.emit()` | Notifica solo a listeners de scripts; **no** pasa por páginas de evento ni por `waitSignal()`. La API de script `game.emit(...)` sí se enlaza a `Game.signal()`: no confundir ambas rutas. |
| Señal heredada `drop` | `player/fps/hands.js`, `hands-throw.js` | Se emite al soltar, al comenzar un lanzamiento y otra vez al aterrizar. Mantener intacta su semántica heredada; no utilizarla como señal canónica nueva. |
| Mano/slot 3D | `player/fps/hands.js`, `hands-stash.js`, `hands-throw.js` | `viewModelAttach`, `viewModelRelease`, `viewModelThrow`, `viewModelStash` y `viewModelUnstash` conocen cuándo cambió realmente la tenencia física. |
| Operaciones Database | `events/exec-commands.js`: `item3D`, `weapon3D` | Pueden cambiar inventario/equipo **y** ubicación del modelo. Una recogida puede representar dos hechos distintos. |
| Inventario y equipo | `database/rules.js`: `Party.gain`, `setCount`, `clearInventory`, `equip` | `changed('inventory')` es una notificación de refresco de UI, **no** incluye la diferencia real ni distingue operaciones exitosas. |
| Restauración | `events/saves.js`, `events/play-saves.js` | Restaurar una partida recompone estado y View Model; no debe fingir recogidas/equipamientos nuevos. |

## 2. Señales propuestas (nombres finales sujetos a aprobación de este contrato)

| Nombre | Cuándo ocurre | Cuándo **no** ocurre |
|---|---|---|
| `item.picked_up` | `item3D → Recoger`: la unidad se incorporó y el objeto quedó en mano | Inventario lleno, ID inválido, objeto ya recogido, fallo al adjuntar |
| `object.grabbed` | Un nodo entra en un slot de mano desde mundo/almacén | Ajustar el slot de un nodo ya sostenido; restaurar partida |
| `object.dropped` | Objeto sostenido vuelve al mundo **sin** lanzamiento | Guardarlo, consumirlo, lanzarlo, soltar algo que no estaba en mano |
| `object.thrown` | Comienza un lanzamiento válido, una sola vez | Cuando aterriza o rebota; `drop` heredado mantiene sus emisiones |
| `inventory.item_added` | Aumenta realmente una cantidad de `items`, `weapons` o `armors` | Resultado limitado sin cambio; carga, reset o normalización inicial |
| `inventory.item_removed` | Disminuye realmente una cantidad | Cantidad cero sin cambio; restaurar una partida |
| `equipment.equipped` | Cambia una ranura de equipo de un actor a un artículo no vacío | Solicitud inválida, ranura incompatible, mismo equipo sin cambio, restauración |
| `equipment.unequipped` | Sale el artículo anterior de una ranura | Ranura vacía, equipamiento sin cambio, restauración |

### 2.1 Combinaciones legítimas (no son duplicados)

- `item3D → Recoger`: una señal `object.grabbed`, una `inventory.item_added` y una `item.picked_up`, **una vez cada una** por operación terminada con éxito.
- `item3D → Guardar` en un slot oculto: ni `object.dropped` ni `inventory.item_added`; ya se contó el objeto al recogerlo.
- `item3D → Sacar`: `object.grabbed` si pasó desde el almacén a mano, sin duplicar inventario.
- Equipar desde el inventario: `inventory.item_removed` para el arma que sale del inventario; `equipment.equipped` para la ranura. Si se reemplaza un arma, el arma antigua retorna y se produce además el delta de inventario correspondiente y su `equipment.unequipped`.
- Soltar/lanzar objetos de Database: sincronizar primero su estado de inventario; emitir el delta resultante y **una** señal física (`object.dropped` o `object.thrown`). El antiguo `drop` sigue compatible.
- `viewModelAttach` genérico sobre una primitiva sin registro Database: puede emitir `object.grabbed`, nunca `item.picked_up` ni deltas de inventario ficticios.

## 3. Datos públicos de la señal

Todas las señales llevan un objeto plano, apto para variables de eventos/JS y sin referencias Three.js:

```js
{
  eventId: 'id-del-evento',  // cuando interviene un nodo o evento de escena
  objectId: 'id-del-nodo',   // cuando interviene un objeto del mundo
  objectName: 'Nombre',      // descriptivo, nunca usar como identidad persistente
  actorId: 1,               // cuando interviene un actor concreto
  kind: 'items',            // items / weapons / armors, solo si procede
  itemId: 2,                // ID Database, solo si procede
  slot: 'right',            // slot físico, solo si procede
  equipSlot: 1,             // ranura lógica, solo si procede
  before: 0, after: 1, delta: 1 // únicamente en cambios de cantidad
}
```

**Reglas:** omitir campos no aplicables; ID del nodo/evento distinto del ID de registro en Database; no añadir objetos circulares; conservar `name`/datos de `drop` heredado sin cambiarlos. La emisión es posterior al cambio efectivo. La secuencia exacta entre **señales diferentes** se valida en QA para observar un estado ya consistente al responder; los eventos consumidores no deben alterar el resultado de una acción ya terminada.

## 4. Integración — un único camino de publicación

1. Aprovechar la ruta **de `Game.signal`** para activar páginas «Al recibir señal», listeners y esperas; no crear otro EventBus. Extraer una ayuda interna **solo si es necesario** para permitir al motor publicar sus señales sin bloquear los nombres personalizados existentes.
2. Emitir en los puntos donde realmente se **confirma** cada transición: `Party` para cantidades/equipo, `viewModel` para mano/mundo, y el comando `item3D` para la recogida lógica. No emitir por refrescos UI (`changed`).
3. Una vez completado el cambio de estado, publicar con manejo de error; un listener que falle no revierte ni repite una acción válida. Evitar promesas sin `.catch`.
4. No cambiar la API de señales personalizadas. Evitar bloquear nombres que proyectos anteriores pudieran usar: antes de reservar nombres hay que auditar compatibilidad. Mantener el nombre `drop` y su semántica antigua.
5. En el editor, las páginas «Al recibir señal» existentes deben poder seleccionar o escribir nombres nativos. Añadir ayuda legible si se necesita, **extendiendo** los controles actuales, no creando un diseñador nuevo.
6. Ninguna señal se emite automáticamente al iniciar, cargar o restablecer estado, regenerar escenas o volver a asociar modelos después de cargar.

## 5. QA obligatorio del único Gate

- [ ] Regresión del runner S01–S05 (123 pruebas base sin regresión).
- [ ] Pruebas nuevas de las ocho señales y su carga útil; inventario lleno/rechazo sin señales.
- [ ] Conteo exacto: recoger una vez, cambiar slot sin duplicar, guardar/sacar, soltar, lanzar y aterrizar sin segundo `object.thrown`.
- [ ] Deltas: ganancia, retirada, cantidades recortadas, consumibles, cambio de arma, `setCount` y `clearInventory`.
- [ ] `Game.signal`, espera de señal y página «Al recibir señal» reciben datos; una página en ejecución no se duplica.
- [ ] Error de un listener no revierte cantidad/equipo ni deja rechazo asíncrono sin manejar.
- [ ] Guardar/cargar, reset, reconstrucción del View Model y partidas anteriores no emiten operaciones inventadas.
- [ ] `node --test scripts/test-db-contract.mjs` y `npm run build` (editor y Player) sin regresión.
- [ ] Prueba local sin scripts: recoger, soltar, lanzar, equipar y desequipar; páginas «Al recibir señal» muestran resultados correctos.
- [ ] Juego exportado y AppImage del editor probados **por separado**; resultados no inferidos del build.
- [ ] Entrega `LF-DB-SIG-G001_CHANGE.zip` y Source Baseline integral con ledger y comparación directa, sin SHA-256 aparte ni scripts de comprobación.

## 6. Política de implementación

SOLID práctico: una responsabilidad por módulo existente, extender antes de duplicar, no introducir librería de señales ni crear interfaces por anticipado. Comentarios **solo donde hagan falta**; explicar de forma directa qué ocurre y por qué, con el estilo de la documentación del proyecto. No añadir sistemas nuevos de inventario, físicas, armas, animación ni transporte automático de modelos entre escenas.

## 7. Estado y autorización

**El contrato fue autorizado para implementación** el 23/10/2026 con la declaración exacta:

`Listo. LF-DB-SIG-G001 autoriza comenzar`

La implementación está entregada para QA: ver `docs/qa/LF-DB-SIG-G001_QA.md`. Las pruebas visuales de editor/Player/AppImage siguen pendientes; cualquier ampliación del contrato requerirá autorización separada.

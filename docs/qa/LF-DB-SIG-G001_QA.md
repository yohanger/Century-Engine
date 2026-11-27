# LF-DB-SIG-G001 — QA de señales nativas

**Gate:** LF-DB-SIG-G001 · **Estado de entrega:** IMPLEMENTADO; PENDIENTE QA LOCAL / APROBACIÓN DEL USUARIO.

## 1. Qué cambia

El motor publica automáticamente las siguientes señales por la misma ruta que «Emitir señal»: `item.picked_up`, `object.grabbed`, `object.dropped`, `object.thrown`, `inventory.item_added`, `inventory.item_removed`, `equipment.equipped` y `equipment.unequipped`.

Las reciben las páginas «Al recibir señal», el comando «Esperar señal» y los scripts que usan `game.on()` o `game.waitFor()`. Las señales personalizadas anteriores siguen funcionando. La señal interna heredada `drop` no cambia: un lanzamiento todavía la produce al empezar y cuando aterriza.

Los datos de la señal pueden incluir `eventId`, `objectId`, `objectName`, `actorId`, `kind`, `itemId`, `slot`, `equipSlot`, `before`, `after` y `delta`. Solo llegan los campos aplicables. No se envían objetos Three.js.

## 2. Pruebas automáticas

Desde la raíz del proyecto:

```bash
node --test scripts/test-db-contract.mjs
npm run build
```

Resultado de referencia de esta entrega: **137 PASS, 0 FAIL y 0 TODO** en Node (**123 anteriores + 14 nuevas**). La compilación y los AppImage no se pudieron probar en el entorno aislado de entrega: anotar el resultado real de `npm run build` en tu equipo.

## 3. Prueba de eventos sin JavaScript

1. Abre un proyecto de prueba con Database, un jugador con View Model y slot «right», una escena y eventos normales. No hace falta modificar ninguno de los scripts del proyecto.
2. Crea un evento de escucha con una página cuyo disparador sea **«Al recibir señal»**. En **«Nombre de la señal»** escribe, por ejemplo, `item.picked_up`. Configura **«Guardar el dato en la variable»** para conservar el objeto de datos, y añade un comando «Mostrar texto» para confirmar la recepción. Esta página debe permanecer activa y habilitada.
3. En otro evento configura gráfico **Objeto** de Database y el comando **Objeto 3D de Database → Recoger**. Interactúa con él. La página de escucha debe ejecutarse **una vez**, sin «Emitir señal» manual. Repite la interacción: no debe duplicar objetos ni señales.
4. En la página de escucha cambia el nombre sucesivamente a `object.grabbed` e `inventory.item_added` y repite la prueba desde una nueva partida. En la señal de inventario revisa que `before`, `after` y `delta` correspondan a la cantidad real.
5. Configura otro evento con el comando **Arma equipada 3D → Equipar** y una página escuchando `equipment.equipped`. Comprueba que el arma se equipe, cambie su inventario y llegue la señal. Prueba **Desequipar** para `equipment.unequipped`.
6. Con un objeto sostenido utiliza la acción **soltar** y escucha `object.dropped`: debe llegar una sola vez. Repite manteniendo el botón para lanzar: escucha `object.thrown`, que debe emitirse una sola vez al comenzar, nunca en los rebotes ni al aterrizar.
7. Guarda un objeto en el almacén del View Model y luego sácalo: debe emitir `object.grabbed` al volver a la mano, pero no un segundo `inventory.item_added`.
8. Guarda la partida, cambia de escena o restaura la partida. Volver a colocar objetos guardados en los slots durante una carga **no** debe provocar señales nuevas de recogida o equipamiento.

Para probar varios nombres a la vez, utiliza páginas de escucha en eventos separados. Un evento cuya página «Al recibir señal» ya esté ejecutándose **no** debe empezar otra ejecución en paralelo.

## 4. Errores y casos límite

- Inventario lleno: no se añade la unidad; no hay `item.picked_up` ni `inventory.item_added`.
- Usar un consumible: `inventory.item_removed` con un delta negativo, sin segunda señal de recogida.
- Cambiar un arma por otra: devuelve la anterior, añade la nueva al equipo y comunica las dos transiciones. Volver a equipar exactamente la misma no genera señales.
- `setCount` y «Vaciar inventario» notifican únicamente cambios de cantidad reales.
- Si una escucha falla, la acción de inventario/equipo ya realizada no se revierte ni repite.
- Los mensajes `drop` anteriores se conservan para scripts heredados; las nuevas señales `object.dropped` y `object.thrown` son distintas.

## 5. Exportación y AppImage (dos pruebas separadas)

- **Juego exportado:** exporta una escena de prueba con objetos, arma, páginas «Al recibir señal» y View Model. Ejecuta el Player exportado y repite las pruebas de la sección 3.
- **Editor AppImage:** ejecuta `npm run dist:linux` y abre el AppImage del **editor** generado. Entra al proyecto y repite la prueba; no confundir este AppImage con el del juego.

## 6. Resultado a registrar

Marca únicamente lo que realmente comprobaste:

- [ ] Runner 137 PASS / 0 FAIL / 0 TODO
- [ ] `npm run build` editor y Player PASS
- [ ] «Al recibir señal» responde en el modo Jugar
- [ ] Agarrar, soltar, lanzar y guardar/sacar sin señales falsas ni duplicadas
- [ ] Inventario y equipo con deltas/IDs correctos
- [ ] Guardar/cargar sin señales inventadas
- [ ] Player exportado ejecutado
- [ ] AppImage del editor ejecutado

**Nota:** las pruebas automáticas usan un host simulado para las interacciones de View Model. No sustituyen el QA visual/físico con Three.js y Jolt en un proyecto real.

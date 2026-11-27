# LF-DB-SIG-G001_CORR-001 — Señales estructuradas y atajo Space

## Alcance autorizado

Una implementación integral, sin EventBus paralelo. `Esperar señal` admite ramas; `Emitir señal`, `Esperar señal` y páginas `Al recibir señal` comparten los ocho nombres nativos con un campo para señales personalizadas. **Space** edita la línea elegida o abre el selector en una línea vacía. La estructura anterior de comandos se conserva.

## Reglas de autoría

- **Esperar señal nuevo:** al insertar, «Ejecutar ramas» queda activado. En la lista aparecen `Cuando se recibe` y `Si se agota el tiempo`, cada una con líneas ◇ para insertar comandos. Tras ejecutar la rama correspondiente continúa el evento.
- **Tiempo máximo:** `0` espera sin límite; un valor positivo ejecuta la rama «Si se agota el tiempo» solo si no llega ninguna señal.
- **Señal sin datos:** cuenta como recibida, aunque su dato sea `undefined`. Cancelar un evento no ejecuta ninguna de las dos ramas.
- **Datos dentro de la rama:** escribe `\S[itemId]`, `\S[delta]`, `\S[objectId]`, `\S[signal]` en «Mostrar texto». En «Variable», el operando «Dato de la señal recibida» permite elegir un campo, p. ej. `delta`. «Emitir señal» puede reenviar los datos recibidos. Ninguno necesita una variable global para poder leerlos.
- **Páginas Al recibir señal:** el mismo `\S[campo]` sirve en sus textos; las variables antiguas son opcionales.
- **Comandos antiguos:** los `waitSignal` guardados antes de CORR-001 no tienen `flow:true` y siguen siendo lineales. «Ejecutar ramas» puede activarse manualmente para modernizar un comando. Desactivar y volver a activar no borra los comandos anidados.
- **Señales nativas:** seleccionar o emitir la notificación `inventory.item_added` no añade nada al inventario; el cambio real lo sigue realizando el sistema de inventario. Las señales personalizadas continúan admitidas.

## Instalación y QA reproducible

Desde la raíz de LevelForge:

```bash
node --test scripts/test-db-contract.mjs
npm run build
```

Esperado del runner en esta entrega: **168 PASS, 0 FAIL, 0 TODO**. La compilación del editor y Player aún debe realizarse en el equipo con dependencias disponibles. En el entorno de entrega Vite respondió `vite: not found`.

## Casos manuales del editor (sin scripts obligatorios)

- [ ] **EV-SIG-01:** crear un evento A, insertar «Esperar señal», elegir `object.grabbed`; comprobar que el editor muestra ambas ramas y un ◇ dentro de cada una.
- [ ] **EV-SIG-02:** añadir «Mostrar texto: Objeto \S[objectId]» en «Cuando se recibe», y otro texto en timeout. Usar otro evento o una recogida de objeto para emitir la señal. Solo debe ejecutar la rama de recepción.
- [ ] **EV-SIG-03:** establecer tiempo máximo en 3 s, ejecutar sin emitir señal y comprobar que solo se ejecuta «Si se agota el tiempo», seguido por el resto del evento.
- [ ] **EV-SIG-04:** probar una señal personalizada `puerta.abierta` mediante evento B con «Emitir señal» y evento A esperando. No debe requerir registro previo en Database.
- [ ] **EV-SIG-05:** elegir cada una de las ocho señales nativas en **Emitir**, **Esperar** y **Al recibir señal**; el selector debe mostrar nombre legible y nombre estable.
- [ ] **EV-SIG-06:** comprobar `\S[itemId]`, `\S[delta]` y el operando «Dato de la señal recibida» al procesar `inventory.item_added`; verificar que no se necesitan variables intermedias.
- [ ] **EV-SIG-07:** recibir una señal sin dato. Debe ejecutar «Cuando se recibe», no «Si se agota el tiempo».
- [ ] **EV-SIG-08:** salir de escena o cancelar el evento mientras espera. No deben ejecutarse ramas después de cancelarlo.
- [ ] **EV-SIG-09:** seleccionar un comando con ratón y pulsar Space. Debe abrir edición; sobre una línea ◇, Space debe abrir insertar. Repetir dentro de ramas anidadas.
- [ ] **EV-SIG-10:** comprobar que Space sigue escribiendo en campos de texto, selectores y modales; Enter y doble clic siguen funcionando.
- [ ] **EV-SIG-11:** cargar un evento anterior con Esperar señal lineal y variable opcional; verificar que conserva comportamiento antiguo y no se reestructura automáticamente.
- [ ] **EV-SIG-12:** exportar juego y comprobar EV-SIG-02 a EV-SIG-08 en Player; después construir/abrir AppImage del editor si corresponde.

## Estado y límites

- [X] 168 PASS Node en entorno de ejecución aislada (151 anteriores + 17 nuevas SIG-CORR).
- [X] Sintaxis de los archivos JavaScript modificados.
- [ ] Compilación Vite del editor y Player en máquina local.
- [ ] QA visual y de teclado dentro del editor.
- [ ] QA del Player y AppImage exportados.

No cerrar `LF-DB-SIG-G001_CORR-001` hasta que el usuario comparta evidencia local. SIG-G001 y PHY-G001 conservan por separado sus verificaciones visuales pendientes.

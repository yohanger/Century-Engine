# LF-DB-S03-G001 — QA: equipamiento y armas

**Gate:** S03 completo, una sola entrega. **Estado:** implementado; QA visual del usuario pendiente.
**Baseline:** `LevelForge_S02_APPROVED_SOURCE_BASELINE.zip`.

## Objetivo

Configurar un arma desde Database, equiparla, ejecutar su habilidad y desequiparla **sin escribir scripts**. El arma sigue usando el inventario y las ranuras existentes de `Party`; el modelo sale del gráfico «Arma» de un evento y se mueve con el View Model existente.

## Preparación en el editor

1. En **Database → Habilidades**, crea una habilidad de prueba. Ejemplo: «Golpe de prueba», alcance «Un enemigo», coste de MP 3, daño HP mediante `Math.max(0, a.atk * 2 - b.def)`, variación 0. No requiere animación ni sonido.
2. En **Database → Armas**, crea «Arma de prueba», con ranura «Arma», un modelo 3D y **Acción del arma (habilidad)** = «Golpe de prueba».
3. En **Database → Personajes**, comprueba que el personaje pertenece al grupo. En **Jugador → View Model**, comprueba que existe el slot «right» (o selecciona otro slot configurado).
4. Añade un **Evento** a la escena con gráfico **Arma (base de datos)** que referencia «Arma de prueba». Mantén el gráfico disponible en su página activa; no lo cambies por «Ninguno» al recogerlo.
5. Antes de equipar, da una unidad desde **Cambiar objetos / armas / armaduras → Arma**. Alternativamente, configura el arma como equipo inicial del personaje: en ese caso no debe necesitar otra unidad en el inventario.
6. En la lista de comandos del evento del arma, añade **Arma equipada 3D → Equipar y mostrar en la mano** (personaje, evento del arma y slot).
7. Para usarla una vez recogida, crea un **Evento común** con disparador **Al pulsar una acción / tecla** y añade **Arma equipada 3D → Ejecutar acción del arma**. Selecciona **Objetivo: Enemigo de Database** y el registro de prueba. Puedes usar otro evento independiente en vez del evento común.
8. Crea otro evento/comando accesible para **Arma equipada 3D → Desequipar y guardar el modelo**. El evento del arma deja de ser activable desde el mundo mientras está en la mano; por eso el comando de usar/desequipar debe ejecutarse desde un evento común u otro evento.

## Casos manuales

- [ ] **S03-VIS-01**. En modo Jugar, equipar el arma incrementa el atributo configurado y muestra su modelo en la mano. El inventario baja exactamente una unidad.
- [ ] **S03-VIS-02**. La acción del arma ejecuta su habilidad y aplica daño al enemigo configurado. Descuenta el MP correspondiente. No es necesario aprender la habilidad por separado.
- [ ] **S03-VIS-03**. Sin enemigo indicado cuando la habilidad exige enemigo, la acción se rechaza sin dañar al personaje ni descontar MP.
- [ ] **S03-VIS-04**. Desequipar retira el modelo de la mano, devuelve el arma al inventario y restituye los atributos.
- [ ] **S03-VIS-05**. Equipar otra arma devuelve la anterior y mantiene solo el modelo activo en la mano.
- [ ] **S03-VIS-06**. Guardar y cargar restaura el arma equipada, MP, inventario y modelo en la **misma escena**.
- [ ] **S03-VIS-07**. Comprobar el ciclo en el Player exportado, no solo en modo Jugar.
- [ ] **S03-VIS-08**. Comprobar el AppImage si está disponible; su ejecución no se demuestra únicamente con Vite.

## Pruebas automatizadas y compilación

```bash
cd "$HOME/ENGINES/lf-0.26.13/lf"
node --test scripts/test-db-contract.mjs
npm run build
```

Resultado esperado del runner: **101 tests, 101 PASS, 0 FAIL, 0 TODO**.

## Compatibilidad y límites de este Sprint

- Un arma sin `actionSkill` sigue funcionando como equipo de estadísticas y rasgos; no tiene acción declarada hasta configurarla.
- `Cambiar equipo` y `Party.equip()` siguen siendo los mecanismos previos de equipamiento lógico. Para **mostrar un arma en el View Model** se utiliza el nuevo comando `Arma equipada 3D` con un evento gráfico vinculado a Database.
- El enemigo seleccionado desde el editor es la instancia persistente predeterminada del tipo elegido (`{ enemy: id }`). Las instancias específicas pueden dirigirse desde la API con `{ enemyInstance: id }`; el control de enemigos físicos está fuera de S03.
- El modelo de arma pertenece a su evento de la escena; **no viaja físicamente de manera automática entre escenas**. El equipo lógico y su guardado sí persisten. Es la misma limitación de los objetos 3D de S02.
- Las animaciones y los sonidos son opcionales y no bloquean el uso. Su integración declarativa corresponde a S04.
- No se han añadido nuevas señales nativas de recoger, soltar, lanzar, equipar ni inventario; permanecen pospuestas.
- Las pruebas de Node utilizan un host que simula el View Model. No sustituyen la inspección visual del editor ni del Player.

## Cierre

Registrar el resultado del runner, la compilación y los casos manuales. **No cerrar G001 por el mero hecho de pasar las pruebas aisladas**; requiere aceptación del usuario.

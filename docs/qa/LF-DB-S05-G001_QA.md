# LF-DB-S05-G001 — QA integral de autoría y exportación

**Gate único S05:** autorizado el 23/10/2026. **Estado de entrega:** implementado; pendiente de QA visual y AppImage del usuario.
**Source Baseline:** `LevelForge_S04_APPROVED_SOURCE_BASELINE.zip`.

## Objetivo

Crear y exportar **desde el editor** un juego narrativo FPS pequeño, con dos escenas y un recorrido verificable, **sin escribir JavaScript**. Comprueba en conjunto los contratos aprobados de S01–S04, el cargador del Player y los guardados. No se incluyen en S05 señales nativas nuevas ni transporte físico de modelos de evento entre escenas.

## Escenario del juego de prueba

**Escena 1 — Almacén:** el personaje entra en una habitación con una poción, una llave y una espada. Recoge la poción, la utiliza, recoge la llave, equipa la espada y ejecuta su habilidad contra un enemigo de Database. La puerta se desbloquea mediante interruptor/evento común y permite pasar a la segunda escena.

**Escena 2 — Salida:** existe un punto de aparición y un evento de final (mensaje o cambio de escena). Al volver a la escena anterior no deben reaparecer objetos consumidos ni duplicarse armas. El inventario y el equipo tienen que conservarse; al guardar y cargar deben restaurarse HP, MP, estados e interruptores.

**Recursos de prueba:** usa primitivas como modelos para la primera pasada (no requieren archivos GLB). Después repite con un GLB importado para la poción y otro para la espada, y con animación/sonido opcionales.

## Montaje en el editor, sin scripts

1. **Proyecto:** crea uno con la plantilla «Primera persona». Comprueba el Spawn y una luz. Configura título y ventana en los ajustes del juego. Crea una segunda escena «Salida» con Spawn.
2. **Database → Objetos:** crea una poción recuperadora de HP, `consumable=true`, `occasion=always`, y una llave `consumable=false`, con evento común opcional que active un interruptor. Selecciona una primitiva en «Modelo 3D» para cada una.
3. **Database → Habilidades:** crea «Golpe» con coste MP, objetivo enemigo y fórmula segura. **Database → Armas:** crea «Espada» con modelo 3D y «Acción del arma (habilidad)» = Golpe. **Database → Enemigos:** configura el enemigo de prueba.
4. **Escena Almacén:** añade los eventos «Poción», «Llave» y «Espada», con gráfico de su registro Database. Asigna el comando **Objeto 3D de Database → Recoger** a poción y llave, y **Arma equipada 3D → Equipar** a espada.
5. **Eventos comunes:** configura acciones del Input Map para **Objeto 3D de Database → Usar**, **Guardar**, **Sacar**, y **Arma equipada 3D → Ejecutar acción del arma**, mediante páginas de evento de tipo «Al pulsar una acción». Los comandos reciben referencias de sus eventos de origen; no añadas scripts.
6. **Puerta:** configura una página condicionada por el interruptor de la llave; en esa página, el comando de cambio de escena lleva a «Salida». Evita autoruns infinitos: utiliza «Botón de acción» o un interruptor de control.
7. **Salida:** añade un evento de fin o de regreso. Comprueba condiciones de páginas, interruptores y la aparición del jugador.
8. **Build:** abre Archivo → Exportar juego (AppImage). Incluye **Almacén y Salida** en ese orden; excluye cualquier escena de trabajo. Si muestra una advertencia de Spawn o interfaz, corrígela antes de exportar.

## QA ejecutable en el repositorio

```bash
cd "$HOME/ENGINES/lf-0.26.13/lf"
node --test scripts/test-db-contract.mjs
npm run build
```

Resultado esperado del runner: **123 tests / 123 PASS / 0 FAIL / 0 TODO**.

**Pruebas nuevas S05-EXP:** selección/orden de escenas, gráficos de Database en páginas alternativas, modelos de View Model y prefabs, validación de recursos en dos escenas, rechazo de archivos faltantes, primitivas sin GLB y referencias prefab circulares.

## QA visual en editor y Player

- [ ] **S05-VIS-01:** modo Jugar: recoge poción y llave; inventario suma una unidad por objeto, sin duplicados.
- [ ] **S05-VIS-02:** al usar poción, HP y cantidad cambian una sola vez; el modelo se retira de la mano según la regla S02/S04.
- [ ] **S05-VIS-03:** equipa espada, ejecuta Golpe con enemigo explícito; MP y HP enemigo cambian una sola vez; al desequipar regresa el arma al inventario.
- [ ] **S05-VIS-04:** con animación y SFX vacíos las acciones funcionan; si configuras clips válidos se reproducen, sin cambiar los resultados lógicos.
- [ ] **S05-VIS-05:** la llave activa el evento común y permite atravesar la puerta; la escena Salida carga en el orden previsto.
- [ ] **S05-VIS-06:** guarda la partida, cambia HP/MP/inventario/interruptores, carga y comprueba restauración; el estado lógico de modelos de evento se conserva en su escena.
- [ ] **S05-VIS-07:** exporta el juego a AppImage desde la ventana Build en Electron y ejecútalo; el gameplay debe coincidir con modo Jugar.
- [ ] **S05-VIS-08:** importa modelos GLB distintos para poción y espada, exporta de nuevo y verifica que también se dibujan en el Player. Alterna páginas de evento con diferentes gráficos Database para comprobar el precargado.
- [ ] **S05-VIS-09:** elimina **solo en una copia de prueba** el archivo binario de un GLB todavía referenciado: Build debe detener la exportación con un error legible, en vez de crear un juego sin el modelo.
- [ ] **S05-VIS-10:** ejecuta `npm run dist:linux` para empaquetar el **editor**; abre su AppImage y confirma que el mismo proyecto puede editarse y exportarse. Es una comprobación distinta del AppImage del juego.

**Ejecución del AppImage de juego:** desde su carpeta, `chmod +x ./MiJuego.AppImage && ./MiJuego.AppImage`; si falta FUSE, ejecuta `./MiJuego.AppImage --appimage-extract-and-run`.

## Limitaciones y alcance de la evidencia

- Los tests de Node prueban contratos y preparación de escenas, **no** renderizan modelos reales ni ejecutan Electron.
- La compilación Vite no prueba por sí sola que el juego exportado o el AppImage del editor arranquen en Linux.
- Los modelos de eventos de S02/S03 permanecen asociados a su escena de origen: la persistencia de inventario no implica transportar el objeto 3D entre escenas. No está autorizado añadirlo en S05.
- Los nombres de archivos GLB referenciados desde escenas o gráficos Database se verifican antes de empaquetar el juego; el resto de recursos opcionales no convierte su ausencia en una acción inválida.
- Las señales nativas automáticas de recoger, soltar, lanzar, inventario y equipamiento siguen **pospuestas por decisión del usuario**.
- **Criterio de cierre:** enviar la salida del runner, la compilación y evidencia de S05-VIS-01 a S05-VIS-10; registrar como pendiente todo lo que no se haya ejecutado.

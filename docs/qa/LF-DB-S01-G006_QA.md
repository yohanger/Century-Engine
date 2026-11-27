# LF-DB-S01-G006 — QA de integración y cierre de S01

**Baseline:** `levelforge(20261023-012234).zip` y cierre del ledger G005.
**Estado de G006:** autorizado, implementada suite de integración; **pendiente de QA local del usuario**.
**Alcance:** Database → comandos del intérprete → Party → eventos comunes → habilidades/estados → SaveManager; editor, Player exportado y AppImage del editor.

## 1. Evidencia automatizada (entorno de desarrollo)

Ejecutar en la raíz `lf/`:

```bash
node --test scripts/test-db-contract.mjs
npm run build
```

Esperado para la suite S01: **71 tests, 71 PASS, 0 FAIL, 0 TODO**. El build debe finalizar **dos veces**: editor (`vite build`) y reproductor (`vite build --mode player`). Los avisos no fatales de tamaño de chunks/importaciones no son errores de compilación.

Casos añadidos en G006:

- `S01-INT-01`: usa el intérprete `Game` real para ejecutar comandos `items`, `actorStat`, `useItem`, `useSkill`, `state`, `saveGame`, `loadGame`; comprueba evento común, fórmula con variable, consumo, HP/MP, enemigo persistente, ticks, inventario, auto-interruptor, guardado/carga y restauración del mundo mediante el contrato host simulado.
- `S01-INT-02`: selección de página por inventario, interruptor y auto-interruptor.
- `S01-INT-03`: fórmula rechazada por un evento sin descontar MP ni modificar HP de instancias enemigas.
- `S01-INT-04`: un objeto exclusivo de menú no se consume desde un comando de evento.

**Límite:** `Game`, `EXEC`, `Party` y `SaveManager` son módulos reales. El `host` de pruebas simula la escena y almacenamiento en memoria: estas pruebas **no** renderizan la interfaz, ejecutan el Player ni construyen/AppImage. Tampoco sustituyen el QA visual de la exportación.

## 2. QA funcional — editor

Crear una **copia de proyecto de prueba**, sin alterar el proyecto principal.

1. [ ] En **Base de datos**, configurar un actor con HP/MP conocidos, una poción consumible que cure 25 HP y una llave no consumible con `scope=none` y `occasion=event`.
2. [ ] Crear un **evento común** que active un interruptor verificable. Asociarlo como efecto de la llave.
3. [ ] En una escena de prueba, crear eventos de acción que usen los comandos existentes: **Cambiar objetos** para entregar la poción y la llave, **Usar objeto** para consumir la poción y activar el evento común de la llave.
4. [ ] Pulsar **Jugar**: comprobar que la poción restaura HP y descuenta una unidad, mientras la llave permanece y activa exactamente una vez el interruptor.
5. [ ] Verificar que un objeto marcado **solo menú** no se usa desde un comando de evento y uno marcado **solo evento** no se usa desde menú.
6. [ ] Configurar una habilidad con fórmula `Math.max(0, a.atk * 4 - b.def * 2)`, coste MP y una instancia de enemigo. Validar daño y coste con el flujo que ya esté disponible en el proyecto (comando **Usar habilidad** o script autorizado del propio proyecto).
7. [ ] Configurar un estado con duración 2 y HP por tick = -3. Aplicarlo y avanzar *dos ticks explícitos* a través de `game.party.tick()` desde un script de prueba del evento. Comprobar daño en ambos ticks y eliminación posterior. **No esperar que el tiempo real lo avance automáticamente.**
8. [ ] Guardar la partida, modificar inventario/HP/MP, cargar y comprobar restauración. Verificar que el proyecto sigue abriéndose después de salir y volver a entrar.
9. [ ] Confirmar ausencia de excepciones en consola y registrar cualquier diferencia respecto de los resultados esperados.

Las pruebas de identidad de múltiples enemigos y de persistencia profunda cuentan con cobertura Node. Si el proyecto aún no dispone de representación visual de esas instancias, **no** inventar una prueba de enemigos 3D ni bloquear el Gate exigiendo IA fuera de S01.

## 3. QA del juego exportado (Player)

1. [ ] En la copia del proyecto, utilizar **Archivo → Exportar juego (AppImage)…** y seleccionar la escena de prueba como primera escena.
2. [ ] Ejecutar el **AppImage del juego** resultante (la ruta y el nombre son los elegidos en la ventana Build). Si no hay FUSE, probar `./NombreDelJuego.AppImage --appimage-extract-and-run`.
3. [ ] Repetir los casos de poción, llave/evento común y habilidad en el juego exportado. Confirmar mismos HP, MP, consumos y comportamiento que en el editor.
4. [ ] Guardar, cerrar el juego, abrir nuevamente y cargar. Verificar persistencia real del inventario/HP/MP y estados guardados.
5. [ ] Registrar el nombre/ruta del AppImage y resultado. Un `npm run build` exitoso **no demuestra** que la exportación esté correcta.

## 4. QA del AppImage del editor (paquete diferente)

Ejecutar en el equipo del usuario, desde `lf/`:

```bash
npm run dist:linux
```

1. [ ] Confirmar salida de Electron Builder y artefacto del editor en `release/`.
2. [ ] Abrir el **AppImage del editor** y cargar la copia del proyecto de prueba.
3. [ ] Entrar a Database, ejecutar la escena y comprobar que la configuración se conserva.
4. [ ] Registrar nombre/ruta del AppImage y errores si los hay.

**Diferencia de productos:** `npm run dist:linux` empaqueta **el editor LevelForge**; **Archivo → Exportar juego (AppImage)…** empaqueta **el juego Player**. Ambos necesitan evidencia diferenciada.

## 5. Criterios de cierre

- [ ] 71 pruebas PASS / 0 FAIL / 0 TODO en el equipo del usuario.
- [ ] `npm run build` compila editor y Player en el equipo del usuario.
- [ ] Flujo de autoría/uso/guardado comprobado en modo Jugar del editor.
- [ ] Juego exportado ejecutado; mismo flujo y guardado/carga verificados.
- [ ] AppImage del editor empaquetado y ejecutado.
- [ ] Usuario acepta G006 expresamente y se actualiza ledger con las evidencias reales.

**No se debe cerrar G006 ni S01 únicamente por la suite Node o la compilación.** Si alguna de estas verificaciones falla, registrar el defecto, el contexto de reproducción y resolverlo dentro del Gate si pertenece a S01. No implementar señales nativas, manos, armas físicas ni trabajo propio de S02.

# LF-INPUT-MOUSE-G001 — QA · Input Map sin clics de ratón + Soltar/Lanzar independientes

**Estado:** IMPLEMENTADO · PENDIENTE QA LOCAL (editor, Player y exportación). 24 de octubre de 2026.

## Alcance

- `interact`: E, Intro, Intro numérico, Espacio y mando X (`Pad2`). Ya **no** usa clic izquierdo ni derecho por defecto.
- `drop`: G y mando B (`Pad1`), **suelta al pulsar**, no al levantar la tecla.
- `throw`: T, **lanza al pulsar** con la velocidad existente de Database ▸ Jugador (`throwMax`, presentada como «Velocidad al lanzar»).
- Las asignaciones de `Mouse0` y `Mouse2` guardadas en `interact`/`drop`/`throw` se quitan al normalizar mapas antiguos; las acciones personalizadas y sus asignaciones se conservan.
- Si ambas acciones se reasignan a la misma tecla, prevalece `drop` para evitar una doble operación. El editor Input Map avisa de conflictos.
- La UI built-in `held_actions` conserva la posición inferior izquierda, las dos columnas fijas y el formato `[tecla] Acción`. Ahora muestra `[G] Soltar` y `[T] Lanzar`; respeta las asignaciones y las traducciones del proyecto.
- Database deja de ofrecer parámetros de tiempo de pulsación y fuerza mínima obsoletos. La velocidad anterior `throwMax` se conserva; no hay migración destructiva del valor numérico.
- Los scripts antiguos pueden seguir leyendo `game.viewModel.throwCharge`, pero ahora siempre es 0: el lanzamiento ya no carga fuerza por duración. Ningún comando `game.viewModel.throw(...)` ni `viewModelThrow(...)` cambia de firma.

## Pruebas automatizadas

`node --test scripts/test-db-contract.mjs`

**Resultado en entorno aislado:** 322 PASS, 0 FAIL, 0 TODO (307 anteriores y 15 INPUT nuevos). El suite INPUT carga el **método real** `_dropInput()` en un host simulado; no utiliza Three.js/Jolt real.

`node --check` pasó para los módulos JavaScript modificados.

`npm run build` **NO VERIFICADO**: `vite: not found` (faltan dependencias). No reportar compilación ni QA visual como PASS.

## QA funcional del usuario

- [ ] **INPUT-LOCAL-01:** Tras aplicar CHANGE, abrir proyecto **antiguo** y revisar Input Map: `interact` no incluye clic izquierdo/derecho; `drop` tampoco.
- [ ] **INPUT-LOCAL-02:** Comprobar que un proyecto nuevo tiene E para interactuar, G para soltar y T para lanzar.
- [ ] **INPUT-LOCAL-03:** Recoger con E; pulsar G una sola vez: se suelta **inmediatamente** y con Jolt cae al suelo.
- [ ] **INPUT-LOCAL-04:** Recoger otra vez; mantener G: **no lanza**, incluso con pulsación larga.
- [ ] **INPUT-LOCAL-05:** Pulsar T una vez: el objeto se lanza al instante; la trayectoria/velocidad obedece al perfil físico existente.
- [ ] **INPUT-LOCAL-06:** Clic izquierdo/derecho con objeto en mano: no soltará ni lanzará por las asignaciones integradas.
- [ ] **INPUT-LOCAL-07:** Clic izquierdo/derecho sin objeto: no inicia interacciones mediante los bindings integrados; clic izquierdo **sí puede capturar el puntero** al entrar en modo Jugar.
- [ ] **INPUT-LOCAL-08:** UI `held_actions` pequeña, dos columnas fijas abajo izquierda: G y T distintos, «Lanzar» sin «Mantener».
- [ ] **INPUT-LOCAL-09:** Cambiar las teclas de `drop` y `throw` en Input Map: controles y UI se actualizan correctamente.
- [ ] **INPUT-LOCAL-10:** Deshabilitar `dropEnabled`: G y T no realizan acciones y la UI no las anuncia.
- [ ] **INPUT-LOCAL-11:** Verificar traducciones ES/EN y Canvas personalizado `held_actions` sin UI duplicada.
- [ ] **INPUT-LOCAL-12:** Guardar, cerrar y reabrir el proyecto antiguo: migración de Input Map persistente, sin perder bindings personalizados.
- [ ] **INPUT-LOCAL-13:** Reproducir en Player exportado y Linux AppImage.
- [ ] **INPUT-LOCAL-14:** Confirmar que Event, Gameplay Object, View Model, inventario, físicas Jolt y señales continúan operando.

**No cerrar este Gate** hasta recibir la compilación y las verificaciones gráficas correspondientes. No borrar manualmente ni sobrescribir configuraciones de usuario ajenas al cambio.

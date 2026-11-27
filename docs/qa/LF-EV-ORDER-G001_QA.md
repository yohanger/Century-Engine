# LevelForge 0.26.13 — LF-EV-ORDER-G001
## QA de reconciliación y ciclo de vida de páginas

**Estado:** IMPLEMENTADO · PENDIENTE DE QA LOCAL.  **Baseline:** `LevelForge_EV_ORDER_CONTRATO_SOURCE_BASELINE.zip`.

### 1. Cambios aplicados

- `play-events.js`: `_reconcilePages()` aplica las páginas pendientes antes de recibir señales, procesar eventos y activar un candidato mediante E. La reconciliación está acotada y notifica errores si el estado no converge.
- `play-signals.js`: «Al recibir señal» usa la página confirmada; un evento `held` puede recibir señales lógicas. Sigue excluido `stashed`. Las emisiones durante la propia reconciliación se entregan después de terminarla.
- `play-input.js`: reconcilia antes de activar una página vinculada a Input Map.
- `play-controls.js`: antes de E se comprueba de nuevo la página, el disparador `action`, la proximidad y el requisito de mirada. Un candidato obsoleto no ejecuta comandos.
- El proceso paralelo de la página anterior se cancela sin borrar accidentalmente la referencia al nuevo proceso.
- **No se modifica** el orden global del motor, la simulación Jolt, el inventario, Match ni F12.

### 2. QA automatizada

Desde la raíz del proyecto:

```bash
node --test scripts/test-db-contract.mjs
npm run build
```

**Resultado de la suite local de lógica:** `186 PASS / 0 FAIL / 0 TODO` (168 pruebas anteriores + 18 pruebas EV-ORDER). Ejecutadas con Node; se carga el `Game` real y los métodos reales de PlayMode en un host de prueba. No se usa Three.js/Jolt real en este test. Se han validado además los archivos JS con `node --check`.

**Build en entorno de preparación:** no ejecutable con este Source Baseline porque no incluye `node_modules` (`vite: not found`). La compilación de editor/Player y la interacción 3D quedan pendientes de evidencia local. El usuario debe ejecutar el build con sus dependencias ya instaladas.

### 3. Matriz de aceptación funcional (14 casos)

| ID | Preparación | Resultado esperado |
|---|---|---|
| EV-ORDER-01 | P1 predeterminada; P2 exige A=ON; activar A | Se selecciona P2; el ID de evento se conserva. |
| EV-ORDER-02 | P1 hace A=ON y a continuación «Emitir señal object.dropped»; P2 recibe esa señal | P2 recibe inmediatamente, sin temporizador artificial. |
| EV-ORDER-03 | P2 señal, evento `held` | La señal lógica activa P2; E no activa el evento espacial sostenido. |
| EV-ORDER-04 | P2 «Botón de acción» con «Esperar señal», sin activar E otra vez | No comienza a esperar por el mero cambio de página. |
| EV-ORDER-05 | P2 «Al recibir señal»: A=OFF y después «Mostrar texto» | El texto se muestra y P1 queda seleccionada en la próxima reconciliación. |
| EV-ORDER-06 | P1 proceso paralelo en espera; A=ON → P2 proceso paralelo | Se cancela P1 y solo arranca P2; sin procesos huérfanos. |
| EV-ORDER-07 | Runner principal en P1 cambia A y después muestra texto | Termina la lista original, sin sustituirla por la de P2. |
| EV-ORDER-08 | Evento de acción bloqueado espera una señal | Al detenerlo, se cancela la espera y se libera control. |
| EV-ORDER-09 | Misma espera con `Jugador durante el evento = Libre` | El jugador sigue moviéndose durante la espera; no aparece otro `main`. |
| EV-ORDER-10 | Candidato E seleccionado; A cambia antes de pulsar E | E comprueba P2; no inicia los comandos obsoletos de P1. |
| EV-ORDER-11 | P1 botella, P2 llave, P3 ninguno; evento en mano | Cambia el gráfico sin soltar automáticamente, duplicar inventario ni recuperar la botella. |
| EV-ORDER-12 | Enviar dos señales mientras el receptor de la misma página sigue en ejecución | No se superponen ejecuciones de esa página. |
| EV-ORDER-13 | Dos eventos; uno sostenido y otro guardado; P señal | El sostenido recibe; el guardado no. Verificar también `off`. |
| EV-ORDER-14 | Repetir toda la secuencia en Player exportado | Mismo cambio de página, signals, main/par y View Model que en el editor. |

**Cobertura adicional:** EV-ORDER-15 verifica señales emitidas durante una reconciliación; EV-ORDER-16 detecta revisiones circulares sin bloquear el frame; EV-ORDER-17 verifica la página vigente al despachar Input Map; EV-ORDER-18 comprueba el cambio `auto → parallel` dentro del mismo ciclo.

### 4. Reproducción del defecto reportado

1. Crear dos páginas: P1 con gráfico de objeto y disparador **Botón de acción**; P2 condicionada por auto-interruptor A=ON.
2. En P1, poner el evento en la mano y activar A. En P2 seleccionar **Al recibir señal**, `object.dropped`; dentro de su lista, establecer A=OFF y mostrar un texto.
3. Soltar el objeto normalmente (`object.dropped`). **No usar `object.thrown` si la acción es soltar**.
4. Esperado: el mensaje aparece, se apaga A y P1 vuelve a ser válida; no hay bloqueo residual provocado por un runner finalizado.
5. Repetir con P2 `trigger='action'` y `waitSignal`: la escucha **no** comienza sola. Si el intérprete queda esperando indefinidamente con `during=locked`, que el jugador no se mueva es configuración intencional, no un arreglo a aplicar aquí.
6. Repetir en modo **Libre**, en modo **Bloqueado** y con cancelación; observar el control y los indicadores de evento.

### 5. Límites y deudas que permanecen fuera de este Gate

- Sin reproducción retroactiva de señales (si se emitió antes de suscribirse, la espera no la recibe).
- El View Model y las condiciones de páginas se mantienen independientes del inventario.
- **Match** y **F12** pendientes de futuros Gates separados.
- Físicas reales de Jolt, pruebas visuales de editor, juego exportado y AppImage siguen requiriendo QA local.
- No se creó un planificador nuevo ni EventBus; la reconciliación se localiza en `PlayMode`.

### 6. Criterio de cierre

Para cerrar G001: runner PASS, `npm run build` editor/Player PASS, secuencia visual EV-ORDER-01..14 en editor, y pruebas aplicables en Player exportado. Sin evidencia de ejecución, el Gate se mantiene **implementado, no aprobado**.

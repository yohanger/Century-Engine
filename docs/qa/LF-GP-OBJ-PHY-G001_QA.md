# LF-GP-OBJ-PHY-G001 — QA de física temporal del Gameplay Object

**Estado:** Implementado; **pendiente de compilación y QA visual/Jolt real**. Fecha: 2026-10-24.

## Contrato

- Database conserva `physics` original (`static`, `dynamic`, `kinematic`, `none`). La instancia conserva `flight`, pose, velocidades lineales y angulares; estos datos no cambian el registro Database.
- Al soltar un Gameplay Object, el objeto sale de la mano y Jolt simula la caída. No se interpola a una coordenada del suelo. Al lanzar, se aplica impulso a ese mismo cuerpo temporal.
- `static`, `kinematic` y `none` pasan a un cuerpo `Dynamic` transitorio mientras se mueven. `dynamic` conserva su cuerpo dinámico al terminar.
- Jolt decide el reposo con `BodySet.isAwake()`; no se utiliza un temporizador fijo de caída. Se exige como mínimo un avance de 0,1 s antes de consultar reposo, y no se restaura mientras está en agua.
- La retirada de un cuerpo Dynamic transitorio ocurre tras la simulación (fuera de `JoltWorld.step`). Static y Kinematic recuperan sus colliders; None no conserva ningún collider provisional.
- Si una pared impide un punto de salida seguro, el objeto permanece en la mano y no se emite una señal falsa de soltado/lanzamiento.
- Recoger durante el vuelo retira el cuerpo existente, cancela `flight` y deja al View Model como propietario de la pose. La siguiente soltada genera un vuelo nuevo.
- La persistencia por instancia almacena `flight`, posición, rotación, velocidad lineal y angular al guardar; al cargar se reconstruye un cuerpo temporal con esos valores, sin emitir señales nuevas.
- Los comandos y la balística legada de eventos quedan intactos; no se añadió interfaz contextual, Input Map ni EventBus.

## Comprobaciones automatizadas realizadas

`node --test scripts/test-db-contract.mjs` → **223 PASS / 0 FAIL / 0 TODO** (204 anteriores + 19 GPPHY).

Los 19 GPPHY usan métodos reales de Gameplay Object y hosts físicos simulados. La lógica de `BodySet` de Jolt se verifica parcialmente de forma estática; **estos tests no prueban una trayectoria real dentro de Jolt, el editor ni la exportación**.

`npm run build` → **BLOQUEADO:** `vite: not found`; la copia de Source Baseline excluye deliberadamente `node_modules`.

## QA que debe ejecutarse en el editor / Player

| ID | Escenario | Aceptación |
|---|---|---|
| PHY-01 | Soltar un objeto Database Static desde mano | Cae por gravedad, golpea el suelo y luego es Static en la pose final |
| PHY-02 | Lanzar Static hacia el suelo | Jolt aplica impulso y rebotes reales y restaura Static tras dormir |
| PHY-03 | Soltar Dynamic | Permanece Dynamic incluso cuando duerme |
| PHY-04 | Soltar Kinematic | Cae como Dynamic y restaura Kinematic tras dormir |
| PHY-05 | Soltar None | Usa collider temporal válido y lo retira al dormir |
| PHY-06 | Lanzar desde una altura | No se congela en el punto más alto ni antes del contacto |
| PHY-07 | Lanzar por pendiente | No se restaura mientras continúa rodando |
| PHY-08 | Rebotes sucesivos | No se restaura Static durante rebotes |
| PHY-09 | Recoger antes de tocar el suelo | Se retira el cuerpo temporal; objeto estable en mano |
| PHY-10 | Volver a soltar | Nueva caída independiente; un único cuerpo por instancia |
| PHY-11 | Guardar/cargar en pleno vuelo | Posición, orientación y velocidades restauradas; no duplica cuerpo |
| PHY-12 | Soltar cerca de pared y jugador | No aparece dentro de la pared/cápsula; si está bloqueado, sigue en mano |
| PHY-13 | Inventario y señales | Una sola emisión, inventario coherente, sin cambio de Database |
| PHY-14 | Juego en editor y Player exportado | Ambas rutas se comportan igual |
| PHY-15 | Regresión de eventos heredados | `item3D`, `weapon3D`, páginas, self-switches y balística legada siguen funcionando |

**Recomendación de reproducción:** usar un mapa con suelo Jolt, una rampa, una pared, varias instancias Gameplay Object idénticas y una superficie de agua. Grabar consola y resultado de guardar/cargar para los escenarios 01–15. No cerrar este Gate hasta registrar evidencia del comportamiento físico en runtime.

## Notas de alcance

- El retorno a `static` impide que una colisión posterior vuelva a empujar físicamente el objeto hasta que se recoja y vuelva a soltar; es la semántica solicitada de Database.
- `none` crea una forma de colisión provisional de caja/esfera/cápsula usando geometría existente (`localBox`). Si el modelo no tiene geometría válida, el fallback del BodySet es una caja mínima; se debe revisar visualmente.
- Esta fase no modifica la física de eventos narrativos, otras clases de nodos ni la interacción contextual en pantalla.
- El transporte continuo de objetos sostenidos entre escenas sigue fuera del alcance.

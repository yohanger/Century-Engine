# LevelForge — LF-DB-PHY-G001
## Contrato integral: Physics en Database y ciclo físico de los gráficos de evento

**Fecha:** 2026-10-23  
**Estado:** AUTORIZADO E IMPLEMENTADO — PENDIENTE QA LOCAL  
**Baseline:** `LevelForge_SIG_G001_SOURCE_BASELINE.zip` (634 archivos)  
**Política:** un solo Gate de implementación. Sin sub-Gates, nuevos EventBus ni sistemas físicos paralelos.

### 1. Decisiones de autoría ya definidas

1. **Database es dueño del perfil físico** de cada tipo de *Objeto* y *Arma*. Una referencia al mismo registro reutiliza el mismo tipo físico: no hay overrides por instancia en este Gate.
2. Para **registros nuevos** de Objetos y Armas, `physics` toma por defecto `static`. Static significa un cuerpo inmóvil que puede colisionar; **no significa gravedad**.
3. **Los registros guardados antes de este campo no cambian su comportamiento** al abrirse, normalizarse o exportarse. Una propiedad ausente es legado, no debe convertirse silenciosamente en un `static` activo.
4. **La página activa del evento mantiene el control del gráfico.** Puede cambiar de botella a llave, a otro modelo o a «Ninguno», incluso mientras el evento está en un slot del View Model.
5. **Gráfico/registro representado e inventario son independientes.** Cambiar de página o gráfico NO añade, quita, transforma, equipa ni consume ítems. Las operaciones explícitas existentes mantienen esa responsabilidad.
6. **El View Model sostiene la identidad del evento/nodo, no la página.** Su estado de mano permanece al cambiar de página; la representación gráfica activa puede cambiar.
7. **No todo evento es un ítem de Database.** Los gráficos primitivos, mallas, prefabs y sprites sin registro siguen su mecanismo existente; no necesitan registrarse artificialmente como ítems.
8. **Agarrable no equivale a Dynamic.** La capacidad de agarrar o interactuar sigue determinada por las acciones de evento/View Model existentes; `physics` describe la simulación, no concede acciones.

### 2. Campo `physics` (objetos y armas)

**Interfaz:** propiedad `Physics` en las secciones `Objetos` y `Armas` de Database.

| Valor | Contrato | Al soltar |
| --- | --- | --- |
| `none` | No crea cuerpo físico; el gráfico y los sensores de evento son independientes. | Permanece donde la acción lo coloque, sin gravedad. |
| `static` | Cuerpo sólido fijo, sin respuesta a fuerzas. **Predeterminado solo en registros nuevos.** | Recupera un cuerpo Static en la posición final, si hay gráfico. |
| `dynamic` | Rigidbody simulado por Jolt: gravedad, colisión, fuerzas e impulso. | Jolt vuelve a controlar la instancia, si hay gráfico. |
| `kinematic` | Cuerpo movido por transform/ruta/comando, no por gravedad. | Vuelve al modo controlado por evento, si hay gráfico. |

Valores inválidos deben producir una validación clara; no caer a Dynamic de manera silenciosa. Parámetros adicionales (masa, fricción, rebote, forma de colisión) aprovecharán los nombres/rangos ya admitidos por Jolt; solo serán visibles cuando resulten pertinentes, sin duplicar los controles existentes. No se introduce un segundo sistema de componentes.

### 3. Precedencia de configuración y compatibilidad

- **Gráfico Database de Objeto/Arma con `physics` explícito:** el perfil físico del registro gobierna su cuerpo. No debe coexistir un segundo collider creado por `page.solid` para el mismo gráfico. El editor debe indicar que la física procede de Database.
- **Gráfico Database de registro legado sin `physics`:** se conserva exactamente el tratamiento previo de `page.solid` y los colliders de página.
- **Gráfico que NO procede de Objeto/Arma de Database:** permanece el sistema actual de `page.solid`/nodos físicos; ninguna migración automática ni configuración obligatoria nueva.
- **Gráfico `none`:** el evento puede seguir activo en la mano y ejecutar lógica, pero no debe existir un cuerpo del gráfico inexistente.
- No se convierte automáticamente un objeto Static o Kinematic en Dynamic por agarrarlo, soltarlo o cambiar de página.

### 4. Ciclo físico de una instancia

**En mundo:** cada instancia conserva su propia posición, rotación y estado físico. Compartir registro Database NO significa compartir la posición ni el cuerpo Jolt.

**Agarrar:** la instancia queda en `vm.held`/`inst.held`; el View Model es el controlador de movimiento, sin colisiones del gráfico con el mundo. La configuración `physics` de Database NO se modifica. No se crea otro nodo duplicado.

**Cambiar de página mientras está en mano:** `_applyPage()` sigue sustituyendo el gráfico. `_vmAdopt()` sigue adaptando la representación nueva. Se retira cualquier cuerpo/collider del gráfico anterior y el nuevo perfil queda preparado, pero la simulación del gráfico permanece suspendida mientras siga en la mano. El self-switch NO cambia automáticamente `dbItems3D`, `dbWeapons3D` ni el inventario.

**Soltar:** se respeta el gráfico y el perfil físico de la **página activa en ese momento**, no los de la página desde la que se agarró. Se restaura o crea solo el cuerpo aplicable. Un gráfico `none` permanece invisible. No se revive el gráfico anterior ni se regresa a una página previa.

**Lanzar:** para una instancia con perfil `dynamic` explícito, usar impulso de Jolt y no ejecutar simultáneamente la balística heredada en `hands-throw.js`. Para `static`, `kinematic` o `none`, no simular un Rigidbody encubierto ni convertir el perfil; el comando debe responder de forma controlada si se pide un lanzamiento físico no compatible. **Los gráficos legados sin `physics` conservan su comportamiento anterior de lanzamiento.**

**Consumir/guardar/equipar:** seguir las operaciones lógicas existentes; retirar/ocultar cuerpos solo cuando corresponda a esas operaciones. Ninguna señal nativa adicional por reconstrucción, restauración o cambio de página.

### 5. Invariantes críticas

1. No hay dos cuerpos o colisiones competidoras por una instancia gráfica.
2. Cada cuerpo de Jolt tiene un único propietario y se libera al sustituir gráfico, descargar escena o eliminar instancia.
3. Un self-switch puede cambiar el gráfico a otro Objeto/Arma de Database **sin cambiar inventario, equipo ni identidad lógica del objeto guardado**.
4. La instancia del evento sigue identificada por el mismo ID. Sus señales/eventos no dependen del número de página.
5. El cambio de página conserva la transformada del nodo de evento y no lo teletransporta a su posición inicial.
6. Al cambiar de página mientras hay un impulso en curso, la instancia anterior deja de simularse antes de presentar la nueva; sin cuerpos huérfanos.
7. Guardar/cargar conserva el estado lógico de manos/inventario de S02–S03; la nueva persistencia física almacena **por instancia y escena** únicamente datos físicos que necesitan sobrevivir, sin mutar registros Database ni introducir duplicados.
8. Cargar una partida no genera `object.grabbed`, `object.dropped` ni señales de inventario/equipamiento ficticias.
9. Un evento sin gráfico puede conservar sus comandos y su condición `held`, pero no crea física ni recupera gráficos desaparecidos.

### 6. Matriz mínima de aceptación (declarativa y sin scripts obligatorios)

| ID | Preparación / acción | Resultado obligatorio |
| --- | --- | --- |
| PHY-01 | Registro nuevo de Objeto y Arma | Physics=Static visible y guardado; sin gravedad. |
| PHY-02 | Proyecto antiguo sin campo physics | Mantiene `page.solid`, aspecto y comportamiento anterior. |
| PHY-03 | 2 instancias del mismo registro Dynamic | Cuerpos y transforms independientes. |
| PHY-04 | Evento página 1 botella Dynamic → agarrar → self-switch → página 2 llave Static | Mismo evento en mano; gráfico llave; **ningún cambio automático en inventario**. |
| PHY-05 | Soltar desde la página 2 | Perfil Static de llave; no aparece botella anterior ni se duplica el evento. |
| PHY-06 | Cambiar a gráfico `none` mientras held; soltar | Sigue la lógica de evento; ningún collider fantasma ni gráfico antiguo. |
| PHY-07 | Agarrar y soltar Objeto Dynamic sin cambiar página | Suspende y restaura Jolt sin teletransporte ni doble colisión. |
| PHY-08 | Lanzar Dynamic | Jolt único controlador y aplicación de impulso; sin balística paralela. |
| PHY-09 | Lanzamiento de objeto legado sin campo physics | Conserva resultado anterior. |
| PHY-10 | Evento no Database con gráfico primitivo/prefab | Mantiene comportamiento físico y `page.solid` previo. |
| PHY-11 | `static`/`kinematic`/`none` agarrables | View Model funciona sin activar gravedad ni Rigidbody. |
| PHY-12 | Guardar/cargar posiciones y estados físicos en escena | Persiste estado acordado sin duplicados, señales falsas ni cuerpo huérfano. |
| PHY-13 | Cambios de página reiterados, carga/descarga y destrucción | Recursos/colliders se liberan; sin fugas ni dobles cuerpos. |
| PHY-14 | Build editor y Player, QA visual en juego exportado/AppImage | Las reglas y las transiciones coinciden en runtime real; evidencia local requerida. |

### 7. Restricciones de implementación

- **EXTEND BEFORE DUPLICATE:** extender `database/schema.js`, `events/play-events.js`, `events/play-bodies.js`, `physics/bodies.js`, `player/fps/hands.js`, `player/fps/hands-throw.js` y persistencia ya existente **solo si el diagnóstico técnico lo requiere**.
- No cambiar semántica de páginas, self-switches, identidad de eventos, comandos de inventario ni señales nativas.
- No duplicar SceneGraph, física, inventario ni View Model; sin abstracciones innecesarias.
- Comentarios solo cuando expliquen una decisión que no sea obvia, en español directo.
- Comparar Change contra baseline aprobado internamente; entregar Change ZIP + Source Baseline completo, sin `.sh` de comprobación ni SHA-256 separado.
- Node QA + `npm run build` + validación visual de editor, Player y AppImage. No declarar estas últimas pruebas PASS sin evidencia.

### 8. Gate y estado

**Gate único:** `LF-DB-PHY-G001` — Integración física de Objetos/Armas Database con páginas de evento y View Model.

**Estado:** AUTORIZADO E IMPLEMENTADO · PENDIENTE QA LOCAL.

**Autorización exacta requerida para código:** `Listo. LF-DB-PHY-G001 autoriza comenzar`.

La implementación se autorizó mediante «Listo. LF-DB-PHY-G001 autoriza comenzar». La validación visual/Jolt/Player/AppImage requiere QA local; consultar `LF-DB-PHY-G001_QA.md`.

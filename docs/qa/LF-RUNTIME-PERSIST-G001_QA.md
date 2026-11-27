# LF-RUNTIME-PERSIST-G001 — DontDestroyOnLoad

**Autorización:** `Listo. LF-RUNTIME-PERSIST-G001 autoriza comenzar` (2026-10-26).

## Objetivo
Conservar en memoria la **misma instancia Three.js** de un objeto y sus descendientes cuando `game.goScene()` o el comando de cambio de escena carga otro nivel. No se desarrolla un segundo SceneManager, no se escribe un SaveGame nuevo y no se incorpora ningún nodo obligatorio en proyectos Empty.

## Uso

- **Inspector > DontDestroyOnLoad**: marca un objeto raíz para conservarlo con sus hijos.
- **Eventos > Mundo > DontDestroyOnLoad**: activa/desactiva esta condición en un nodo, o en el propio evento si el campo está vacío.
- **Scripts**: `game.dontDestroyOnLoad('Música', true)` y `game.node('Música').keepOnLoad(true)`; también `game.node('Música').dontDestroyOnLoad = false`.
- El valor cambiado desde scripts/eventos dura **solo esta partida**; la casilla del Inspector se guarda con el objeto original.

## Contrato de ciclo de vida

1. Al pedir otra escena, el Runtime identifica las raíces persistentes y sus descendientes, guarda las referencias del modelo y la instancia 3D, captura velocidades de Jolt y estados Gameplay Object/flags de evento compatibles.
2. Retira **solo** los objetos inyectados durante Play de los datos de la escena saliente, restaurando cualquier registro local que hubiera tenido el mismo ID. `serializeProject()` excluye esas inyecciones incluso si ocurre un guardado mientras se juega.
3. Desmonta la escena y sus sistemas físicos. `SceneGraph.loadScene()` no ejecuta los destructores de los nodos retenidos.
4. Carga normalmente la escena nueva y **reinserta las referencias 3D originales**, sin reconstruir esos nodos. Si la escena entrante posee un ID igual, conserva el original de esa escena para su propio guardado y presenta solo la instancia viva durante Play.
5. Reconstituye sensores/colliders y cuerpos Jolt del nuevo nivel; restaura velocidades lineales y angulares cuando estén disponibles.
6. `AudioScene.resetSources({keep})` conserva la voz que ya estaba sonando en una fuente persistente; retira las demás. No reinicia la voz por `playOnStart`.
7. Al salir de Play se eliminan los overlays temporales y se limpian las referencias de persistencia. No se guarda el estado runtime en disco.

## Límites reales y decisiones

- **Conservación de instancia**: aplica al `THREE.Object3D` registrado por el SceneGraph; luz, geometría, materiales y animación dependiente del propio nodo no se reconstruyen durante la transición.
- **Física**: se recrea el cuerpo de Jolt al entrar a un nivel nuevo porque el PhysicsWorld anterior se destruye. Se recupera la velocidad lineal/angular; **la identidad interna del cuerpo nativo de Jolt cambia**. Los contactos en curso no pueden atravesar el cambio de escena.
- **Eventos**: el estado `erased/off` del evento persistente se preserva, y se vuelve a construir su página, sensores y física. **No se conserva la corrutina activa de un evento**: el Runtime cancela los runners de la escena saliente. Los scripts globales de `Game` y sus variables mantienen la sesión.
- **Animación**: `_animReset()` reinicia los controladores animados que dependen de la escena; no se garantiza continuidad fotograma a fotograma para clips o timelines activos.
- **View Model**: los objetos sostenidos salen del slot temporal al cambiar escena y se reincorporan si su estado Gameplay Object persistente lo solicita. No se garantiza una animación de mano continua durante la carga.
- **Transformaciones**: la instancia 3D conserva su matriz viva; al quedar huérfana de un padre no persistente se reubica como raíz conservando la transformación mundial. La propiedad `parentId` de la copia de ejecución se ajusta. No se registra la modificación en el archivo de escena.
- **Conflictos de IDs**: el objeto vivo prevalece durante Play; el objeto original del destino se restaura al abandonar la escena.
- **Transiciones fallidas**: se intenta recuperar las instancias persistentes y reconstruir la física del estado disponible. El rollback completo de una carga parcialmente fallida por errores fatales externos queda pendiente de validación real.
- No persiste datos entre sesiones/SaveGame ni introduce GameManager, perfiles `.post` o nuevas plantillas.

## QA automatizado

```bash
node --test scripts/test-runtime-persist-g001.mjs
```

Suite con 29 pruebas: árboles y descendientes, cambio de identidad, IDs duplicados, restauración al salir, mutación solo en sesión, código de Inspector, scripts, eventos, audio, física y serialización.

Regresión acumulada: **1160 PASS, 0 FAIL, 18 SKIP**. Se excluyeron las tres suites experimentales `starcat`, `three-version-candidates` y `three-version-adoption`.

**Compilación:** `npm run build` no se ejecuta correctamente en este entorno (`vite: not found`). El resultado no equivale a compilación PASS.

## QA manual en Linux / Electron / Player exportado (pendiente)

- [ ] Crear escena A con fuente AudioSource configurada en loop, marcar **DontDestroyOnLoad**, iniciar Play y pasar A→B→A: audio sin reinicio ni doble fuente.
- [ ] Marcar un grupo con dos hijos; mover uno con script, cambiar escena, verificar que se conserva la **misma referencia** y transformación y que el otro hijo sigue bajo el grupo.
- [ ] Marcar un hijo cuyo padre no se conserva; tras cambiar escena confirmar transformación en coordenadas mundiales.
- [ ] Ejecutar el comando de evento DontDestroyOnLoad en un evento y el script `game.dontDestroyOnLoad('Nombre')` en un script global.
- [ ] Desactivarlo por script, cambiar escena y comprobar que se destruye normalmente.
- [ ] Regresar a la escena de origen: debe existir **una sola instancia** del objeto persistente, sin objetos duplicados.
- [ ] Guardar, cerrar y volver a abrir: la escena de destino no debe contener objetos que solo estuvieron ahí por Play.
- [ ] Probar un proyecto Empty sin cámara, Player ni GameManager: las transiciones no deben crear entidades automáticamente.
- [ ] Con Jolt cargado: probar cuerpo dinámico que avanza/rota antes de la transición; cuerpo recreado con velocidades recuperadas; no duplicar contactos ni colisiones.
- [ ] Probar Gameplay Object persistente en estados world/hand/stored; comprobar reubicación y ausencia de inventario duplicado.
- [ ] Verificar mismo comportamiento con el Player exportado, además de Play Mode en Electron.
- [ ] Parar Play y confirmar liberación de audio, físicas y nodos persistentes; entrar a Play otra vez sin residuos.
- [ ] Forzar error de cambio de escena, inspeccionar que la sesión queda utilizable y reportar fallos de rollback.

## Comparación y entrega

Entregar exclusivamente `LF-RUNTIME-PERSIST-G001_CHANGE.zip` y `LevelForge_RUNTIME_PERSIST_G001_SOURCE_BASELINE.zip`, verificados contra el SOURCE_BASELINE de GameManager. No generar SHA separado ni scripts shell.

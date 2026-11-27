# S16-G007-G002-G003-G001 — Contrato de instanciación runtime de Prefabs

**Autoridad:** Gate exacto autorizado; S16-G001 y G002; G007-G001 Prefab; G007-G002-G001 identidad de escena; G007-G002-G002 vinculación nativa aprobada por el usuario. Esta intervención **no** autoriza aún Spawn Player.

## Responsabilidades

| Sistema existente | Responsabilidad única |
|---|---|
| `materializePrefab` de `src/core/project.js` | Clonación del recurso, remapeo de IDs y Signals, validación de jerarquía |
| `SceneGraph` del Editor/Play | Materializar/desmontar nodos reales de una sesión |
| `NodeLifecycle` / Scripts de Nodo | Entrar, salir, `_ready`, `_process` y enlaces de métodos |
| `NodeBodyRuntime` / `NodeSpatialRuntime` | Alta y baja incremental de cuerpos en Jolt existente |
| `game.prefabs` / host de Play | Única interfaz pública del ciclo de vida temporal |
| `project.objects` durante Play | Estado autoritativo temporal de escena; se limpia antes de persistir |

El mapa `_runtimePrefabInstances` conserva únicamente qué IDs pertenecen a la instancia temporal. **No** crea un segundo árbol de escena ni guarda estado físico o de animación.

## Semántica de la API

- `game.prefabs.instantiate(prefab, options?)`: resuelve por ID o nombre no ambiguo del recurso, valida la jerarquía, remapea IDs y Signals, crea nodos de escena, registra físicos en el mundo actual y activa el ciclo de vida. Devuelve handle de raíz.
- `options.parent` puede referir un nodo autoral activo; `options.position` fija posición mundial finita. No se admite anidar una instancia dinámica en otra dinámica.
- `game.prefabs.destroy(instancia)`: únicamente destruye raíces creadas por esta API. Las referencias a nodos destruidos quedan inválidas.
- Una operación fallida debe deshacer sus altas; STOP o cambio de escena destruyen lo creado por la sesión antes del guardado.
- No se admiten en este Gate nodos especiales `event`, `terrain`, `navigation` y `liquid`, que requieren otras rutas de inicialización.

## Integración y límites

No se modifica el recurso Prefab original. No se crea otro mundo Jolt, otro gestor, otro controlador ni otro bucle físico. `game.player` y `playerNodeId` no se modifican. La API `Spawn Player` es trabajo pendiente de `G007-G002-G003-G002`; tampoco se elimina el nodo Spawn heredado ni `FpsPlayer`.

La paridad de Editor/NGM Runtime, el alta/baja real de WASM, la compilación y la instalación de VSIX permanecen **NO VERIFICADAS** hasta QA local. Las pruebas Node demuestran lógica y rollback con dobles; no prueban la ejecución visual.

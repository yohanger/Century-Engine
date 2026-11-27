# LevelForge — S16-G007-G002-G003-G001 — QA de Prefabs en ejecución

**Gate:** `LF-FPS-NATIVE-PLAYER-S16-G007-G002-G003-G001-RUNTIME-PREFAB-INSTANTIATION`

**Estado:** IMPLEMENTADO; test automatizado focal PASS; compilación, Editor y NGM Runtime **NO VERIFICADOS**. No declarar CERRADO antes de QA local y aprobación.

## Alcance comprobable

- `game.prefabs.instantiate(prefab, { parent?, position? })` devuelve el handle de la raíz de una instancia **temporal**. El identificador o el nombre deben resolver inequívocamente un recurso de Prefab existente. `position` son coordenadas mundiales `[x, y, z]` finitas.
- `game.prefabs.destroy(instancia)` devuelve `true` si elimina una instancia dinámica de la sesión; `false` si no pertenece a esta API. Nunca borra un nodo autoral.
- La materialización comparte el remapeo de IDs, las referencias entre nodos y las conexiones de Signals con el Editor; instancia nodos reales en la escena existente. No genera un personaje controlado automáticamente ni reasigna `game.player`.
- Para los nodos físicos incluidos, la ruta de alta/baja reutiliza `NodeBodyRuntime` y `NodeSpatialRuntime`. No reinicia Jolt ni crea un segundo mundo físico. Esta parte aún necesita comprobarse con WASM real.
- Los nuevos nodos y Signals se retiran antes de STOP y antes de persistir el cambio de escena; nunca deben terminar en el proyecto o Prefab original.

## Preparación local

1. Extraer **SOURCE_BASELINE** en una carpeta separada; conservar la anterior y no aplicar CHANGE encima de esta misma copia.
2. Ejecutar desde la raíz que contiene `package.json`:

   ```bash
   npm ci
   node --test scripts/test-fps-native-player-s16-g007-g002-g003-g001-runtime-prefab.mjs
   npm run build
   npm run electron
   ```

3. Resultado automatizado de referencia: **12 PASS, 0 FAIL, 0 SKIP**. En el entorno de implementación Vite no estaba instalado: build **NO VERIFICADO**.
4. Crear un proyecto de prueba nuevo, **sin reemplazar proyectos del usuario**. Añadir un Prefab simple llamado **Caja QA** (con una representación visual); opcionalmente añadir `StaticBody3D` con `CollisionShape3D` para probar Jolt.
5. Añadir un `Node3D` ordinario con un recurso Script de Nodo basado en `scripts/fixtures/fps/s16-g007-g002-g003-g001-runtime-prefab-node.js` y configurar una acción `qa_prefab` de Input Map a una tecla libre.

## Matriz de aceptación manual

| Caso | Resultado esperado | Estado inicial |
|---|---|---|
| Pulsar acción `qa_prefab` | Aparece la instancia en el mundo durante Play, no en los Assets originales | NO VERIFICADO |
| Volver a pulsar | Desaparece solamente la instancia creada | NO VERIFICADO |
| Crear dos instancias desde scripts distintos | IDs diferentes, sin compartir transformaciones ni estado | NO VERIFICADO |
| Prefab con Signals de sus propios nodos | Conexiones remapeadas solo al subárbol nuevo | NO VERIFICADO |
| Prefab con cuerpo físico Jolt | Su cuerpo colisiona y se libera sin reiniciar los cuerpos existentes | NO VERIFICADO |
| Prefab no compatible o posición inválida | Error controlado; ninguna instancia parcial | NO VERIFICADO |
| STOP / iniciar Play otra vez | No quedan instancias de sesión anterior | NO VERIFICADO |
| Cambiar y guardar escena | No persisten nodos o Signals transitorios | NO VERIFICADO |
| Prefab original | No cambia su contenido, ID ni revisiones | NO VERIFICADO |
| NGM Runtime independiente | Misma instanciación, interacción, destrucción y limpieza | NO VERIFICADO |

**Restricciones explícitas del Gate:** la instanciación dinámica de Prefabs con nodos `event`, `terrain`, `navigation` o `liquid` se rechaza; no está autorizada su activación dentro de este Gate. Tampoco se permite crear un Prefab dinámico bajo otra instancia dinámica. Spawn Player, `game.player`, Database, ViewModel y la retirada de `FpsPlayer` se reservan para Gates posteriores.

## Evidencia que debe devolver el usuario

- Salida de pruebas Node y `npm run build`.
- Captura/vídeo de Editor antes/después de instanciar y destruir; estado de consola/`game.log` en caso de fallo.
- Resultado del escenario físico con Jolt real, incluyendo cuerpos preexistentes.
- Resultado en NGM Runtime independiente y confirmación de que STOP/cambio de escena no persisten la instancia.

**Estados de reporte separados:** IMPLEMENTADO, TEST AUTOMATIZADO PASS, COMPILADO, QA LOCAL PASS, APROBADO y CERRADO.

# LevelForge — LF-MESH-LINKED-INSTANCE-G001

**Autorización:** `Listo. LF-MESH-LINKED-INSTANCE-G001 autoriza comenzar` · 2026-10-27.  
**Estado:** IMPLEMENTADO · TEST NODE PASS · BUILD / QA VISUAL NO VERIFICADOS · APROBACIÓN PENDIENTE.

## Baseline y continuidad

Punto de partida: `LevelForge_SCENE_CLIPBOARD_G001_SOURCE_BASELINE.zip`, 872 archivos, ZIP íntegro. Se conservan los Gates anteriores, Shader Graph, Dock/Undock, Loop Cut, transformaciones numéricas y el portapapeles de escena. **No se tocan ni la cámara deformada ni el CSG sustractivo:** incidencias diferidas por petición del usuario.

## Diseño e implementación

- Registro **global al proyecto** `project.meshes`: `{ id, mesh }`, persistido en metadatos para todas las escenas del proyecto. `ensureFs` reconoce proyectos antiguos sin registro, sin sustituir objetos ni su geometría.
- Cada objeto editable conserva su `id`, `position`, `rotation`, `scale`, `color`, `materialId`, colisión y material; si es una instancia, `obj.props.meshRef` contiene el ID de una geometría del registro y no guarda otra `props.mesh` duplicada.
- `src/engine/runtime/mesh/shared-mesh.js`: `meshDataOf`, `linkMesh`, `unlinkMesh`, `writeMesh`, `meshConsumers`. Este módulo no depende de Electron, Vue ni Three.js.
- **Alt+D**: crea copias enlazadas de mallas editables, o convierte primitivas mediante el mecanismo `_convertToMesh` que ya existe en el Editor, de manera reversible con Undo. Permite grupos con hijos. El procedimiento restaura el estado anterior si una conversión falla y no deja recursos parcialmente vinculados.
- **Ctrl+D**: mantiene copia independiente, incluida la geometría de un origen vinculado. **Ctrl+C/Ctrl+V**: crea instantánea independiente, colocada frente a la cámara como en G001 anterior.
- **Hacer malla independiente**: rompe únicamente el vínculo del objeto seleccionado, mantiene geometría, material y transformaciones, y conserva los demás consumidores.
- Edit Mesh carga la malla desde la referencia y confirma el PolyMesh en el recurso compartido. Al confirmar una edición, se sincronizan las otras instancias de la escena activa. El Editor mantiene una sola entrada de historial por operación; `history.js` guarda/restaura `meshes` junto con objetos y materiales.
- SceneGraph/Player resuelve geometría compartida desde el proyecto mediante el entorno `PBR_ENV` existente; el objeto mantiene geometría de render/colisión independiente de su transformación. El juego exportado mantiene `meshes` en `game.json` sin recrear geometrías en los nodos.
- La exportación de escenas como `.levelpackage` materializa los datos por valor (mallas independientes) para que el destino no dependa del registro de otro proyecto; el archivo de proyecto `.lfproj` conserva el registro y los vínculos.
- Se extendieron el Inspector, la paleta de comandos, el menú Editar, el menú contextual y `Alt+D`. `Shift+D` en Edit Mesh sigue duplicando elementos geométricos, no objetos vinculados.

## Riesgos y límites

- La actualización automática del resto de instancias ocurre **al confirmar** la modificación geométrica. La previsualización durante el arrastre sigue siendo local a la sesión, para no alterar recursos compartidos antes de confirmar ni romper Cancelar.
- Las geometrías sin consumidores se conservan en `project.meshes` porque borrar automáticamente un recurso sin revisar todas las escenas podría romper referencias en escenas no cargadas. Una limpieza global de referencias huérfanas requeriría un Gate específico, no se ha realizado.
- Los materiales permanecen por objeto; los datos geométricos compartidos incluyen normales, UV, color y pesos almacenados en PolyMesh. La representación GPU no es un `THREE.InstancedMesh`: se comparten **datos de geometría persistentes**, no necesariamente un único `BufferGeometry`, para conservar materiales, selección y físicas individuales.
- `.levelpackage` exporta geometría independiente por valor, no conserva enlaces a un proyecto ajeno. `.lfproj` sí conserva los vínculos originales.
- No se han verificado el render de Electron, FPS, Player real, ni exportación física; el registro global de geometrías fue verificado mediante pruebas de simulación y código Node, no E2E de GPU/Jolt.
- La prueba heredada `INT-11` se actualizó: ahora debe aceptar `meshDataOf(obj, project.meshes)`, sin alterar el resto del contrato de PolyMesh. La prueba HC-15 de proyectos anteriores permanece sin cambios y vuelve a pasar gracias a la restauración condicional de `meshes` en el historial.

## Pruebas ejecutadas

| Evidencia | Resultado |
|---|---|
| `node --test scripts/test-mesh-linked-instance-g001.mjs` | **29 PASS / 0 FAIL** |
| Regresión Node (excluyendo `test-starcat.mjs`) | **1884 PASS / 0 FAIL / 18 SKIP** |
| Sintaxis de módulos JS modificados | PASS |
| `npm run build` | NO VERIFICADO: `vite: not found`, código de salida 127 |
| Editor Electron, Player/AppImage, colisiones Jolt, QA visual | **NO VERIFICADOS** |

## QA local obligatorio

```bash
cd ~/ENGINES/lf-0.26.13/lf
node --test scripts/test-mesh-linked-instance-g001.mjs
npm run build
npm run electron
```

- [ ] Crear una malla editable y pulsar Alt+D. Verificar dos nodos distintos, con el mismo `meshRef` y geometría visible.
- [ ] Editar vértices de la instancia A en Edit Mesh; confirmar la edición. Verificar que la instancia B cambia de geometría sin cambiar su transformación, color ni material.
- [ ] Mover/rotar/escalar A desde el Inspector y gizmo. Confirmar que B no se mueve.
- [ ] Probar Alt+D desde una primitiva y comprobar conversión a PolyMesh, forma y escala consistentes.
- [ ] Crear dos o más vinculadas y modificar una. Confirmar que todas actualizan al terminar la operación.
- [ ] Crear Ctrl+D y Ctrl+C/Ctrl+V desde una instancia vinculada. Editar la nueva: la fuente original y demás vinculadas NO deben cambiar.
- [ ] Elegir «Hacer malla independiente» en B y verificar que el vínculo se rompe y la forma se conserva.
- [ ] Eliminar A (fuente original); B y C deben seguir mostrando su malla.
- [ ] Deshacer y rehacer creación, edición, independencia y eliminación. Confirmar vínculos correctos.
- [ ] Guardar y reabrir `.lfproj`; cambiar de escena: comprobar referencias compartidas del proyecto.
- [ ] Comprobar que escenas `.levelpackage` siguen exportables; al importarse en otro proyecto su geometría es independiente.
- [ ] Probar Player y exportación AppImage con dos vinculadas, materiales distintos y colisiones; registrar evidencia real.
- [ ] Probar Ctrl+R, Shift+D en Edit Mesh, Ctrl+D y Ctrl+C/V para detectar regresiones.

## Entrega

Exactamente dos ZIP: `CHANGE` incluye solo altas/cambios, tests, QA y ledger; `SOURCE_BASELINE` incluye todo el código fuente acumulado sin dependencias instaladas, builds ni cachés. **No cerrar el Gate sin aceptación expresa del usuario.**

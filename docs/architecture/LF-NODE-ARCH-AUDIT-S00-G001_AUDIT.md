# LevelForge 0.26.13 — LF-NODE-ARCH-AUDIT-S00-G001
## Auditoría verificable de responsabilidades de nodos (solo lectura de producción)

**Fecha:** 2026-10-28. **Gate autorizado:** LF-NODE-ARCH-AUDIT-S00-G001.
**Fuente de verdad:** `LevelForge_EDITOR_WINDOWS_LAYOUT_CORR_G001_SOURCE_BASELINE(1).zip` (905 entradas, ZIP íntegro). **Arquitectura activa:** Node Registry + SceneGraph; no ECS.
**Alcance del Gate:** documentación, plan, QA y ledger. No se modifica `src/`, `scripts/`, ni el contrato funcional de eventos.
**Estados:** auditoría entregada = IMPLEMENTADA; aprobación de S00 = PENDIENTE de QA/aceptación usuario; S01-S07 = NO AUTORIZADOS.

### Método y precisión de las afirmaciones

- **OBSERVADO**: una declaración, lectura o llamada está realmente presente en el código inspeccionado; no significa que una interfaz funcione en Electron o un exportado.
- **DEUDA DE DISEÑO**: se verifica que datos de dominios distintos comparten propietario, o que un módulo concreto conoce más subsistemas de lo necesario. No se confunde tamaño de archivo con incumplimiento de SOLID.
- **PROPUESTA**: destino de la próxima refactorización; no está implementado.
- **BLOQUEO**: dependencia que debe resolverse mediante contrato/QA antes de alterar producción.

### Inventario completo del registro (24 tipos / 23 módulos que registran tipos)

| Tipo actual | Definición | Responsabilidad observada | Evaluación / destino propuesto |
|---|---|---|---|
| group | `nodes/group.js` | Agrupar objetos y transformar jerarquía | Conservar concepto; evaluar Node3D sin crear árbol paralelo |
| primitive | `nodes/primitive.js` | Geometrías paramétricas | Mantener generadores; separar colisión física en nodos específicos |
| subtract | `nodes/subtract.js` | Definir volumen CSG | Especializado; mantener BSP/recortes existentes |
| light | `nodes/light.js` | Iluminación | Conservar especialización de luz; no hacer motor de luces nuevo |
| spawn | `nodes/spawn.js` | Ubicación de aparición | Conservación y dependencia de ciclo de vida de Player |
| camera | `nodes/camera.js` | Cámara de escena | Conservar sistema de cámara y proyección |
| cameraShake | `nodes/camera-shake.js` | Volumen/efecto de sacudida | Conservar salvo hallazgos adicionales |
| trigger | `nodes/trigger.js` | Región de disparo | Auditar separación entre sensor físico y lógica de eventos |
| atmovolume | `nodes/atmovolume.js` | Volumen atmosférico | Conservar configuración/efecto, reusar sensores donde corresponda |
| postvolume | `nodes/postvolume.js` | Volumen post-proceso | Conservar |
| navigation | `nodes/navigation.js` | Configuración de navegación | Conservar bake/nav; no asociar solidez implícita al render |
| event | `nodes/event.js` | Volumen, gizmos y gráfico de páginas | PROTEGIDO: comandos/páginas/señales; dependencia visual identificada |
| gameplayObject | `nodes/gameplay-object.js` | Objeto de Database/acciones | Auditar dependencia visual con `buildEventGraphic()` |
| model | `nodes/model.js` | Representación de modelos | Mantener assets; eliminar colisión asociada al tipo visual |
| decal | `nodes/decal.js` | Calcomanías | Mantener |
| mesh | `nodes/mesh.js` | PolyMesh, buffers, caché, render | Mantener geometría/UV/pintura; mover forma de colisión fuera de `props.collider` |
| text | `nodes/text.js` | Texto 3D | Mantener; colisión separada |
| road | `nodes/road.js` | Malla de carretera | Mantener geometría; colisión separada |
| water | `nodes/water.js` | Agua física/visual | Mantener WaterWorld, no duplicar flotación |
| audio | `nodes/audio.js` | Fuente de audio | Mantener motor de audio |
| canvas | `nodes/canvas.js` | Lienzo de UI | Mantener subsistema UI |
| critters | `nodes/critters.js` | Comportamiento decorativo/naturaleza | Conservar hasta evaluación específica |
| sprite3d | `nodes/sprite.js` | Sprite espacial | Mantener render sprite |
| sprite2d | `nodes/sprite.js` | Sprite en pantalla | Mantener Canvas/UI |

El registro es declarativo con `registerNode(def)` en `nodes/registry.js`; un tipo expone principalmente `create`, `build` y `update`. `nodes/index.js` importa los módulos para registrarlos. Por ello, contar un módulo por tipo no es correcto: `sprite.js` registra 2.

### Hallazgos observados por dependencia

| ID | Clasificación | Evidencia verificable | Implicación contractual |
|---|---|---|---|
| H01 | DEUDA CONFIRMADA | `nodes/index.js::makeObject` inicializa `color`, `roughness`, `metallic`, `opacity`, `collision:true`, `castShadow`, Transform para todo tipo | Mover solo datos verdaderamente generales a Node/Node3D; el tipo especializado tendrá sus propiedades |
| H02 | DEUDA CONFIRMADA | `nodes/mesh.js::create` usa `props: {mesh, collider:'trimesh'}`; `Inspector.vue` edita `collision`, `dynamic`, `bodyShape`, `bodyMass` | Separar forma, cuerpo y representación; actualizar inspector y autores, no solo quitar controles |
| H03 | DEUDA CONFIRMADA | `events/play.js::_setupScene` recorre `project.objects`, filtra tipos `primitive`, `mesh`, `model`, `road`, `text` y `o.collision` para producir colisiones | Sustituir por jerarquía de PhysicsBody3D+CollisionShape3D en Gate físico; no iniciar una segunda ruta activa |
| H04 | DEUDA CONFIRMADA | `events/play-bodies.js::_bodiesInit` consulta `props.dynamic`, `props.floats`, `bodyShape`, `bodyMass` y registra objetos dinámicos; `_bodiesTick` sincroniza poses | Extraer inicialización/gestión de cuerpos a `runtime/physics/`; conservar API `game.physics` y señales compatibles o declarar cambio explícito |
| H05 | OBSERVADO | `events/play-controls.js::_simStep` ejecuta `game.update`, por paso fijo `game.fixedUpdate`/Player, luego `_events`, `_inputTriggers`, `_bodiesTick` y `game.lateUpdate` | Registrar orden exacto; no asumir que `_bodiesTick` está dentro del bucle `n`; auditar orden físico antes de moverlo |
| H06 | OBSERVADO | `package/game.js::openGame` crea `SceneGraph` y `new PlayMode(graph)` con `runtime=true` | Editor/Player comparten PlayMode; QA debe cubrir ambos y exportación |
| H07 | OBSERVADO | `events/interpreter.js::loadScripts(scripts)` ejecuta scripts del proyecto al inicio; `Game` dispone `update`, `fixedUpdate` y `lateUpdate` | No existe contrato documentado e integrado de script *por instancia de nodo*; agregarlo en Gate S05 sin duplicar scripts globales |
| H08 | OBSERVADO | `core/state/tree.js` maneja `parentId`, ciclos y matrices; `scene/objects.js::_attach` traduce esa jerarquía a Three.Object3D | Extender árboles existentes, no introducir segundo SceneGraph o mundo ECS |
| H09 | RIESGO | `nodes/event.js::buildEventGraphic` construye gráficos; `nodes/gameplay-object.js` lo reutiliza | Evaluar dependencias de presentación sin alterar lógica de evento; extraer solo si Gate específico permite |
| H10 | OBSERVADO | `nodes/three-helpers.js::makeRoot` crea `Group` + `visual` y separa escala visual de transformación raíz | Conservar convención y revisar su interacción con cuerpos/shape y escala de padres |
| H11 | OBSERVADO | `physics/{jolt,bodies,collider-shape,jolt-character,jolt-sensors}.js` ya implementan componentes de infraestructura física | Reutilizar Jolt, cuerpos, sensores y formas; no reemplazar motor ni duplicar dinámica |
| H12 | RIESGO | `core/godot/nodes.js`, `core/nav/editorBake.js` y otros consumidores emplean atributos visuales/físicos heredados | Inventariar y actualizar consumidores del **nuevo formato**, aunque no se conserven escenas antiguas |

### Fronteras SOLID propuestas

- **SRP:** Node identidad/parentesco; Node3D local TRS; MeshInstance3D geometría/material; CollisionShape3D `shape`; StaticBody3D/RigidBody3D/CharacterBody3D física; Area3D detección. Los sistemas especializados mantienen sus capacidades.
- **OCP:** registrar nodos nuevos mediante `registerNode` extendido, evitando dispersar `if (o.type===...)` por el runtime. Una sola infraestructura de integración registra qué nodos generan objetos Jolt.
- **LSP / contratos:** `build/update` no deben dejar nodos parcialmente válidos; los métodos de jerarquía preservarán identidad, orden y transformación; `CollisionShape3D` solo alimentará un `CollisionObject3D` compatible.
- **ISP:** un nodo de render no exige API física ni viceversa; un script de nodo no recibe herramientas exclusivas del Editor.
- **DIP práctico:** NodeRegistry/Runtime dependen de contratos pequeños; Three.js y Jolt detrás de implementaciones **existentes**. Sin contenedores IoC, service locator o jerarquía de clases forzada.

### Compatibilidad y decisiones vinculantes

1. El usuario **renunció expresamente a compatibilidad con escenas antiguas**: no crear migradores ni rutas legacy. Esta renuncia NO autoriza romper sistemas internos del motor ni destruir recursos de autoría existentes sin validar el nuevo modelo.
2. Mantener SceneGraph/NodeRegistry. **ECS S00-S02 quedan descartados para esta rama**; no están en este baseline.
3. Mantener el orden real `PlayMode`/Player y el funcionamiento de Event Pages, comandos y señales. Para tocar módulos ubicados bajo `events/` por extracción de física será necesaria **autorización explícita de Gate acotado**: no se deduce del S00.
4. No modificar la física global del Player en este Gate. El diseño de CharacterBody3D deberá decidir si usa la implementación `jolt-character.js` antes de crear otra.
5. Godot es referencia de **composición y UX**, no una licencia para copiar código ni para asumir que LevelForge dispone de nodos o lifecycle ya implementados.

### Referencias públicas consultadas (concepto, no evidencia del código de LevelForge)

- Godot: https://docs.godotengine.org/en/latest/getting_started/step_by_step/nodes_and_scenes.html
- Godot: https://docs.godotengine.org/en/4.4/tutorials/physics/collision_shapes_3d.html
- Godot: https://docs.godotengine.org/en/stable/classes/class_area3d.html

### Conclusión

**VIABLE CON PRERREQUISITOS.** Se puede conservar la arquitectura de nodos. El mayor riesgo es la transición desde colisiones de tipos visuales hacia nodos físicos en el runtime compartido, junto con las dependencias en `events/` y exportación. Ninguna nueva física o UI se afirma implementada en S00. La arquitectura definitiva deberá validarse en sprints posteriores contra Editor y Player reales.

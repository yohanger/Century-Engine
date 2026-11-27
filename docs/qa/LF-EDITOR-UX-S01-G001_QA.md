# LF-EDITOR-UX-S01-G001 — Selección y colocación en viewport

**Autorización literal:** `Listo. LF-EDITOR-UX-S01-G001 autoriza comenzar` (2026-10-25).  
**Fuente de verdad:** `LevelForge_THREE_VERSION_G001_FINAL_SOURCE_BASELINE.zip`, Three.js 0.186.1.  
**Estado:** IMPLEMENTADO; QA visual/compilación Editor/Player pendientes en Linux.

## Alcance y comportamiento

1. `src/core/editor/pointer.js`: el raycast de selección ignora descendientes ocultos, ayudas etiquetadas (`helper`, `pickIgnore`) y materiales ocultos salvo los proxies designados `pickProxy`. Conserva la comprobación de bloqueos, la elección por distancia frente al terreno y el manejo existente del agua transparente. La selección sigue llamando a `selectObject` con Shift/Ctrl/Cmd, sin registro duplicado.
2. La colocación emplea un raycast **solo sobre mallas visibles de superficie** (no gizmos, líneas ni proxies invisibles). Si apunta al terreno visible, usa ese punto. Si no hay geometría, devuelve una posición `free` a 6 unidades del origen del rayo, en la dirección visual; elimina la intersección con el plano infinito, que podía enviar los nodos lejos o al origen.
3. `src/core/editor/placement.js`: en colocación libre no se aplican compensaciones verticales de apoyo (primitivas, focos, cámaras, eventos) ni se modifica el punto por el suelo. Al apuntar a una superficie real, mantiene los offsets originales y snapping original. Shift+A usa el cursor solamente cuando está dentro del viewport; desde los botones exteriores toma el centro del viewport. Continúa convirtiendo punto mundial a local bajo grupos transformados. Los prefabs arrastrados a espacio libre tampoco son desplazados al terreno fuera del encuadre.
4. `src/engine/runtime/nodes/three-helpers.js`: marca hitSphere como proxy editorial deliberado; flechas de orientación como ayuda, no como geometría seleccionable.
5. `src/engine/runtime/nodes/audio.js`: los anillos del emisor están marcados como ayuda; el cono/altavoz mantiene geometría seleccionable. Su visibilidad general se corrige en el Gate separado G002, NO en este Gate.
6. `src/core/editor/roads.js`: conserva explícitamente la proyección histórica sobre el plano del suelo para la herramienta de carreteras, evitando introducir una carretera flotante como efecto secundario de la colocación libre.

**Sin modificación:** física Jolt, grafo de escenas, identidad de nodos, Undo/Redo, Player, shaders, luces ni paquete FrostEngine. `FrostEngine_v1(1).unitypackage` queda reservado expresamente para la revisión de DirectionalLight/sol/luna en G003.

## QA automatizado de este Gate

- Ejecutar: `node --test scripts/test-editor-ux-s01-g001.mjs`.
- Resultado en el entorno de preparación: **14 PASS, 0 FAIL**; incluye objetos invisibles, ayudas, proxies, mallas, terreno delantero/trasero, fallback de cámara, bloqueos, compensaciones de colocación, punto de Shift+A, y contratos de multiselección/parentado.
- Regresión acumulada: **871 PASS, 0 FAIL y 18 SKIP** (`node --test scripts/test-*.mjs`, excluyendo test-starcat.mjs por dependencia Three.js ausente).
- `node --check` de módulos modificados y suite: PASS.
- `npm ci`, Vite build y QA WebGL real: **NO VERIFICADOS** en el entorno de preparación (no contiene node_modules). Las regresiones Node no acreditan por sí solas el render visual.

## QA manual obligatorio — r186.1 en Linux

| ID | Procedimiento | Criterio |
|---|---|---|
| UX1 | Seleccionar primitivas y modelos por clic desde frente y detrás | Selección consistente; sin captar ayudas auxiliares |
| UX2 | Seleccionar una fuente de audio junto a los anillos | El icono selecciona; los anillos no capturan clics lejanos |
| UX3 | Seleccionar grupo vacío y decal | Proxies invisibles conservan selección local |
| UX4 | Colocar cursor sobre la superficie de una caja y añadir otra primitiva | La primitiva nace junto a la superficie y respeta offset de apoyo |
| UX5 | Mirar al cielo/horizonte sin terreno visible y Shift+A | El nodo nace delante de cámara, no en (0,0,0) ni a miles de unidades |
| UX6 | Abrir Añadir desde barra/Hierarchy sin cursor dentro del viewport | Inserción en la dirección central de la cámara |
| UX7 | Activar snapping y añadir sobre superficie | Conserva snapping y offsets originales |
| UX8 | Añadir dentro de grupo desplazado/rotado | Guarda coordenadas locales correctas; posición mundial esperada |
| UX9 | Shift+clic y Ctrl/Cmd+clic; seleccionar desde jerarquía | Multiselección y toggles sin regresiones |
| UX10 | Bloquear y ocultar un objeto que tapa otro | Solo se elige el objeto elegible situado detrás |
| UX11 | Arrastrar modelo, prefab y sprite sobre viewport | Posición válida; integración con nodo padre e historial |
| UX12 | Herramienta Carretera sobre plano/terreno | No crea puntos flotantes al mirar fuera del suelo |
| UX13 | Undo/Redo de inserciones y cambio de escena | Restitución de objetos, IDs y padres |
| UX14 | Play Mode y Player exportado | Sin cambios a controles o físicas del juego |

## Gates posteriores fuera de alcance

- G002: ejes del TransformControls y visualización condicionada de gizmos propios.
- G003: RectAreaLight, DirectionalLight, sol y luna con consulta del `FrostEngine_v1(1).unitypackage` aportado por el usuario.
- G004: OrbitControls, selección como pivote y restauración tras Play.
- G005: Color Picker, snapping accesible y campos de texto.

Se exige aprobación expresa del usuario antes de iniciar el Gate siguiente.

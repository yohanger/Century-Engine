# LevelForge — LF-SCENE-CLIPBOARD-G001 · QA

**Autorización literal:** `Listo. LF-SCENE-CLIPBOARD-G001 autoriza comenzar`.

**Estado:** IMPLEMENTADO · TEST NODE PASS · COMPILACIÓN/QA VISUAL NO VERIFICADOS · APROBACIÓN PENDIENTE.

## Fuente de continuidad y alcance

El Gate parte exclusivamente de `LevelForge_MESH_TRANSFORM_NUMERIC_G001_SOURCE_BASELINE.zip` (870 archivos, íntegro) y mantiene la edición numérica de PolyMesh, Loop Cut, Shader Graph, los docks de Codex, prefabs, materiales y Player anteriores. El Gate se limita a portapapeles de nodos del Editor, sin Mesh Instances vinculadas ni nuevos recursos de malla.

## Comportamiento implementado

- **Ctrl+C** copia las raíces seleccionadas, sus descendientes y transformaciones mundiales en un portapapeles **interno del Editor**. No escribe al portapapeles del sistema operativo y no crea Undo.
- **Ctrl+V** materializa una copia de la instantánea a **6 unidades delante de la dirección de la cámara del Editor**, centrando allí el conjunto. El punto depende de la orientación actual, no de FOV ni de la posición del puntero.
- La distribución mundial relativa de varias raíces se conserva. Se mantiene la estructura padre–hijo y las transformaciones locales de cada descendiente.
- Cuando la raíz original tenía un padre externo todavía presente, se conserva el parentesco; la matriz mundial deseada se convierte a posición/rotación local con `setLocalFromWorld()`. Si ese padre desapareció, la nueva raíz se ubica en la raíz de la escena. No se inserta una copia dentro de una instancia de prefab ajena.
- Nuevos IDs de nodo en cada pegado. La única referencia interna explícita del esquema actual, `props.targetId` del nodo Decal, se remapea si apunta a otro nodo copiado. Referencias a Assets, materiales, modelos y prefabs mantienen sus IDs de recurso.
- Primitivas conservan sus parámetros; PolyMesh almacena datos de malla **independientes** en la instantánea y cada pegado. No se crean Mesh Instances compartidas.
- Ctrl+D sigue usando `duplicateSelected()` con su comportamiento anterior; Shift+D dentro de Edit Mesh conserva su operación de duplicación geométrica.
- El portapapeles queda dentro del mismo proyecto para no dejar referencias a materiales/modelos/texturas inexistentes en proyectos distintos; permanece disponible para pegados repetidos hasta copiar otra selección. Las operaciones de copia/pegado se bloquean durante edición de mallas, reproducción y modo Film Maker. Los campos INPUT/TEXTAREA/SELECT y contenido editable mantienen Ctrl+C/V nativos de texto.
- Menú **Editar**, paleta de comandos y menú contextual comparten las mismas funciones `copySelected()/pasteSelected()`. Undo/Redo se realiza con **una sola entrada por pegado** mediante el historial existente.

## Evidencia reproducible

| Evidencia | Estado |
|---|---|
| `node --test scripts/test-scene-clipboard-g001.mjs` | **22 PASS, 0 FAIL** |
| Regresión Node disponible, sin `scripts/test-starcat.mjs` | **1855 PASS, 0 FAIL, 18 SKIP** |
| Sintaxis JS de los cuatro módulos afectados | **PASS** |
| `npm run build` en este entorno | **NO VERIFICADO: `vite: not found` (exit 127)** |
| Editor Electron, Player y pruebas manuales reales | **NO VERIFICADOS** |

La suite específica extrae y ejecuta `copySelected()/pasteSelected()` originales bajo un entorno de estado y matemáticas de escena simulado. Verifica el cálculo de posición de `clipboardPlacePoint()` con vectores simulados, jerarquías, IDs, recursos, snapshots, cancelación por modo y una sola llamada a `commit()`. La orientación y conversión matricial exacta con Three.js reales, las combinaciones de grupos rotados y los resultados visuales en Electron quedan pendientes de QA local. La suite no es una prueba E2E de electron ni una certificación visual.

## Instalación segura: usar únicamente CHANGE

Comparar antes los archivos locales si Codex los modificó después de generar el SOURCE_BASELINE recibido; guardar backup:

```bash
cd ~/ENGINES/lf-0.26.13/lf
mkdir -p ~/ENGINES/LevelForge_BACKUPS/LF-SCENE-CLIPBOARD-G001
cp --parents \
  src/core/state/objects.js \
  src/core/editor/placement.js \
  src/core/editor/keys.js \
  src/core/commands.js \
  docs/qa/LevelForge_DB_Ledger.xlsx \
  ~/ENGINES/LevelForge_BACKUPS/LF-SCENE-CLIPBOARD-G001/
unzip -o ~/Downloads/LevelForge_SCENE_CLIPBOARD_G001_CHANGE.zip -d .
node --test scripts/test-scene-clipboard-g001.mjs
npm run build
npm run electron
```

**Resultado esperado de suite específica:** 22 PASS, 0 FAIL.

## QA funcional que debe completar el usuario

- [ ] Seleccionar un cubo y pulsar Ctrl+C, luego orientar la cámara a otro lugar y pulsar Ctrl+V: debe aparecer una copia **delante de la cámara**, no al lado del original.
- [ ] Editar la geometría de PolyMesh pegada en Edit Mesh: la malla original debe permanecer inalterada.
- [ ] Seleccionar dos objetos separados: conservar la distancia y la disposición al pegarlos delante de la cámara.
- [ ] Seleccionar un grupo con hijos: el conjunto debe conservar estructura, rotaciones y posiciones relativas en el viewport.
- [ ] Copiar un nodo cuyo padre está rotado/trasladado: el pegado debe mantener coordenadas mundiales correctas; repetir después de eliminar el padre origen.
- [ ] Copiar nodos con materiales, modelos, texturas, prefabs y un decal dirigido a un objeto del conjunto: referencias internas correctas y recursos válidos.
- [ ] Repetir Ctrl+V varias veces, comprobar IDs independientes y nombres distintos.
- [ ] Undo una vez revierte un pegado completo; Redo restaura todos los nodos pegados.
- [ ] Ctrl+D mantiene su desplazamiento previo. Shift+D dentro de Edit Mesh sigue duplicando geometría; Ctrl+C/V dentro de Edit Mesh **no** copia el nodo completo.
- [ ] Ctrl+C/V en campos de texto funciona con el portapapeles de texto sin interferencias.
- [ ] Guardar y reabrir el proyecto: los objetos pegados, jerarquías, materiales y geometrías persisten. Confirmar Player.

Los controles no deben marcarse PASS sin evidencia de uso local. Si ocurre un fallo, reportar pasos, escena y captura/consola.

## Incidencias diferidas por orden del usuario

- `LF-CAMERA-DISTORTION-BUG`: objetos se ensanchan al mover cámara de Player y de Edit Mode, independientemente del FOV.
- `LF-CSG-SUBTRACT-BUG`: el nodo sustractivo no funciona.

**AMBAS: REPORTADAS · NO INVESTIGADAS · NO MODIFICADAS**. Registradas en BACKLOG para después de S03/S04 y QA integral. No se ha atribuido una causa raíz.

## Continuidad

Se actualizaron ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE y TRACEABILITY. El Gate anterior `LF-MESH-TRANSFORM-NUMERIC-G001` quedó marcado como aprobado por el usuario, sin atribuirle QA visual no evidenciada.

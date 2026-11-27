# LF-FPS-NATIVE-PLAYER-S16-G007-G001 — Plantilla First Person con Prefab nativo

**Gate autorizado:** `LF-FPS-NATIVE-PLAYER-S16-G007-G001-FPS-TEMPLATE-PREFAB`.

## Contrato y resultado

Al crear **un proyecto nuevo** desde `First Person` (`template: 'empty'`), `createProjectData` invoca exclusivamente el proveedor de recursos declarado por esa plantilla. Se crean:

- `Assets/Prefabs/Personaje FPS.prefab`, con `rev:1` y subárbol de nodos ordinarios;
- `Assets/Scripts/FPS-Locomocion.js`, `FPS-Camara.js`, `FPS-Interaccion.js`, con `execution: 'node'` y código editable equivalente a los ejemplos G004–G006;
- las carpetas normales `Assets/Prefabs` y `Assets/Scripts`, usando las colecciones `prefabs` y `scripts` existentes.

```
Personaje FPS (Node3D, raíz del recurso)
└── CharacterBody3D (posición local [0, 1, 0])
    ├── Capsula FPS (CollisionShape3D, cápsula centrada, radio 0.45 y altura 2)
    └── VistaFPS (Camera3D, posición local [0, 0.65, 0], main=true)
```

Los tres `scriptIds` están vinculados al CharacterBody3D. La raíz `Node3D` permite soltar el Prefab en el suelo sin violar la exigencia física de una cápsula centrada en el cuerpo. `VistaFPS` queda aproximadamente a 1,65 m desde el punto de colocación. El Prefab no se instancia por defecto en la escena.

## Propietarios y reutilización

- `src/core/templates/index.js`: descriptor existente de la plantilla First Person.
- `src/core/templates/fps-player.js`: datos de autoría del Prefab y scripts iniciales. No ejecuta física ni crea un controlador.
- `src/core/project.js`: creación de recursos mediante el descriptor de plantilla existente.
- `src/core/state/prefabs.js` y `src/core/editor/placement.js`: **sin cambios**; siguen materializando y remapeando IDs de instancias.
- Los ejemplos G004–G006 permanecen como referencia histórica; la regresión de G007 comprueba que el contenido generado coincide con ellos y evita divergencia accidental.

## Preservación y alcance posterior

- First Person conserva provisionalmente el nodo **Spawn** heredado y `game.player='fps'`, como exige la transición. No se genera otro personaje automáticamente al ejecutar Play.
- El nuevo recurso no reemplaza `FpsPlayer`, no asigna una identidad activa a `game.player` y no implementa la API de aparición programática.
- `Empty` y `Vacío clásico` permanecen sin Prefab FPS ni scripts añadidos.
- Los proyectos anteriores **no se migran retroactivamente**; `ensureFs` no inyecta el Prefab en recursos existentes.
- G007-G002 deberá resolver identidad/Spawn API y G007-G003 Database/persistencia/paridad. No declarar completada la modernización del FPS con este Gate.

## Pruebas y limitaciones

Se verificaron 10 pruebas específicas y una regresión seleccionada total de 95/95 PASS. Se valida estructura física mediante `validatePhysicsTree`, serialización, IDs independientes y referencias a los scripts. La comprobación de instanciación en Editor se basa en el contrato de la ruta de arrastre; no reemplaza el QA visual de Electron.

`npm run build` **no se completó**: `vite: not found`. Electron y NGM Runtime NO VERIFICADOS. La ejecución independiente requiere primero el cierre de identidad y convivencia con Spawn y no debe declararse PASS en G007-G001.

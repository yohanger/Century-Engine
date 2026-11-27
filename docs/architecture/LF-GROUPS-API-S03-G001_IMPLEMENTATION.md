# LF-GROUPS-API-S03-G001 — Implementación y contrato de compatibilidad

**Autorización:** `Listo. LF-GROUPS-API-S03-G001 autoriza comenzar`.
**SOURCE_BASELINE:** archivo adjunto `LevelForge_SCENE_INSPECTOR_OWNERSHIP_S02_G001_SOURCE_BASELINE(1).zip`; 1.466 archivos; ZIP íntegro.
**Estado:** IMPLEMENTADO · TEST NODE NUEVO PASS · Electron/build/QA visual NO VERIFICADOS · NO CERRADO.

## 1. Diagnóstico sobre código real

OBSERVADO: el registro `project.tagLayers` agrupa etiquetas globales, 32 Layers y superficies acústicas; los objetos utilizan `tag: string` singular. `TagLayerRow.vue` expone el selector Tag y `TagsLayersModal.vue` la administración; `game.findByTag`, `NodeHandle.tag`, `play-look.js`, `play-sense.js` y `play-light.js` consumen Tags antiguos. Spawn/Trigger utilizan **otra propiedad** `props.tag` para identificar sus funciones. `group` es además un tipo de nodo de jerarquía, no una pertenencia lógica.

Riesgo: eliminar `tag` del modelo o convertir automáticamente Spawn/Trigger a Groups rompería rutas de escena, eventos y archivos anteriores. Por ello la API antigua permanece funcional pero se oculta del Inspector general.

## 2. Fuente de verdad y esquema

- **Pertenencia:** `object.groups: string[]`, por nodo de escena (persistido dentro de `scene.objects`), orden estable, sin repetidos por mayúsculas y con nombres de hasta 40 caracteres. `parentId` mantiene jerarquía independiente; Layers, superficies y pasos conservan sus 32 ranuras.
- **Registro sugerido:** `project.tagLayers.groups` representa únicamente nombres globales editables; no define pertenencias. Se extiende el registro existente en lugar de crear otro catálogo. `project.tagLayers.tags` y `object.tag` se mantienen como compatibilidad interna.
- **Normalización:** `migrateScene` migra automáticamente un Tag existente salvo `Untagged` al grupo del mismo nombre cuando `groups` no existe; no vuelve a añadirlo si `groups` ya es un arreglo. Las llamadas repetidas son idempotentes. Se normalizan también los objetos internos de Prefabs en `ensureFs` y los nuevos objetos se crean con `groups: []`.
- **Eliminación de nombre registrado:** para impedir pérdida silenciosa de pertenencias en escenas **no abiertas**, eliminar un nombre de `tagLayers.groups` no borra `object.groups`; el Inspector ofrece las pertenencias no registradas del nodo. Retirar pertenencia de un nodo se realiza expresamente mediante su casilla.

## 3. API de scripting, alcance y ciclo de vida

Las operaciones de `NodeHandle` y `NodeScriptHandle` comparten el handle de nodos real:

```js
node.add_to_group('enemigos')
node.remove_from_group('enemigos')
node.is_in_group('enemigos')
node.get_groups()
game.get_nodes_in_group('enemigos')
```

Las operaciones de edición de grupos realizadas durante Play son **cambios temporales**, registrados como diferencias privadas de `PlayMode` por ID: no modifican `object.groups`, las escenas persistidas ni prefabs. El mapa de diferencias se reinicia al crear/recargar otra escena. `get_nodes_in_group` recorre los objetos de la escena activa y solo devuelve handles de nodos representados en el SceneGraph (`ed.nodes`). No hay un segundo árbol, registro de nodos o servicio global.

`_tagLayerApi` mantiene getters de `tag/layers/surface`; `findByTag` sigue disponible para scripts anteriores. La API nueva no introduce comandos de eventos, señales, filtros automáticos por Groups en Sensor/raycast ni nuevas responsabilidades para `props.tag` de Spawn/Trigger.

Las definiciones de tipos se actualizan **en las dos copias reales** del contrato (`src/core/events/game-api.d.ts` y `vscode-extension/media/game-api.d.ts`) y la referencia `docs/referencia/api.md`.

## 4. UI y límites

- Se **extiende** `TagLayerRow.vue`: sustituye el selector único Tag por casillas de Groups, mantiene intacta la selección múltiple de Layer y sus prioridades para audio/superficies.
- Se **extiende** `TagsLayersModal.vue`: pestañas Groups/Layers; permite crear y dejar de sugerir grupos, no borra datos de otras escenas y conserva el editor existente de sonidos de pasos. `core/commands.js` cambia el texto de la entrada Juego, sin añadir ventanas.
- La administración de Groups del proyecto **no** sustituye el nodo de jerarquía `group`, el mezclador de audio, etiquetas HTML/CSS ni las etiquetas funcionales de Spawn/Trigger.
- Queda fuera del Gate retirar las APIs heredadas, migrar filtros `tags` de sensores/rayos o redefinir comandos de eventos. Si otra documentación aprobada exige su retirada inmediata, se necesita un Contract Amendment.

## 5. Evidencia y límites QA

- Pruebas nuevas: `scripts/test-groups-api-s03-g001.mjs`, **31/31 PASS**, con normalización, registro, migración, estado de Play, NodeHandle real simulado sin renderer, Prefabs, UI y preservación de Spawn/Trigger.
- Batería focal Node de Groups + Node Scripts + Scene Inspector: **106 PASS, 1 FAIL preexistente** (`NE6-16` espera CSS `@container insp (max-width: 340px)` que no existe en el SOURCE_BASELINE S02). Prefab/física/gameplay adicional **18/18 PASS**.
- Regresión amplia exploratoria de 231 archivos: **3.882 PASS, 116 FAIL, 19 SKIP**; NO se declara PASS global; hay suites con dependencias, runner externo y contratos antiguos no relacionados. Debe clasificarse individualmente antes de atribuir errores al Gate.
- `scripts/test-groups-api-electron-s03-g001.mjs`: runner embebido preparado. **NO VERIFICADO** al faltar Vite/Electron instalados en este entorno; `npm run build` devuelve `vite: not found`. No hay QA de Player ni test visual de usuario.

Ver instrucciones en `docs/qa/LF-GROUPS-API-S03-G001_QA.md`.

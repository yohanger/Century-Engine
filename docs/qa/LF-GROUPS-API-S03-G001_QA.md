# QA — LF-GROUPS-API-S03-G001

**Estado:** IMPLEMENTADO; NODE NUEVO 31/31 PASS; BUILD/ELECTRON/QA LOCAL NO VERIFICADOS; NO CERRADO.

## 1. Instalación

Extraer SOURCE_BASELINE S03 en una carpeta independiente. El CHANGE S03 solo debe extraerse sobre copia del SOURCE_BASELINE S02 exacto adjunto. No sobrescribir trabajo local ni proyecto de juego, escenas, Assets, Player o plantillas sin comparar.

```bash
npm ci
node --test scripts/test-groups-api-s03-g001.mjs
node --test scripts/test-node-script-s05-g001.mjs scripts/test-node-script-s05-corr001.mjs
node --test scripts/test-groups-api-electron-s03-g001.mjs
npm run build
npm run electron
```

Se espera **31/31** nuevos Node, suites focales sin fallos atribuibles a S03, fixture Electron 1/1 con 16 comprobaciones, Editor/Player compilados. QA Electron no reemplaza la prueba manual Editor/Player.

## 2. QA manual del usuario

1. Crear nodo Cubo. Inspector: Groups permite asignar varios nombres; Layers sigue siendo múltiple e independiente. Abrir `Juego → Groups y Layers`, crear `enemigos` y `voladores` y comprobar que aparecen en el selector.
2. Asignar ambos Groups a Cubo; duplicar el nodo, guardar y reabrir; verificar pertenencias e IDs. Repetir con instancia de Prefab (crear/aplicar/revertir).
3. Con un Script en un nodo, ejecutar `node.is_in_group('enemigos')`, `node.get_groups()`, `node.add_to_group('jefes')`, `node.remove_from_group('jefes')`; consultar mediante `game.get_nodes_in_group('enemigos')` y comprobar el número de nodos activos.
4. Durante Play, añadir/quitar Groups por scripting, salir, reabrir y verificar que las pertenencias guardadas no fueron reescritas.
5. Cambiar a otra escena y consultar `game.get_nodes_in_group`: no debe incluir nodos inactivos de la escena anterior. Con scripts `dontDestroyOnLoad`, comprobar el comportamiento de persistencia de nodos retenidos sin borrar pertenencias guardadas.
6. Cargar un proyecto heredado con `tag: 'Enemigo'` y otro `Untagged`; comprobar migración a `groups: ['Enemigo']` y `[]`, sin repetir entradas al reabrir. Verificar `game.findByTag()` en script viejo.
7. Eliminar un nombre sugerido del registro; comprobar que los grupos existentes en nodos no se borran por ello. Eliminar una pertenencia del nodo con casilla.
8. Verificar Spawn `props.tag` (cambios de escena), Trigger `props.tag`, filtros de `raycast({tags})`, Sensor, luces, Layers y sonidos de pasos. **No se agregaron acciones Groups en eventos**.
9. Revisar script editor y autocompletado local/VS Code, guardar, recargar y probar Player exportado. Comprobar que no aparecen duplicados en jerarquía ni árboles paralelos.

## 3. Evidencia a devolver

- Salidas completas Node, Electron y build.
- Capturas del Inspector de un Cubo con dos grupos, ventana Groups/Layers y escena guardada/reabierta.
- Registro o captura del script consultando Groups antes/después de Play y al cambiar de escena.
- Confirmación de compatibilidad con proyecto antiguo, Layers, Spawn/Trigger, export Player y Prefab.

## 4. Resultados realmente observados

- 31/31 Node nuevos PASS; foco complementario 18/18 PASS (Prefab/física/gameplay).
- Suite mixta 106 PASS/1 FAIL `NE6-16`: test anterior exige CSS eliminado previamente, misma incompatibilidad presente en S02.
- Exploratoria amplia 3.882 PASS / 116 FAIL / 19 SKIP; **NO PASS global**, no permite inferir todos esos fallos como regresiones de Groups.
- Electron **NO VERIFICADO** (`Falta Vite; ejecutar npm ci`); compilación **NO VERIFICADA** (`vite: not found`).

**Cierre:** requiere QA local PASS y aprobación del usuario; actualizar ledger solo con evidencia real. No declarar FIXED/READY/CERRADO.

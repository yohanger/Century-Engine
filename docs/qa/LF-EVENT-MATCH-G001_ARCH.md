# LF-EVENT-MATCH-G001 — Arquitectura

## Extensión, no duplicación

- `cmd-core.js`: declaración `CMD_CORE.match`, parámetros y grupos existentes.
- `commandDefs.js`: `newCommand`, `blocksOf` y `syncBlocks` sin alterar el intérprete; ids `case:<identificador>` que no dependen del índice.
- `match.js`: utilidades puras de casos, orden e igualdad estricta. No mantiene estado de ejecución.
- `exec-commands.js`: `EXEC.match`, una sola evaluación del origen, una única llamada al `Game.runList()` existente.
- `ParamForm.vue`: presenta tipos de casos, valores, botones de añadir/quitar/subir/bajar, reutilizando `VarPicker`.
- `EventEditor.vue`: conserva la ventana, selección, lista jerárquica, comandos anidados y edición existente.

## Resolución

```text
CMD_CORE.match
  ↓ commandDefs.blocksOf (case IDs estables)
ParamForm.vue (editar p.cases)
  ↓ syncBlocks, conservar comandos por case:<id>
Evento serializado JSON
  ↓ Game.exec → EXEC.match
Leer variable / constante / señal / script (una vez)
  ↓ primera coincidencia estricta
Game.runList(b[case:id] || b.default) → propagación BREAK/EXIT
```

**No se altera** el modelo de páginas, la ejecución de señales ni el orden de runners. Los nuevos datos son aditivos: los eventos antiguos y los nodos de Gameplay Object se preservan. Al desactivar `Default`, los comandos se mantienen en `b.default` pero no se ejecutan; la rama se oculta del editor hasta reactivarla.

# LF-NODE-SIGNALS-EDITOR-S06-G004 — Contrato de integración final

**Parent:** S06-G001–G003. **SOURCE_BASELINE:** `LevelForge_NODE_SIGNALS_EDITOR_S06_G003_SOURCE_BASELINE.zip`.
**Autorización:** `Listo. LF-NODE-SIGNALS-EDITOR-S06-G004 autoriza comenzar`.
**Estado:** IMPLEMENTADO · QA LOCAL PASS DECLARADO POR USUARIO · APROBADO. Compilación y Electron automatizado NO VERIFICADOS en el entorno de implementación; cierre técnico condicionado a esas verificaciones.

## Alcance

Se cierra el trabajo técnico de autoría visual de Signals en las operaciones de duplicación, portapapeles, Prefabs, Undo/Redo, `.lfproj`, `.levelpackage` y exportación. Se preserva el único `NodeScriptRuntime`, el único SceneGraph y Jolt. No se añaden señales globales ni editor paralelo.

1. La copia, Ctrl+D, Alt+D y pegado crean IDs nuevos por nodo. Solo se copian conexiones cuyos **dos extremos** están en el conjunto clonado; se generan IDs nuevos de conexión. Los extremos externos no se redirigen implícitamente.
2. El recurso Prefab guarda `objects` y `signalConnections` internas a su definición. Cada materialización asigna IDs independientes y remapea ambos extremos. Aplicar actualiza el recurso y la revisión; revertir regenera hijos y conexiones internas. Los enlaces hacia nodos externos perdidos durante reconstrucción se conservan como autoría inactiva para diagnóstico, nunca se redirigen arbitrariamente.
3. Al eliminar nodos se retiran los enlaces afectados del estado editable; Undo/Redo ya captura y restaura `signalConnections` junto con `objects`. Los enlaces de un Prefab siguen en la definición, independientemente del historial de una escena.
4. `.lfproj` serializa cada Prefab con conexiones internas además de nodos, sin romper la carga de Prefabs antiguos (valor por defecto `[]`). Las escenas ya se serializaban en G002.
5. `.levelpackage` versión 1 conserva conexiones de escenas y Prefabs. Al importar a otro proyecto remapea IDs de nodos, referencias internas, parentId e IDs de conexión, sin alterar el origen. Si una conexión tiene un extremo no incluido en la definición, la importación se **rechaza explícitamente** antes de escribir datos; no se elimina silenciosamente. Se mantiene la validación de entradas y dependencias existente.
6. El Player LevelForge sigue serializando escenas con `signalConnections` mediante `writePackage()` y ejecutándolas por el puente de G002. No depende del Inspector.
7. Godot export mantiene el bloqueo explicable para conexiones sin equivalencia funcional; las exportaciones multiescena comprueban **todas** las escenas antes de generar archivos.

No se ejecuta JS del usuario durante Edit Mode, no se introduce loop por frame y no se implementa traductor JavaScript→GDScript.

## Criterio de aceptación

Pruebas Node G004, regresiones anteriores (incluidas fixtures de portapapeles y mallas vinculadas), compilación, Electron con Jolt WASM + Vue reales y QA local Editor/Player. La aprobación del usuario acredita QA local declarado, pero no sustituye pruebas técnicas no ejecutadas en este entorno. Conectar y desconectar no deben producir suscripciones huérfanas.

## Fronteras y limitaciones explícitas

- Las referencias externas a hijos de Prefabs reemplazados **no son remapeadas por heurísticas**. Si su identidad desaparece quedan inactivas, visibles para diagnóstico; requieren reconexión explícita.
- Importación `.levelpackage` de una escena o Prefab con enlaces a nodos ausentes se rechaza con error; no se importa parcialmente.
- El soporte Godot de señales personalizadas no está implementado. La exportación sigue bloqueada cuando las encuentra.
- La incidencia histórica NP-29 queda fuera de este Gate.

## Aprobación final de la integración S01–S06 (2026-11-01)

El usuario respondió «Aprobado» a la entrega de S06-G004. Según la regla de QA acordada para LevelForge, es evidencia suficiente de **QA LOCAL PASS declarado por el usuario** y de **APROBACIÓN funcional**. Los seis Sprints y G001–G004 quedan funcionalmente terminados, sin nuevos Gates planificados para esta secuencia.

**Limitación de cierre técnico:** la última evidencia automatizada disponible sigue siendo 238/238 Node PASS y `gen-docs --check` PASS; no hay evidencia de ejecución satisfactoria del runner Electron/Jolt/Vue ni de compilación Vite en el entorno implementador, pues carecía de dependencias. Estos resultados permanecen como NO VERIFICADOS, sin atribuir PASS ni exigir repetir al usuario el QA local ya aprobado. No se marca CERRADO técnico mientras falte una verificación obligatoria.

Ningún cambio de código de producción se realizó al registrar esta aprobación.

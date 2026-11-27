# CENTURY-EDITOR-SCRIPT-S01-G001 — Contrato de propiedades editables

**Autorización:** `Listo. CENTURY-EDITOR-SCRIPT-S01-G001-EDITABLE-DECORATORS-AND-INSPECTOR-PROPERTIES autoriza comenzar` (usuario, 2026-11-23).

## Alcance y autoridad

- La autoría permanece en `store.project.scripts`, la asociación ordenada en `scriptIds` y la edición en `Inspector.vue` y `ScriptEditor.vue`. `NodeScriptRuntime` sigue siendo el único responsable de las instancias. No se crea otro intérprete, inspector ni repositorio de scripts.
- `@editable`, `@header`, `@header_descripcion` y `@editable_descricption` son directivas editoriales, no decoradores JavaScript estándar. Se reconoce también `@editable_description` como alias ortográfico. Se conservan literalmente en el recurso; solo el código de ejecución se transforma.
- Sintaxis: cada directiva aparece en línea propia; `@header("Texto")`, `@header_descripcion("Texto")` y `@editable_descricption("Texto")` aceptan un texto literal. `@editable` antecede una declaración `let`, `const` o `var` de nivel superior con inicializador literal (número finito, cadena o booleano), una variable por declaración. Se permiten espacios y líneas en blanco entre directivas.
- Los encabezados y sus descripciones preceden al primer campo del grupo y son contenido visual; no generan datos de runtime. Los nombres de las variables son sus claves estables. La declaración preserva el valor por defecto y su tipo.
- Descubrimiento estático sin ejecutar código del autor. Los usos no soportados producen diagnóstico y no reciben falsas propiedades. Los decoradores en comentarios y cadenas no son autoría.
- Los valores del Inspector se guardan como `scriptProperties: { [scriptId]: { [variableName]: value } }` en cada nodo, manteniendo `scriptIds` como autoridad. Nunca se almacenan en el recurso global del script. Se conservan claves desconocidas para no perder datos al cambiar o quitar scripts. No hay migración obligatoria para escenas anteriores.
- La compilación del script para cada slot selecciona el valor editado cuando exista, si corresponde al tipo declarado, o el inicializador original en caso contrario. Los valores son accesibles desde los callbacks mediante el cierre JavaScript del script, antes de `_enter_tree` y `_ready`. Las ediciones en Play no se escriben automáticamente en el proyecto.
- Editar desde el Inspector registra historial y dirty mediante `updateObject`; clonado de nodos, escenas, Prefabs, exportación `.lfproj` y Player reutilizan los objetos y sus propiedades persistidas.
- La integración no modifica las APIs de `game`, `node`, Jolt, Timeline o la autoridad de Signals. El campo `scriptProperties` no es un `props` físico del nodo.

## Validación y criterio de cierre

Pruebas unitarias de sintaxis/diagnósticos/transformación/seguridad, runtime multinstancia y persistencia; regresión Multiscript, build Editor y Player cuando el entorno disponga de dependencias; QA visual en Electron por verificar y aprobación del usuario independiente de PASS automatizados. No afirmar cierre sin evidencia.

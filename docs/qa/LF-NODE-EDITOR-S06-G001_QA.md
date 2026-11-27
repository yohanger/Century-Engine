# LevelForge — LF-NODE-EDITOR-S06-G001 — QA

**Estado:** IMPLEMENTADO · QA AUTOMATIZADO PASS · QA VISUAL LOCAL NO VERIFICADO  
**Fecha:** 2026-10-28

## Resultados ejecutados

| Comprobación | Resultado | Alcance |
|---|---|---|
| `node --test scripts/test-node-editor-s06-g001.mjs` | **18 PASS, 0 FAIL, 0 SKIP** | Lote de reparenting ejercitado mediante función real extraída del componente; estado, scripts, Inspector y accesibilidad comprobados por contrato de código |
| `node --test` sobre 104 `scripts/test-*.mjs` (excluye `test-starcat.mjs` y `test-clouds.mjs`) | **2236 PASS, 0 FAIL, 19 SKIP** | Regresión amplia de editor, nodos, física, eventos, recursos y otras capacidades del proyecto |
| `node --check --input-type=module` sobre scripts setup de `SceneTree.vue`, `Inspector.vue`, `InspectorDock.vue` | **3 PASS** | Validación sintáctica de los bloques JavaScript de los componentes |
| `npm run build` | **BLOQUEADO** (`vite: not found`, código 127) | No existen `node_modules` en la copia recibida |
| Electron | **NO VERIFICADO** | Requiere entorno local con dependencias |
| Player exportado | **NO VERIFICADO** | Requiere compilación y QA local |
| Event Order Flow | **SIN MODIFICACIÓN** | 49 archivos protegidos comprobados byte a byte |

Los SKIP son comprobaciones opcionales sin dependencias de ejecución disponibles. La regresión automatizada no equivale a validación visual ni demuestra comportamiento completo de Electron.

## QA local solicitado

1. Aplicar CHANGE y ejecutar `node --test scripts/test-node-editor-s06-g001.mjs`, `npm run build` y `npm run electron`.
2. Crear `Node`, `Node3D`, un `RigidBody3D` y sus variantes `BoxShape3D`, `SphereShape3D`, `CapsuleShape3D`. Verificar la edición contextual de cada tipo en el Inspector.
3. Asociar un Script a Node3D. Confirmar el icono del árbol, abrir el editor desde el icono y comprobar que un recurso faltante no se crea por error.
4. Filtrar la jerarquía, seleccionar desde el viewport un nodo que el filtro ocultaba y comprobar que el árbol lo vuelve a mostrar con sus ancestros.
5. Con el foco en el árbol, probar Inicio/Fin, Flechas, Shift+Flechas, F2 y Escape tras buscar. Comprobar enfoque y selección desde el viewport y el Inspector.
6. Arrastrar dos nodos de una vez. Verificar una sola operación Undo y la restauración completa con Redo. Repetir hacia un padre inválido (CollisionShape bajo padre incompatible), sin cambios parciales.
7. Plegar Transform y Script en un Node3D, cambiar a RigidBody3D y volver: el Inspector debe preservar el contexto del tipo, no cerrar secciones inesperadas.
8. Reducir el ancho del Inspector hasta 280 px y comprobar campos Vec3, nombres, pestañas, selector de scripts, botones de prefab y datos de material. No deben quedar cortados.
9. Guardar, reabrir, Undo/Redo y comprobar que la escena, selección y referencias a scripts no se corrompen.
10. Comprobar que PlayMode y Player siguen ejecutando los scripts y eventos del proyecto como antes.

## Restricciones y pendientes

- No se ejecutó un navegador Electron ni se inspeccionó visualmente un build por falta de las dependencias del baseline.
- No se certificó rendimiento interactivo para jerarquías muy grandes: la virtualización existente se conservó y la búsqueda memoiza coincidencias por subárbol, pero la prueba visual con muchas filas queda pendiente.
- El contrato no introduce otro Inspector ni una fuente alternativa de recursos. Los eventos funcionales no se modificaron.

**Cierre:** pendiente de QA visual local y aprobación del usuario.

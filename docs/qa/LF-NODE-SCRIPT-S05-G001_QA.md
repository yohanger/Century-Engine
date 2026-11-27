# QA — LF-NODE-SCRIPT-S05-G001

**Fecha:** 2026-10-28  
**Entrada:** SOURCE_BASELINE S04 CORR-001 (932 archivos)
**Estado:** código implementado; automatizado PASS; build de Vite, Electron y Player reales NO VERIFICADOS.

## Pruebas ejecutadas

- `node --test scripts/test-node-script-s05-g001.mjs` → **24 PASS / 0 FAIL / 0 SKIP**.
- `node --test $(find scripts -maxdepth 1 -name 'test-*.mjs' ! -name 'test-starcat*' ! -name 'test-clouds*' | sort)` → **2218 PASS / 0 FAIL / 19 SKIP**; **103** archivos, incluidas pruebas S00–S04 y S05.
- Los SKIP corresponden a verificaciones opcionales del entorno, no a pruebas de interfaz o WASM ejecutadas.

## Cobertura específica

- Edit Mode desactivado; enter/ready deterministas; estado separado por instancia; paso de física fijo; stop, borrado y cambio de script.
- Script global no se ejecuta como Node; recursos inexistentes detectados.
- Errores síncronos, de compilación y promesas rechazadas quedan aislados.
- Acceso a padre e hijos; `get_node` relativo; callbacks opcionales; reinicio sin fugas.
- Referencia `scriptId` guardable en objeto; Global/Nodo en editor; asociación en Inspector.
- Misma estructura de PlayMode en Player; orden fixedUpdate→script→Jolt preservado.

## QA local pendiente

1. `npm run build` y `npm run electron` en el entorno local con dependencias instaladas.
2. Crear Node3D y un script de tipo Nodo desde Inspector; editar `_ready`/`_process` y confirmar que solo se ejecutan al jugar.
3. Asociar el mismo script a dos nodos y confirmar contadores independientes; probar campos `node` y API `game`.
4. Confirmar que un script global existente se ejecuta una sola vez y no como script adjunto.
5. Pausar, reanudar y avanzar manualmente; confirmar comportamiento de `_process` y `_physics_process`.
6. Eliminar nodo, cambiar de escena y detener Play; verificar `_exit_tree` una vez y ausencia de llamadas posteriores.
7. Probar error de sintaxis y error en callback: los demás nodos siguen funcionando y el error se informa.
8. Guardar y reabrir; verificar `scriptId`, modo de ejecución de recurso, Undo/Redo y selección.
9. Exportar un Player y comprobar el mismo comportamiento; verificar Event Order Flow y páginas/órdenes/señales intactos.

**No equivale a QA visual:** el test de fuente no prueba la compilación Vue/Vite. Tampoco hay evidencia de ejecución real de Jolt WASM en este entorno.

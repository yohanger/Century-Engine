# LF-ROAD-MATERIAL-S01-G001 — QA y evidencia

Fecha: 2026-10-29. Estado: IMPLEMENTADO; TEST AUTOMATIZADO PASS; COMPILADO NO VERIFICADO; QA LOCAL PENDIENTE; APROBACIÓN PENDIENTE; CIERRE NO.

## Ejecutado en el entorno de entrega

`node --test scripts/test-road-material-s01-g001.mjs scripts/test-editor-safety-s01-g001.mjs scripts/test-editor-safety-s01-g002.mjs scripts/test-vfx-editor-s03-g001.mjs scripts/test-vfx-simulation-s02-g001.mjs scripts/test-project-safe.mjs scripts/test-resource-history-corr-g001.mjs`

**89/89 PASS, 0 FAIL, 0 SKIPPED**. Archivo nuevo: 11 pruebas ROAD-01..ROAD-11. Históricas: 78. Estas pruebas utilizan la lógica real de generación de color y clave de geometría y dobles de Three.js, caché y exportador. No demuestran píxeles reales en WebGL ni ejecución de Godot.

Intento de dependencias: `npm ci --offline --ignore-scripts --no-audit --no-fund` → `ENOTCACHED zip-stream@4.1.1`. Build NO VERIFICADO, no se presenta como fallo de código.

## QA local obligatorio (proyecto de prueba)

1. Verificar `unzip -t` y comparar fuente local antes de extraer CHANGE.
2. `npm ci` (si hace falta), `node --test scripts/test-road-material-s01-g001.mjs`, `npm run build` y `npm run electron`.
3. Crear Carretera, importar textura clara y observar asfalto sin tinte oscuro; repetir seleccionando una textura ya existente.
4. Alternar **Aplicar tinte** y cambiar el color: verificar que OFF es blanco neutro y ON el color elegido.
5. Repetir con los cuatro slots, aceras activas y marcas de carril; variar rugosidad y repetición en metros sobre curvas y pendientes.
6. Pintar/reemplazar imagen de Assets: verificar actualización sin reiniciar. Cambiar de escena/proyecto y comprobar que no aparece la textura anterior.
7. Simular una referencia rota exclusivamente sobre un proyecto de prueba; debe mostrarse diagnóstico, sin cierre ni pérdida de escena.
8. Probar Undo/Redo, guardar y reabrir `.lfproj`; exportar/importar `.levelpackage`; ejecutar Editor y Player y comparar apariencia.
9. Exportar Godot con imagen válida; verificar que el material recibe el mismo tinte y textura. Confirmar que una referencia ausente cancela exportación con mensaje.
10. Repetir los cambios de textura varias veces y vigilar GPU/memoria y funcionamiento del modo PSX.

## Evidencia a devolver

Salida íntegra de tests, `npm run build`, comportamiento de Electron, capturas del viewport (imagen clara, tinte ON/OFF, curvas/acera), resultado de Player y Godot. Registrar cualquier diferencia o error antes de aprobar el cierre.

**No declarar CERRADO** sin esa evidencia y aprobación expresa del usuario.

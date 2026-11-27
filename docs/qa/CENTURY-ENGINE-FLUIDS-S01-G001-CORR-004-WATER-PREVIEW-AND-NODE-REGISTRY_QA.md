# QA — CORR-004 WATER PREVIEW / NODE REGISTRY

**Baseline:** CORR-003 SOURCE_BASELINE.  
**Estado:** implementado; tests focales PASS; compilación y QA de producto NO VERIFICADOS.

| Prueba | Resultado | Evidencia |
| --- | --- | --- |
| Regresión nueva (preview/registro/diagnóstico) | **7/7 PASS** | `node --test scripts/test-water-preview-node-registry-corr004.mjs` |
| Smoke del proyecto | **25/25 PASS** | `node scripts/qa-suite.mjs smoke` |
| Corrección + agua histórica | **13/13 PASS** | `node --test scripts/test-water-legacy-restoration.mjs scripts/test-water-preview-node-registry-corr004.mjs` |
| Sintaxis JS de tres fuentes y nuevo test | **PASS** | `node --check` |
| Compilación Vite | **NO VERIFICADO** | No existe instalación de dependencias (`node_modules/.bin/vite`) en el entorno de ejecución |
| Visual Electron/FilmMaker/Player | **NO VERIFICADO** | No se ejecutó una sesión interactiva |
| Advertencia CSP Electron | **FUERA DE ALCANCE** | Independiente de los errores de agua y registro |

## Seguimiento en QA local

Abrir y cerrar un proyecto desde el Hub, repetir cambios de escena sin Play, cargar escenas con `meshSubtract`, abrir FilmMaker, iniciar y salir de Play, comprobar `water` y `fluidcontainer3d` y validar el Player exportado. Ante un tipo no registrado, debe mostrarse el tipo e ID reales sin descartar los datos del proyecto.

**Aprobado:** NO. **Cerrado:** NO.

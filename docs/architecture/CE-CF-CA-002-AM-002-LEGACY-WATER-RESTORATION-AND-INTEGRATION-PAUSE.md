# CE-CF-CA-002-AM-002 — Restauración del agua original y pausa de integración

**Autoridad:** Amendment ratificado por el usuario; prevalece sobre los contratos anteriores exclusivamente respecto del sistema activo de agua.  
**Gate autorizado:** `CENTURY-ENGINE-FLUIDS-S01-G001-CORR-003-LEGACY-WATER-RESTORATION-AND-FLUIDS-INTEGRATION-PAUSE`.  
**Estado:** Implementación candidata a revisión; **NO APROBADO / NO CERRADO**.

## Decisión vinculante

- El agua original del motor (`water`, `fluidcontainer3d`, `WaterWorld` y consumidores asociados) vuelve a ser el sistema de agua activo. Su condición es **Deprecated**: utilizable y funcional, sin deshabilitación ni avisos intrusivos, y sin promesa de evolución como nuevo sistema de fluidos.
- La integración de la biblioteca independiente **Century Fluids queda EN PAUSA**. El código original de la biblioteca en `vendor/century-fluids/` se preserva intacto y deja de ser una dependencia de ejecución o compilación obligatoria de Century. El puente `src/engine/runtime/fluids/century-water.js` permanece como fuente inerte sin consumo desde Play/Jolt.
- No se crean ni migran nodos. Se reutilizan los tipos `water` y `fluidcontainer3d` con sus entradas y datos anteriores.
- No se restaura el sistema de agua mediante aproximaciones o reescrituras nuevas: la fuente verificable es el baseline histórico anterior al retiro.
- Se conservan los documentos de los contratos `CE-CF-CA-002`, AM-001 y `LF-WATER-LEGACY-RETIREMENT-CA-006`. Esta enmienda supersede únicamente sus restricciones incompatibles con la restauración; no elimina historia ni autoriza cambios ajenos.

## Procedencia acreditada

- Base de implementación: SOURCE_BASELINE de CORR-002, con el código y los contratos de la integración suspendida.
- Fuente original de agua: `LF_TOOLING_S00_G001_CORR001_NATIVE_ELECTRON_LAUNCH_AND_BUILD_VALIDATION_SOURCE_BASELINE.zip`, SHA-256 `5b33b197eadf808e6c7031430efa24a7c6137a9d08e6d67bd5d250fc451bd4a7`, anterior al retiro de agua.
- Se restauraron fuentes históricas de geometría, `WaterWorld`, puente Terrain, solvers, superficies, shaders, nodos y paneles de edición. Para consumidores modernos se utilizó una integración selectiva, sin sobrescribir indiscriminadamente sus avances posteriores.
- `package.json` y lockfile dejan de exigir `@century/fluids`; la carpeta `vendor/century-fluids/` permanece preservada.

## Límites

No se incorporan mejoras físicas a Century Fluids ni nuevas funciones de agua. Se preservan las propiedades almacenadas de escenas, las APIs de scripts y el exportador obsoleto Godot donde la fuente histórica las proporcionaba. No se hacen migraciones obligatorias.

## Criterio de aceptación

El resultado requiere compilación del Editor, Runtime y prueba visual/interactiva en Electron y Player de `water`, `fluidcontainer3d`, Terrain, guardado/carga y regresiones físicas. Las pruebas estáticas y de sintaxis no equivalen a QA de producto. El usuario conserva en exclusiva la aprobación y el cierre del Gate.

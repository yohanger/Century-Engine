# LF-WEATHER-TORNADO-TRANSITIONS-S02-G001 — Implementación y estado

**Autorización:** literal `Listo. LF-WEATHER-TORNADO-TRANSITIONS-S02-G001 autoriza comenzar` emitida en el historial del 30/10/2026. **Base:** `LevelForge_VFX_INSPECTOR_S01_G001_SOURCE_BASELINE.zip`, entregada como `...(1).zip` en esta conversación, 1.245 archivos de entrada e integridad ZIP/CRC correcta.

## Diagnóstico previo

- **OBSERVADO:** S12 instanciaba un tornado activo al reset de World; para dibujarlo exigía vincular un nodo VFX3D con `.vfx.movement.tornadoFlow=true`. El Inspector S01 ya había ocultado ese campo, pero seguía persistido para compatibilidad.
- **CAUSA ARQUITECTÓNICA DEMOSTRADA:** el recurso visual cargaba una decisión meteorológica que pertenece a World; faltaban fases y representación visual automática.
- **PRERREQUISITO NO VERIFICADO:** incidencia `LF-RUNTIME-JOLT-PLAY-START-CORR-G001`: la corrección de ShapeSettings no cuenta todavía con runner Jolt WASM real PASS. No se atribuye al tornado la falta de dependencias locales.

## Cambios limitados al Gate

1. `world/{params.js,world.js,api.js}`: Inspector de permiso, modo automático/script, probabilidad, tiempos, ciclo por fases, parametrización validada y API `game.weather`.
2. `vfx/{resource.js,simulation.js}`: desvinculación del esquema visual, migración explícita de dato antiguo y advección externa de partículas genéricas.
3. `nodes/vfx.js` y `events/play-tornado.js`: representación temporal con renderer/simulación existentes, opción de VFX3D personalizado en Espacio Mundo, emisión condicionada, recuperación del estado tras Play/Stop y eventos existentes.
4. `events/{play-tornado-destruction.js,play-saves.js,play-controls.js}`: ajustes de agua suspendida, persistencia y salto de Film Maker sin introducir otros simuladores.
5. Amendments `LF-VFX-WEATHER-DECOUPLING-CA-001` y `LF-WEATHER-TORNADO-LIFECYCLE-CA-001`. Los documentos S12/S12A originales permanecen en el historial; prevalecen estas cláusulas solo donde expresamente las sustituyen.
6. Prueba nueva `scripts/test-weather-tornado-transitions-s02-g001.mjs` y adaptación de expectativas supersedidas en `scripts/test-weather-tornado-world-s12-g001.mjs` y `scripts/test-vfx-inspector-s01-g001.mjs`.

## Alcance y evidencia

**IMPLEMENTADO (fuente), sujeto a QA de integración.** El runner Node cubre lógica meteorológica, migración y comprobaciones de integración estática/mocks, no prueba el render WebGL ni la física Jolt WASM real. Los resultados numéricos deben leerse en la hoja `EVIDENCE` y `docs/qa/LF-WEATHER-TORNADO-TRANSITIONS-S02-G001_QA.md`.

**COMPILADO:** NO VERIFICADO (dependencias npm no incluidas en baseline). **JOLT WASM REAL:** NO VERIFICADO (`ERR_MODULE_NOT_FOUND: three`, antes de ejecutar JW-04). **QA LOCAL EDITOR/PLAYER:** PENDIENTE. **APROBADO POR USUARIO / CERRADO:** PENDIENTE. **S13:** BLOQUEADO por Jolt.

## Exclusiones

No corregir CSP, `PCFSoftShadowMap`, distribución Linux/Windows, Shader Graph, HUD, HUB ni refactorizar Jolt dentro de S02. No crear un sistema meteorológico nuevo ni reconstruir LevelForge.

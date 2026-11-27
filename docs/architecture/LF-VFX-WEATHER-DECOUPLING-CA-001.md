# LF-VFX-WEATHER-DECOUPLING-CA-001 — Separación de VFX y meteorología

**Estado:** Amendment incluido en la intervención autorizada `LF-WEATHER-TORNADO-TRANSITIONS-S02-G001`. **QA de integración local pendiente.**

**Parent vinculantes:** `LF-VFX-S00-G001_CONTRACT`, `LF-VFX-INSPECTOR-CA-001`, S12 Tornado World, S12A Tornado Destructive, S11 Lightning, NODE y Player. Esta modificación sustituye únicamente los requisitos de esos contratos que obligaban al recurso `.vfx` a declarar `movement.tornadoFlow`, a construir varios emisores manualmente o a carecer de una representación predeterminada.

## Cláusulas vinculantes

1. El recurso `.vfx` expresa emisión, nacimiento, movimiento **genérico**, aspecto, texturas y curvas. Queda prohibido persistir conceptos de clima, tornado, agua levantada, incendio y destrucción en su esquema.
2. La autoridad meteorológica es `World`. El consumidor VFX recibe desde el runtime el campo `tornadoWindAt(x,y,z)` mediante `VfxSimulation.flowAt`; solo se aplica a recursos `movement.space='world'`. `flowAt` es una entrada temporal no serializada.
3. `VFX3D` permanece como tipo de nodo y mantiene su simulación propia. El recurso compartido se selecciona desde el Inspector vigente; no se recrea una ventana VFX ni se abre un segundo editor.
4. Si `tornadoVfxNodeId` está vacío, Weather crea durante Play una representación transitoria utilizando **las clases existentes** `VfxSimulation`/`VfxBillboardRenderer` y el viewport existente. La representación se destruye en Stop y no se añade al proyecto ni a Assets. Si se asigna VFX3D, se consume su `.vfx` genérico en Espacio Mundo, y su emisión depende de la fase meteorológica. El Transform y los indicadores temporales se restauran al salir de Play.
5. `migrateLegacyVfxResource(raw)` acepta documentos heredados con `movement.tornadoFlow` booleano y compatible con espacio mundo. Elimina el campo en una **copia**, devuelve `migrated` y `warnings`, sin mutar el original. Valores inválidos o un campo `true` con espacio local se rechazan explícitamente. `validateVfxResource`, importación y serialización del proyecto usan el documento normalizado; los recursos no deben perder id, nombre, curvas, textura ni referencias.
6. El agua suspendida puede seguir enlazada a un nodo VFX3D opcional, pero su advección procede de World y **no** de una bandera en `.vfx`. La simulación de agua, combustible y física sigue en sus dueños existentes.

## Compatibilidad y exclusiones

- Las cláusulas S12/S12A que exigían `movement.tornadoFlow=true` quedan **SUPERSEDIDAS** por este Amendment, sin alterar el resto de esos contratos.
- No se convierte el recurso VFX en un sistema meteorológico, no se crean presets persistentes de tornado, no se introducen otros renderers ni nuevas jerarquías de nodos.
- En proyectos heredados, guardar mediante los validadores existentes serializa el esquema migrado; la migración no es una garantía de que todo proyecto pueda ejecutar Play con Jolt hasta realizar QA nativo.
- Evidencia inicial de código: `src/engine/runtime/vfx/{resource.js,simulation.js}`, `src/engine/runtime/nodes/vfx.js`, `src/engine/runtime/events/{play-tornado.js,play-tornado-destruction.js}`. Evidencia de prueba: `WT-11–WT-16` y regresiones S12, VI-18. **Visual Editor/Player: NO VERIFICADO.**

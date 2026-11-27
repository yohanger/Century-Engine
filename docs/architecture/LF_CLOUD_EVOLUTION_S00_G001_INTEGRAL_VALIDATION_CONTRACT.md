# LF-CLOUD-EVOLUTION-S00-G001-INTEGRAL-VALIDATION — Contrato y alcance

**Estado:** autorizado literalmente el 17-11-2026; pruebas de caracterización implementadas; QA GPU y local pendiente; no aprobado ni cerrado.
**Autorización:** `Listo. LF-CLOUD-EVOLUTION-S00-G001-INTEGRAL-VALIDATION autoriza comenzar`
**SOURCE_BASELINE de entrada:** `LF_VOLUMETRIC_CLOUDS_S01_G001_CORR003_NATURAL_SCALE_CALIBRATION_SOURCE_BASELINE.zip` (SHA-256 `3cad7c78c0b9ec9d0df55f7fa4b1ee79f991f5852684966646e6473076dd9df3`).

## Objetivo

Recoger evidencia reproducible que permita cerrar el diseño técnico de evolución atmosférica inspirado en Nubis/Decima, antes de implementar cambios de World/CloudField/CloudVolume/Sky. Caracterizar específicamente **pérdida de morfología en GPU, recentrado cercano/distante, guardado durante transición meteorológica, Edit Mode y consumidores liveFx**.

## Mecanismo, alcance y autoridad

- **Modo de trabajo:** QA y pruebas. Se extienden la fixture de convección existente y sus runners; se agregan pruebas Node de caracterización y documentación. Ninguna función de producción debe modificarse.
- **Autoridad existente:** World controla clima y eventos; CloudField mantiene distribución de celdas; CloudVolume almacena condensado/vapor; Sky consume volumen. Se conservan contratos y Amendments meteorológicos vigentes, sin adjudicar a QA autoridad para cambiarlos.
- **Consumidores inspeccionados:** `world.js`, `cloudfield.js`, `cloudfield-bake.js`, `cloud-volume.js`, `sky-cloud-volume.js`, `scene-graph.js`, `scene/environment.js`, `viewport.js`, `play-saves.js`; pruebas y fixture WebGL existentes.
- **Fuera de alcance:** algoritmo nuevo, cambios de formatos GPU o persistencia, modificar el comportamiento editorial, refactors, eliminar la ruta `classic`, añadir un renderizador, cambiar el Inspector, alterar escena o proyecto, dependencias, GitHub o `package.json`.

## Prerrequisitos y medios

- Baseline CORR-003 íntegro y QA histórico preservado.
- Node `--test` para las pruebas deterministas; `qa-electron-webgl-runner.mjs` y `cloud-convection.html` para WebGL 2; requiere Vite y Electron instalados en entorno QA.
- Para aprobación visual, ejecutar realmente Electron embebido en la plataforma destino, comparar imágenes y tiempos de cuadro, y comprobar Runtime/Player.
- Los scripts nuevos no forman parte del runtime y no modifican datos de proyecto al ejecutar las pruebas.

## Evidencia y criterios

- **G001-01…09:** datos de la textura 3D, pérdida de etiqueta, recentrado de 200 m, salto de 20 km, snapshot interpolado, transición de Weather, `clock:false` del Editor, consumidores `liveFx`, fixture histórica.
- **WebGL:** fixture conservada y ampliada de 9 a 12 checks con lectura de píxeles desde suelo/aire, condensación/evaporación, datos de textura, equivalencia morfológica de fuentes y recentrado distante. La compilación/enlace GL requiere Electron real.
- **Regresiones:** comparar con el baseline anterior, registrar íntegramente fallos históricos sin atribuirlos a G001.
- **Trazabilidad:** `docs/qa/LF_CLOUD_EVOLUTION_S00_G001_INTEGRAL_VALIDATION_QA.md`, logs bajo `docs/qa/evidence/lf-cloud-evolution-s00-g001/` y ledger de seis hojas.

## Contradicciones y decisiones pendientes

1. `liveFx` anima Weather fuera de PlayMode, mientras la decisión funcional posterior requiere meteorología estática en Edit Mode. **NO MODIFICAR** este comportamiento bajo G001: resolver precedencia con contrato/Amendment cuando proceda y preservar otras previsualizaciones.
2. La morfología se reduce a un tipo promedio en el mapa 2D y se pierde como etiqueta explícita en la transferencia de fuentes al volumen 3D. No se ha medido cuánto afecta visualmente en GPU; no seleccionar todavía formato nuevo.
3. Recentrar fuera del volumen anterior crea densidad inicial nula, sin garantizar continuidad visual tras teletransporte. La estrategia de residencia/reconstrucción debe decidirse después de medir cámara rápida, memoria y posibles artefactos.
4. Los snapshots actuales recuperan condensado, pero no registran explícitamente `_fade`/los acumuladores completos del Director. No se añade estado de compatibilidad o migración sin justificación.

## Siguiente acción

QA local con Electron WebGL2, captura de frames de convección y teletransporte, paridad Runtime y presupuesto N5030/4 GB. Reconciliar las contradicciones con autoridad aprobada. Luego ratificar diseño técnico; **ningún Gate de implementación queda autorizado aquí**.

## Adenda de continuidad — evidencia posterior a la entrega (17-11-2026)

Sin modificar ni sustituir el estado de evidencia original de este contrato, el usuario ejecutó posteriormente los runners del G001 en su máquina y **aprobó expresamente** el Gate. El log local de continuidad está preservado en `docs/qa/evidence/lf-cloud-evolution-s00-g002/g001-local-user-2026-11-17.log` y documenta **9/9 Node PASS, 12/12 WebGL2 en Electron PASS, cero errores GLSL/WebGL en la fixture y compilación Vite PASS (933 módulos)**. El usuario informó que el Editor arrancó sin errores observables. Son resultados **G001**, no demostración de un nuevo algoritmo. El QA de Player exportado, rendimiento sostenido y evolución visual futura sigue NO VERIFICADO. Estado histórico actualizado: **APROBADO POR USUARIO · CIERRE FORMAL/QA PLAYER PENDIENTE**.

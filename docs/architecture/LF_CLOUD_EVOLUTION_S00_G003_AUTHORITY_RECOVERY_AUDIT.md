# G003 — Auditoría de recuperación de autoridad y reconciliación

**Gate autorizado:** `LF-CLOUD-EVOLUTION-S00-G003-AUTHORITY-RECOVERY-AND-CONTRACT-RECONCILIATION` — 2026-11-17.  
**Tipo:** exclusivamente documental. **Estado:** TRABAJO DOCUMENTAL EJECUTADO; RATIFICACIÓN BLOQUEADA POR FUENTE ÍNTEGRA NO DISPONIBLE.  
**Base verificada:** `LF_CLOUD_EVOLUTION_S00_G002_ALGORITHM_DESIGN_AND_AUTHORITY_CONTRACT_SOURCE_BASELINE.zip` (SHA-256 `9005ac012e391160fcdef752c63a82281611d2445ba9f23e97d440b292e39298`).  
**No se ha aportado una modificación local posterior a G002 para comparación.** G002 sigue pendiente de aprobación expresa.

## 1. Objeto, método y límites del Gate

**OBJETIVO:** identificar y reconciliar autoridades de evolución de nubes; preservar World y el primer salto funcional del motor; no reconstruir un contrato perdido ni inventar su texto.  
**MECANISMO:** inventario por ZIP, documentos fuente y repositorio accesible, cotejo cláusula a cláusula donde existe texto, contraste del código y clasificación de contradicciones.  
**PRERREQUISITOS:** G002 SOURCE_BASELINE, G001 aprobado y QA aportado por usuario, Amendments anteriores, conexión de lectura GitHub.  
**ALCANCE:** World/Weather, CloudField, CloudVolume, Sky, tornado madre, iluminación, precipitación, Editor, Player, Inspector, persistencia y QA.  
**MEDIOS:** lectura de archivos Markdown, revisión selectiva del árbol actual, índice de ZIP y repositorio; sin alterar código o ejecutar cambios productivos.  
**EVIDENCIA:** matriz G003, fuentes y hashes, borrador de Amendment reconciliado, addendum G002, matriz de QA, comparación de paquetes.  
**CONTRADICCIONES:** documento P07 sin texto íntegro, G002 sin ratificar, `liveFx` vs Edit Mode y `cloudModel` público.  
**SIGUIENTE ACCIÓN:** recuperar el original auténtico de P07 o tramitar expresamente una nueva autoridad que resuelva su ausencia; someter G002 y propuesta de Amendment a ratificación. No declarar implementación.

## 2. Resultado de recuperación: P07

**Identificador:** `LF-VOLUMETRIC-CLOUDS-REPLACEMENT-CA-001`. Su **ratificación por el usuario el 2026-11-15 está acreditada por continuidad conversacional**, no por un archivo firmado/entregado. La decisión histórica conocida abarca reemplazar la visualización de nubes previa por un único renderizador volumétrico, conservar la autoridad World y las integraciones del cielo y la nube madre/tornado. **Esto es un resumen de decisiones conocidas, NO texto original recuperado.**

### Búsqueda con procedencia

- Se inspeccionaron **los nombres de entradas** de todos los ZIP actualmente materializados en `/mnt/data` (16 archivos ZIP en el inventario local). Ninguno incluye un archivo cuyo nombre coincida con el Amendment P07. El registro de comandos/resultado está en `SEARCH_PROVENANCE.md`. El G002 SOURCE_BASELINE tiene 3.556 entradas.
- Se inspeccionaron íntegramente los documentos `LF-WEATHER-UNIFICATION-CLOUD-TORNADO-CA-001.md`, `LF-WEATHER-TORNADO-LIFECYCLE-CA-001.md` y `LF-VFX-WEATHER-DECOUPLING-CA-001.md` del SOURCE_BASELINE, además del G002 y su borrador. El documento P07 no figura en el inventario contractual de la versión recibida.
- Se consultó la ruta esperada `docs/architecture/LF-VOLUMETRIC-CLOUDS-REPLACEMENT-CA-001.md` y su variante con guiones bajos en el repositorio accesible `yohanger/Narrative-Game-Make-Engine`. Ambas devolvieron **NOT_FOUND**. Esto no prueba ausencia en todos los commits o ramas.
- Se localizó en la Library un par de paquetes históricos anteriores a la sustitución volumétrica y se intentó obtener sus bytes. La operación fue denegada: **no existe ruta de materialización autorizada**. Por ello **NO SE AFIRMA** que sus contenidos fueran inspeccionados. La búsqueda histórica no puede declararse exhaustiva.
- La recuperación de contexto de la ratificación del 15-11-2026 solo confirmó la decisión aprobada y no halló anexo, ruta de entrega ni documento original íntegro.

**Conclusión P07:** RECUPERACIÓN PARCIAL (ratificación y dirección conocidas) / TEXTO ÍNTEGRO **NO RECUPERADO**. **BLOQUEO** del cotejo literal y de toda supersesión que dependa de cláusulas desconocidas de P07.

## 3. Documentos íntegros reconciliados

**Weather/Tornado CA-001:** cl. 1 World conserva autoridad del tornado; cl. 2 Sky/CloudField dibujan nube/embudo en el shader compartido; cl. 4 sustituye **solo** la cláusula 4 del anterior VFX Weather-Decoupling para tornado visual; cl. 5 normaliza `tornadoVfxNodeId` sin borrar nodos o Assets; cl. 6-8 preservan Play/Stop, efectos y presupuesto de intersección. La oclusión respecto a geometría 3D sigue NO VERIFICADA.

**Weather/Tornado Lifecycle CA-001:** World mantiene las fases del tornado, viento y eventos y gobierna fuerzas; no debe crearse una nueva secuencia meteorológica propietaria en Sky, CloudVolume ni VFX.

**VFX Weather-Decoupling CA-001:** el recurso `.vfx` y VFX3D siguen genéricos. Su antigua cl. 4 queda supersedida únicamente en el ámbito exacto del tornado visual, según Weather/Tornado CA-001.

**G001:** QA Node 9/9 y Electron WebGL2 12/12 más compilación Vite PASS documentados por ejecución local del usuario; no avalan el futuro algoritmo ni el Player exportado.

**G002:** propuesta arquitectónica con propietarios e interfaces; no consta aprobación explícita del usuario ni ratificación de su borrador de Amendment. Mantener su carácter propuesto, sin elevarlo a fuente superior.

## 4. Contradicciones y resolución que procede

| ID | Observado | Choque | Resultado G003 |
|---|---|---|---|
| C-01 | `scene-graph.js:215` avanza World en Edit si `liveFx` | Decisión posterior: clima estático en Edit | Propuesta CA-01/02 sujeta a ratificación; preservar otros FX |
| C-02 | `params.js:23,47,127,269` mantiene `classic/cells` y default `classic` | UX solicitada: formación automática sin selector de formas | Propuesta CA-03/04, NO eliminar API ni persistencia hasta auditoría de consumidores |
| C-03 | G002 diseña RG8 como ruta inicial | Calidad morfológica plena no acreditada | Decisión condicionada A/B, no obligación irreversible |
| C-04 | G001 registró vacío de condensado tras 20 km | Necesidad de cielo estable ante salto lejano | Garantía funcional en propuesta; estrategia técnica pendiente QA |
| C-05 | Weather/Tornado CA reconoce oclusión no acreditada | Realismo visual integral exige profundidad | QA futuro obligatorio; sin falsa garantía |
| C-06 | P07 ratificado sin texto íntegro | Imposible cotejar supersesión exacta | **BLOQUEAR ratificación/sustitución relativa a P07** |

## 5. Resolución documental de alcance limitado

1. **Sin nuevas supersesiones ratificadas.** Se conserva la sustitución explícita y documentada Weather/Tornado → VFX cl. 4 solo para embudo visual.
2. Se adjunta una **propuesta reconciliada** que incorpora la preservación de autoridad World, el estado G002 y la decisión del usuario sobre Edit Mode sin fingir que existe aprobación.
3. Se mantiene `LF_CLOUD_EVOLUTION_S00_G002_ALGORITHM_DESIGN_AND_AUTHORITY_CONTRACT.md` **íntegro**; la precisión de autoridad está en una **adenda G003 independiente**, no en una reescritura retrospectiva.
4. La primera generación volumétrica actual y sus APIs siguen intactas. Pre-1.0 no permite borrar archivos reales de usuario ni crear obligaciones de migración sin evidencia.
5. **El futuro Gate de implementación permanece NO AUTORIZADO y condicionado.** No basta con aprobar la entrega documental G003 para ratificar el Amendment o aprobar G002 automáticamente.

## 6. Alcance de QA y cierre

Este Gate es DOCUMENTAL. La integridad del cambio y la igualdad binaria de las rutas productivas se verifican con SHA-256 y comparación de ZIP; las pruebas Node/GPU aportadas previamente son de G001/G002 y no se reclasifican como QA propio de G003. Los 6 registros del ledger conservan la historia.

**RESULTADO:** inventario y reconciliación de cláusulas disponibles completos; texto de P07 no recuperado. G003 queda ENTREGABLE/QA DOCUMENTAL pendiente de aceptación, y **bloqueado específicamente para declarar ratificada la autoridad definitiva**.

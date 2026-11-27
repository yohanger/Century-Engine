# G003 — Matriz de precedencia y cláusulas

**Gate:** `LF-CLOUD-EVOLUTION-S00-G003-AUTHORITY-RECOVERY-AND-CONTRACT-RECONCILIATION`. **Estado:** AUDITORÍA DOCUMENTAL; no ratificación ni cambio de producción.

La tabla distingue **autoridad documental**, **ratificación histórica conocida**, **evidencia de código** y **propuestas**. Solo el documento íntegro permite cotejar una cláusula literal.

| ID | Documento / fuente | Cláusula o línea | Categoría | Contenido acreditado / estado | Tratamiento | Reserva |
|---|---|---|---|---|---|---|
| P01 | LF-WEATHER-UNIFICATION-CLOUD-TORNADO-CA-001.md | cl. 1 | RATIFICADO EN FUENTE | World único para estado/fases/viento/eventos del tornado | PRESERVAR | Sin contradicción verificada |
| P02 | LF-WEATHER-UNIFICATION-CLOUD-TORNADO-CA-001.md | cl. 2-3 | RATIFICADO EN FUENTE | CloudField/Sky condensación del embudo con SKY_FRAG existente; sin VFX meteorológico paralelo | PRESERVAR | Nuevo algoritmo no reemplaza nube madre ni estado World |
| P03 | LF-WEATHER-UNIFICATION-CLOUD-TORNADO-CA-001.md | cl. 4-5 | RATIFICADO EN FUENTE | SUPERSEDE cláusula 4 VFX Weather solo para tornado visual; normalización no destructiva | PRESERVAR supersesión ya documentada | No ampliar a VFX general |
| P04 | LF-WEATHER-UNIFICATION-CLOUD-TORNADO-CA-001.md | cl. 6-8 + limitaciones | RATIFICADO EN FUENTE | Limpieza del embudo/Play/Stop; Jolt y efectos conservados; oclusión no acreditada | PRESERVAR | QA profundidad, GPU, Player y FPS pendiente |
| P05 | LF-WEATHER-TORNADO-LIFECYCLE-CA-001.md | fases/World/API | DOCUMENTO CONTRACTUAL | Fases de tornado, evento y fuerzas de World; simulación meteorológica no predictiva | PRESERVAR | Futura evolución no cambia el ciclo de vida |
| P06 | LF-VFX-WEATHER-DECOUPLING-CA-001.md | cl. 1-3, 5+ | DOCUMENTO CONTRACTUAL | VFX3D genérico, recurso .vfx, flowAt y normalización | PRESERVAR solo en lo compatible | Cláusula 4 ya limitada por P03 |
| P07 | LF-VOLUMETRIC-CLOUDS-REPLACEMENT-CA-001 | INSTRUMENTO ÍNTEGRO NO RECUPERADO | RATIFICACIÓN HISTÓRICA CONOCIDA | Decisión de adoptar un único nuevo renderizador volumétrico, World autoridad y conservar integración, según historial; sin texto exacto | BLOQUEADO PARA COTEJO LITERAL | No reconstruir ni declarar supersesiones adicionales |
| P08 | LF_CLOUD_EVOLUTION_S00_G001_INTEGRAL_VALIDATION_CONTRACT.md | G001 y QA posterior | GATE APROBADO | 9/9 Node, 12/12 Electron WebGL2, Vite PASS por log local | EVIDENCIA VIGENTE | No certifica algoritmo nuevo ni QA Player |
| P09 | LF_CLOUD_EVOLUTION_S00_G002_ALGORITHM_DESIGN_AND_AUTHORITY_CONTRACT.md | A-01 a A-08 | PROPUESTA ENTREGADA | Owners World/CloudField/CloudVolume/Sky y no duplicación | COMPATIBLE, SIN RATIFICAR | G002 no aprobado expresamente |
| P10 | LF_CLOUD_EVOLUTION_S00_G002_ALGORITHM_DESIGN_AND_AUTHORITY_CONTRACT.md | D03/D04/GPU/Residencia | DISEÑO CONDICIONADO | RG8 y regeneración distante candidatos sujetos a comparación A/B y coste | NO CONVERTIR EN DECISIÓN IRREVOCABLE | QA de Player/continuidad/rendimiento nuevo pendiente |
| P11 | LF_CLOUD_EVOLUTION_CA_001_EDITOR_AND_CLOUD_MODEL_DRAFT.md | CA-01/CA-02 | BORRADOR NO RATIFICADO | Edit Mode estático; separar liveFx de avance meteorológico | REQUIERE RATIFICACIÓN | Código editorial actual avanza condensado |
| P12 | LF_CLOUD_EVOLUTION_CA_001_EDITOR_AND_CLOUD_MODEL_DRAFT.md | CA-03/CA-04 | BORRADOR NO RATIFICADO | Morfología emergente y revisión UX classic/cells | REQUIERE RATIFICACIÓN | cloudModel público y default classic |
| P13 | LF_CLOUD_EVOLUTION_CA_001_EDITOR_AND_CLOUD_MODEL_DRAFT.md | CA-05 a CA-07 | BORRADOR NO RATIFICADO | Conservar consumidores, APIs, clima y pruebas integrales | COMPATIBLE PROPUESTO | No sustituye CA original faltante |
| P14 | src/engine/runtime/world/params.js | L23,L47,L127-L130,L269 | CÓDIGO OBSERVADO | CLOUD_MODELS classic/cells; default classic; selector tipo de nubes | EVIDENCIA DE ESTADO | No significa obligación histórica aprobada |
| P15 | src/engine/runtime/scene-graph.js | L215 | CÓDIGO OBSERVADO | world.update(dt,{clock:false}) cuando liveFx y weatherOn fuera de Play | CONFLICTO DESEADO/REAL | Cambiar requiere Amendment/editor QA |
| P16 | src/engine/runtime/world/world.js | L119, L355-L402 | CÓDIGO OBSERVADO | campo cells condicionado; _fade y _cloudStep reciben dt | EVIDENCIA DE ESTADO | No presupone reloj unificado |
| P17 | src/engine/runtime/render/viewport-env.js | L178-L200 | CÓDIGO OBSERVADO | textura volumétrica y blend reciben estado del volumen | PRESERVAR OWNERSHIP | No introducir buffers adicionales por defecto |
| P18 | src/engine/runtime/world/cloud-volume.js | L32-L73 | CÓDIGO OBSERVADO | volumen persistente y _recenter | PRESERVAR | Teletransporte GPU pendiente |

## Orden de precedencia aplicado
1. Ratificaciones y Amendments vigentes con cláusulas verificables. La ratificación histórica P07 **existe**, pero no proporciona texto íntegro para cotejo literal.
2. Contratos aprobados compatibles y decisiones explícitas posteriores del usuario; los cambios contradictorios se elevan a Amendment, nunca se dan por automáticamente implementados.
3. Contrato G002 propuesto, sin autoridad sustitutiva mientras no se apruebe.
4. Código observado: evidencia de lo que existe, no autorización para cambiar lo aprobado.
5. QA: evidencia de resultados específicos, no aprobación global del algoritmo.
6. Ledger: registro, no fuente autónoma de nueva autoridad.

## Supersesiones permitidas y prohibidas
- **Única supersesión literal verificada en este alcance:** P03 (Weather/Tornado CA sobre VFX Weather Decoupling cl. 4, limitada al tornado visual).
- **No verificada / prohibido declarar:** cualquier cláusula concreta de P07, el retiro definitivo de `cloudModel`, la supresión general de previsualizaciones `liveFx`, una nueva autoridad meteorológica, y una capacidad de Player/oclusión no probada.
- **Borrador G002:** CA-01…CA-07 siguen sin ratificar. La intención explícita de Edit Mode estático no modifica por sí sola el código ni clausulados anteriores desconocidos.

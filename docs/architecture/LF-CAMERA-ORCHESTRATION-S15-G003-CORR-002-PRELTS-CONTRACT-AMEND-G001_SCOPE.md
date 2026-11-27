# LevelForge — S15-G003 CORR-002 · Alcance documental pre-LTS y continuación bloqueada

**Gate documental autorizado:** `LF-CAMERA-ORCHESTRATION-S15-G003-CORR-002-PRELTS-CONTRACT-AMEND-G001`  
**Documento de propuesta:** `LF-NODE-ACTIVE-VISIBLE-PRELTS-CA-001_AMENDMENT.md`  
**Estado:** IMPLEMENTACIÓN DOCUMENTAL EFECTUADA; CA-001 PENDIENTE DE RATIFICACIÓN, QA FUNCIONAL NO EJECUTADO.

## Estado anterior a la interrupción

El usuario autorizó `LF-CAMERA-ORCHESTRATION-S15-G003-EVENT-CAMERA-CONSUMER_CORR-002-INTEGRAL` para separación de `active` / `visible`, pero lo detuvo cuando se intentó prever migración `visible`→`active` de versiones anteriores. El Gate **no está aprobado, ni cerrado** y su trabajo parcial es NO VERIFICADO.

Se localizaron **19 rutas de producción cambiadas en una carpeta de trabajo interrumpida**, frente al último SOURCE_BASELINE G003 CORR-001. Ese conjunto es evidencia de trabajo provisional y no una entrega ni una base válida. No se copia en este Gate documental, no se borra y no sirve de fundamento para declarar implementación.

## Contrato técnico corregido — propuesta condicionada a ratificación

1. El modelo **vigente** distingue `active` y `visible`. La casilla azul de cabecera controla `active` y la visibilidad del contenido no gobierna Jolt ni procesamiento de scripts.
2. `active=false` excluye render propio, procesamiento ordinario y física aplicable; `visible=false` excluye render propio sin suspender trabajo funcional.
3. Los descendientes respetan estados efectivos sin mutar sus valores locales. Los ciclos de vida de audio, eventos, Camera3D, Terrain y Jolt requieren validación específica.
4. La API de NodeHandle debe leer/escribir los estados lógicos; conservar semánticas y tipos de Scene Tree, Inspector, Play Mode y runtime exportado.
5. Persistencia y Prefabs de la versión **actual** deben guardar/reabrir correctamente; no añadir conversor histórico ni reintérprete de `visible` como `active`.
6. Contrastar código aprobado, contratos de Node S00 y Camera S15, código parcial y ledger antes de cualquier cambio. Evitar gestores paralelos, loops duplicados, otras reformas y pérdida de contenido actual.

Estas reglas **no son autorización para reanudar código**. Si CA-001 se ratifica, la antigua declaración técnica con migraciones/QA históricos queda SUPERSEDIDA en esa dimensión y se deberá definir y autorizar literalmente el Gate de continuación revisado. En caso de contradicciones adicionales, BLOQUEAR el punto afectado y solicitar Amendment específico.

## Evidencia exigida al futuro Gate técnico

- Pruebas sobre nodos actuales para los cuatro pares `active`/`visible` y propagación padre/hijo.
- Medición o trazas justificadas de ausencia de render propio y de procesamiento ordinario; no afirmar ganancia FPS sin benchmark.
- Regresiones de Jolt (creación, suspensión, reactivación), Terrain, Camera3D, scripts, señales/eventos, audio, VFX, Timeline, Inspector y Prefabs.
- Persistencia contemporánea, Node PASS, build Editor/runtime exportable, Electron embebido y QA local del usuario; ejecución exportada independiente cuando corresponda.
- Sin fixtures ni migración de serializaciones anteriores al SOURCE_BASELINE vigente.

## Fuera de alcance

No se implementa ni valida ningún cambio de producción aquí; no se cambia Database ni el Player de la plantilla FPS; Camera G004 no está autorizado. El `SOURCE_BASELINE` de entrega debe provenir del G003 CORR-001 aprobado como **base de continuidad**, con solo documentación y ledger de este Gate.

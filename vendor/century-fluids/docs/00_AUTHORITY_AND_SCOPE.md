# CF-CA-001 — Autoridad y alcance de Century Fluids v1.0

> **VIGENCIA PARCIAL:** CF-CA-002 ratificado sustituye las referencias incompatibles a Rust, Rust/WASM y el Gate S01 anterior. El texto original sigue aquí como historia. Para obligaciones activas, consultar `09_CF_CA_002_TYPESCRIPT_REPLACEMENT.md`. La obligación de integrar Century en v1.0 no se eliminó y S08 permanece EN PAUSA.

**Estado:** BORRADOR TÉCNICO EMITIDO BAJO S00-G001; RATIFICACIÓN CONTRACTUAL PENDIENTE. **Fecha:** 2026-11-19. No equivale a liberación ni implementación.

## Jerarquía

1. Decisión explícita del usuario y sus Amendments ratificados.
2. Contratos y Gates vigentes compatibles.
3. Documentación aprobada del proyecto.
4. Código fuente real: única evidencia del estado implementado.
5. QA ejecutado y registrado: única evidencia de resultado.

En un conflicto se suspende la cláusula inferior y se requiere resolución contractual. El baseline previo del laboratorio Mantaflow NO es dependencia, fuente ni autoridad de implementación de Century Fluids. Las fuentes reales de Century solo intervienen al auditar compatibilidad e integración, sin alterar la separación del nuevo proyecto.

## Producto v1.0

Biblioteca Rust de **líquidos tridimensionales incomprensibles** (agua como escenario de referencia), con evolución temporal, partículas o estados equivalentes justificados por la formulación, presión, densidad, fuerzas, viscosidad, emisión y remoción controladas, colisiones estáticas/dinámicas, interacción bidireccional con cuerpos Jolt, compilación nativa/WASM, datos para reconstrucción de superficie, integración Editor/Runtime de Century, QA y empaquetado.

## Exclusiones explícitas v1.0 (no funcionalidades pendientes)

Simulación de humo, gases, nubes, combustión, multifase, océanos globales, redes multijugador, persistencia de formatos experimentales no utilizados y reescritura de la física rígida de Jolt. Estas capacidades no están comprometidas por la especificación v1.0. No se reutiliza Mantaflow ni se traduce su código.

## Invariantes

- El solver pertenece a Rust; no se introduce otro solver de líquido en JavaScript o Century.
- JoltPhysics.js es autoridad de cuerpos rígidos; Rust entrega acoplamiento, nunca un segundo motor rígido.
- No se accede directamente a punteros de otra instancia WASM sin un contrato de memoria probado.
- Renderizado consume datos físicos, pero no produce física ficticia.
- Estado, errores y ciclos de vida tienen una sola autoridad por subsistema.
- No se modifica Century antes de autorización e integración S08, salvo contrato superior explícito. **S08 se encuentra EN PAUSA por decisión del usuario (19-11-2026); se validará el agua en playground independiente antes de reactivarlo.**
- Se protege todo archivo existente; no se introducen migraciones por una supuesta obligación de retrocompatibilidad pre-1.0.
- Un Sprint se integra solo cuando todo su alcance está validado; defectos del alcance no se difieren para declarar PASS.

## Nota de continuidad CF-DEC-PAUSE-001 (19-11-2026)

**OBSERVADO / AUTORIDAD DEL USUARIO:** mantener 11 Sprints integrales y 11 Gates, sin reordenar ni dividir; pausar temporalmente la integración con Century; construir/usar un playground independiente para probar el agua y obtener aprobación antes de conectar el módulo a Century.

**EFECTO OPERATIVO:** S08 = EN PAUSA, sin aprobación implícita; se permite preparar y ejecutar QA de S09 como escenario de playground una vez terminados sus prerrequisitos físicos S06/S07; no se declara S08 completo ni se copia física al motor. S10 permanece condicionado a todos los requisitos contractuales vigentes.

**CONTRADICCIÓN CONTRACTUAL IDENTIFICADA (SIN AUTORRATIFICAR):** CF-CA-001 todavía incluye integración Editor/Runtime de Century en v1.0. Si se pretende **liberar v1.0 antes de integrar Century**, habrá que aprobar un Amendment que retire o reprograme esa obligación de la versión, sin borrar ni cerrar S08 ficticiamente. Esta decisión no autoriza implementación adicional.

## Reglas de decisión

El usuario define qué producto se construye. La ingeniería propone cómo con evidencia y lo ratifica documentalmente. Se mantiene la distinción OBSERVADO/INFERENCIA/HIPÓTESIS/DECISIÓN PENDIENTE. El valor estable se asigna solo en S10 con las condiciones del contrato de QA.

## Gate S00-G001

**Objetivo:** fundación aislada, auditoría de fuentes, contratos de numerics/interop/QA, roadmap y ledger. **Mecanismo:** lectura de fuentes oficiales, contraste con source de Century, trazabilidad y QA documental. **Prerrequisitos:** autorización literal (recibida) y fuente Century versionada para auditoría completa (no disponible en este entorno). **Alcance:** docs, ledger, QA y estructura, sin física implementada. **Medios:** fuentes oficiales y runner documental sin dependencias externas. **Evidencia:** referencias y tests de estructura, ledger, integridad ZIP; auditoría Century restante explícitamente BLOQUEADA. **Contradicciones:** mantener aislado el Rust frente a integración futura con Century: se resuelve por secuencia S00–S08, sin integración temprana. **Siguiente acción:** cotejar SOURCE_BASELINE vigente de Century y versión Jolt; ratificar cláusulas. No cerrar G001 sin ello.

## Actualización contractual ratificada CF-CA-002 (2026-11-19)

Core y solver = TypeScript; Jolt WASM únicamente detrás del adaptador opcional; S05 = distribución/interop JavaScript, no Rust WASM. Se mantienen 11 Sprints, S08 pausado y playground S09. La cuestión del release S10 pendiente de integración Century permanece contractual y no se considera resuelta.


> **Continuidad S07 / CF-CA-003 (19-11-2026):** Las referencias anteriores a presets de agua en el núcleo y a `new FluidWorld()` con parámetros implícitos son históricas y quedan sustituidas por `docs/16_CF_CA_003_SOLID_FLUID_ARCHITECTURE_AND_WATER_SPECIALIZATION.md` y `docs/17_S07_SURFACE_EXTRACTION_AND_QA.md`. Se mantienen para trazabilidad, sin exigir compatibilidad pre-1.0.

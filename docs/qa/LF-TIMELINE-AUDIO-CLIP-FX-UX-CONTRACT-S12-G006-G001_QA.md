# QA contractual — LF-TIMELINE-AUDIO-CLIP-FX-UX-CONTRACT-S12-G006-G001

**Estado:** DOCUMENTACIÓN GENERADA · VALIDACIÓN DE FUENTES REALIZADA · **QA CONTRACTUAL USUARIO PENDIENTE** · **NO APROBADO / NO CERRADO**.

## Auditoría de fuentes (sin modificaciones de producción)

| Tipo | Evidencia comprobada | Resultado |
|---|---|---|
| OBSERVADO | `TemporalResourceInspector.vue`: `v-if` de sección `inspector-audio-fx` para cada clave Audio Play y controles de `AudioMixerInspector` en modo `fx-only` | El editor aparece aun con `item.fx` ausente/vacío. |
| OBSERVADO | `editKeyFx()` en Inspector permite añadir, quitar, ordenar y parametrizar hasta 16 FX | Capacidad de autoría explícita aprobada G005. |
| OBSERVADO | `src/core/timeline/model.js`: `normalizeKey` conserva opcional `key.fx` con `normalizeFx` | Una clave antigua sin FX no obtiene el campo automáticamente. |
| OBSERVADO | `src/engine/runtime/audio/engine.js`: `opts.fx` se transforma en nodos DSP por voz | El editor UI no es condición para reproducir FX guardados. |
| OBSERVADO | Preview y Player entregan `key.fx` al motor o comando de sonido | La cadena de datos es relevante para runtime y exportación. |
| OBSERVADO | `src/components/Inspector.vue` utiliza `AudioMixerInspector` para bus | Eliminar o duplicar el componente común sería regresión del Mixer. |
| INFERENCIA | Ocultar solo la UI de FX puede conservar el sonido si no se modifica ningún dato ni flujo | Exige QA de regresión en Gate posterior; no es QA realizado. |
| CAUSA RAÍZ | Sección FX se muestra por tipo/acción, no por `fx.length` | Causa del espacio UI innecesario demostrada. |

## Validación documental del Gate actual

- [x] SOURCE_BASELINE CORR-001 íntegro como punto de partida, no se usa baseline antiguo.
- [x] Contratos G005, CORR-001 y G006 auditados; discrepancia identificada y alcance de supersesión acotado.
- [x] Propuesta de nuevo contrato para UI, datos heredados, compatibilidad Preview/Player y Mixer.
- [x] Un Gate posterior y medios indispensables identificados; ninguna implementación prematura.
- [x] Fallos QA anteriores conservados, sin atribuir resultados automatizados no documentados.
- [ ] **Aprobación expresa del usuario** de CA-01..CA-06.

## Pruebas de lectura ejecutadas en generación

`node --test scripts/test-timeline-audio-clip-effects-s11-g005.mjs scripts/test-timeline-audio-clip-effects-s11-g005-corr001.mjs scripts/test-timeline-audio-integration-persistence-s11-g006.mjs`

**Resultado de referencia actual:** 47 PASS / 2 SKIP / 0 FAIL de 49. Los SKIP dependen de librerías de Player no instaladas en el entorno; **no** certifican Editor/Player reales. Log `docs/qa/evidence/LF_S12_G006_G001_READONLY_NODE.log`.

**Electron/compilación/QA auditivo para este Gate documental:** NO EJECUTADOS por estar fuera de alcance. No presentar el resultado Node como prueba de una UI todavía no implementada.

## QA contractual a devolver por el usuario

Confirmar las tres decisiones del Amendment: 1) retirar el editor FX privado de todas las claves Audio Play; 2) para cadenas FX existentes, mostrar solo indicador discreto no editable, sin borrar ni migrar datos; 3) continuar reproduciendo los FX privados históricos y conservar Mixer de buses, sin trasladar automáticamente los FX. La aprobación debe indicar si la propuesta completa es aceptada o qué cláusula requiere revisión.

**Aprobación del Gate actual:** pendiente. **Gate futuro de implementación:** no autorizado; no alterar código sin su autorización exacta.

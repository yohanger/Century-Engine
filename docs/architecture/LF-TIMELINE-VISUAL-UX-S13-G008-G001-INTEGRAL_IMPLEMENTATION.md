# LevelForge · S13-G008-G001 · Gate visual integral de Timeline

**Gate autorizado literalmente:** `Listo. LF-TIMELINE-VISUAL-UX-S13-G008-G001-INTEGRAL autoriza comenzar`. 2026-11-08.

**SOURCE_BASELINE de entrada:** `LF_INSPECTOR_TERRAIN_CLEANUP_S13_G005_G002_INTEGRAL_SOURCE_BASELINE(1).zip`, adjuntado por el usuario. Base íntegra de 2.757 archivos.

## Auditoría y mecanismo

- `TemporalResourceInspector.vue` contiene una sección propia de automatización de volumen, punto colapsable por ID y acción existente `editInspectorVolumePoint('remove', point)`.
- `ParamForm.vue` aloja el selector Clip; el texto de opciones largas expandía el control sin `min-width:0` ni truncamiento adecuado.
- `TimelinePanel.vue` ya comparte coordenadas temporales y calcula cabezal, ticks, puntos y clips como `tiempo × zoom`. Existían capas visuales (puntos, asas) por encima de la línea del cabezal.
- `Icon.vue` ya integra trazados SVG Bootstrap Icons en `BI`, sin dependencia nueva.

Se extendieron exclusivamente estos cuatro componentes originales:

1. Inspector: título de automatización a la izquierda y «Añadir punto» a la derecha, separador, puntos alineados a la izquierda, icono Bootstrap `bi-trash` siempre visible a la derecha incluso al plegar propiedades, accesibilidad y disabled existentes conservados. No se cambia el orden de puntos.
2. ParamForm: `max-width:100%`, `min-width:0`, `box-sizing:border-box`, elipsis en el selector sin alterar ID, valores, eventos ni datos.
3. Timeline: overrides scoped al final de `TimelinePanel.vue` que usan tokens del tema (`--g-900`, `--g-850`, `--hair`, `--text`, `--blue`) en superficies principales. La línea del cabezal tiene `z-index:24` por encima de clips y puntos; la regla conserva su prioridad visual; el cabezal sigue sin interceptar punteros.
4. Icon: un único icono `bi-trash` dentro del mapeo Bootstrap existente, licencia MIT documentada en este archivo y nota de licencia. No se instala otra librería.

## Fuera de alcance (decisión expresa)

- **Margen real antes de t=0:** requeriría modificar las coordenadas de regla, viewport, Snap, drag y zoom. NO IMPLEMENTADO en un Gate estrictamente visual, para evitar desalineación. Pendiente de Gate funcional.
- **LIFO verdadero por orden de creación:** el modelo ordena puntos por `t`, no conserva orden de inserción. No se simula un LIFO que se perdería al guardar. Pendiente de contrato/modelo.
- Recorte desde inicio, ajuste real del tramo audible/duración, propiedades automatizables de otros clips, relación de aspecto y grid cinematográfica: pendientes de Gates funcionales.
- `src/core/timeline/model.js`, audio DSP, Player, Preview, Cinematics, Mesh, Jolt, dependencias y recurso fuente: sin modificaciones.

## Evidencia actual

- Node focal `VIS-01..17`: 17 PASS, 0 FAIL.
- Node compatible: 110 PASS, 1 SKIP (compilador Vue ausente), 0 FAIL.
- Los dos scripts de la fixture Electron son sintácticamente válidos.
- Electron y build NO VERIFICADOS en entorno de preparación (Vite no instalado). Son responsabilidad del QA local posterior.
- Estado del Gate: IMPLEMENTADO, NODE PASS, QA LOCAL PENDIENTE, NO APROBADO NI CERRADO.

## Atribución del icono

El trazado `bi-trash` corresponde a **Bootstrap Icons**, copyright Bootstrap Authors; licenciados bajo la **MIT License**. Fuente: https://icons.getbootstrap.com/icons/trash/ y repositorio oficial https://github.com/twbs/icons/. Se integra un SVG individual, sin fuentes tipográficas, sprites, CSS externo ni paquetes.

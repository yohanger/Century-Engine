# LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-TIMELINE-PRO-UX-CORR-004-INTEGRAL — Auditoría de causa raíz y ejecución

**Fecha:** 2026-11-10. **Autorización:** frase literal del usuario. **Baseline:** `LF_TIMELINE_PROPERTY_ANIMATION_S13_G008_G008_PROPERTY_KEYFRAMES_CAMERA_DROP_UX_CORR003_INTEGRAL_SOURCE_BASELINE.zip`.

**ESTADO:** IMPLEMENTADO EN FUENTES; **215/215 Node PASS** en batería principal (24 nuevos) y **65/65 Node PASS** en regresión seleccionada de audio; Electron UX CORR-004 **25 checks PREPARADOS, NO EJECUTADOS AQUÍ**; compilación Editor/Player **NO VERIFICADA** (no está instalado Vite); QA visual local **PENDIENTE**. NO APROBADO / NO CERRADO.

## 1. Jerarquía contractual y alcance

Vinculan UA-CA-001 ratificado, G005, CA-TB01-001, G008-CORR-001/002/003 y Camera Orchestration S15. La entrega es de composición e interacción visual. Se preserva la serialización Timeline, ID escena+nodo+propiedad, recurso de Cinematics/FilmMaker, selección de Inspector, automatización/audio, Cam Orchestration, Jolt y Player. G007 conserva su falta de certificación del acceso directo `object3D`.

## 2. OBSERVADO en el SOURCE_BASELINE y capturas del usuario

- `src/components/ContextMenu.vue` realizaba clamp vertical de `store.menu.y` a `innerHeight - altoMenu`. Si el clic estaba en una fila cerca del extremo inferior de un Timeline acoplado pequeño, el menú se movía **hacia arriba sobre la regla temporal y el nombre inspeccionado**. No consideraba el rectángulo del origen ni el límite inferior de la regla.
- `src/components/TimelinePanel.vue` contiene varias generaciones de selectores de `.head`, `.pinned-row`, `.node-head`, `.node-property-head`, `.ico` y `.l1`. G008-CORR-002 había añadido jerarquía correcta en datos, pero los controles y sangrías conservaban estilos de pista plana. Los iconos y controles competían en una columna inicialmente estrecha.
- `src/components/MenuList.vue` disponía de scroll general, pero títulos y etiquetas largas no tenían truncamiento garantizado ni un límite de altura específico del punto de apertura.
- La plantilla renderiza dos columnas con `visibleRows` común y la misma altura **36 px**; cambiar la altura unilateralmente alteraría geometría de audio, carriles, selección, marquee y cabezal.

**CAUSA RAÍZ UX:** composición visual de pistas derivadas insuficientemente consolidada. **CAUSA RAÍZ DE SUPERPOSICIÓN:** el popover se recolocaba según el viewport global, ignorando el área de regla temporal y la fila invocante; la solución se dirige a los módulos originales y no al modelo temporal.

## 3. Modificaciones ejecutadas

### `src/components/TimelinePanel.vue`

- Las acciones contextuales existentes de pista, clave, segmento, marcador, clip y grupo envían al mismo `store.menu` un anclaje opcional derivado del elemento/posición y límite inferior de la regla. El arrastre general utiliza el punto del drop, no el ancho total de `.main`.
- **No cambia** el listado de acciones ni las rutas de invocación a Undo/Redo. El modo `row` procura colocar el menú al lado de la cabecera, sin ocultar la fila seleccionada; `point` protege la clave, marcador o cursor puntual.
- Encabezado de nodo con énfasis tipográfico moderado, control de plegado compacto, iconografía y número de pistas discretos. Propiedades hijas sangradas, su nombre con elipsis, drag/mute/lock con medidas fijas. Los iconos de filas planas dejan de usar cajas decorativas que ensucian el panel. Los grupos mantienen tratamiento coherente.
- Marcador romboidal puntual con foco y selección visibles; línea de interpolación no intercepta eventos de puntero. **Altura 36 px y geometría temporal intactas**.
- Cada fila expone `data-timeline-row` e `data-timeline-id` en sus dos superficies **solo para inspección DOM**, sin persistir nuevo estado ni duplicar datos.

### `src/components/ContextMenu.vue`

- Si recibe un `timelineAnchor`, calcula abajo/arriba respecto a la fila, evalúa el espacio útil y evita invadir la regla. Da preferencia a abrir debajo del elemento; en espacio escaso limita la altura y utiliza scroll interno en vez de desplazar todo el menú sobre las cabeceras. Si cabe, coloca el menú al lado derecho/izquierdo de la fila para dejar visible la etiqueta original.
- Sin anclaje Timeline, el comportamiento común conserva su clamp original. Mantiene Escape, foco inicial y clic exterior. Responde a resize y cierra menú Timeline al desplazar la fila (el scroll interno propio no lo cierra).

### `src/components/MenuList.vue`

- Consume el límite de altura opcional mediante variable CSS del popover original; sin copiar ni alterar sus acciones y submenús. Títulos y etiquetas largas se truncan. Conserva roles, navegación por teclado, submenús y scroll interior.

## 4. Tests y límites de ejecución

- Nuevo `scripts/test-timeline-property-animation-s13-g008-g008-ux-corr004.mjs`: **24/24 PASS**, ejecuta el cálculo de posición real de `ContextMenu.vue` mediante VM con dimensiones simuladas y comprueba la composición de filas y conservación de rutas originales.
- Regresión G006+G007+geometría+G008+UA+CORR-002+Jerarquía S04+CORR-003+CORR-004: **215/215 PASS**.
- Regresión seleccionada trim/zoom/waveform/volume audio: **65/65 PASS**, sin modificar audio.
- Fixture Electron real de 25 verificaciones: `scripts/fixtures/editor/timeline-pro-ux-s13-g008-corr004.html`, wrapper `scripts/test-timeline-property-animation-s13-g008-g008-ux-corr004-electron.mjs`. **NO EJECUTADO en el contenedor** porque faltan Vite/Electron. Debe validarse con el usuario.
- Build `npm run build`: intentado, **NO VERIFICADO: `sh: 1: vite: not found`**. No inferir COMPILADO.
- Anomalía anterior independiente: aserción textual `G004-29` del test integral histórico esperaba un mensaje ya ausente en el SOURCE_BASELINE previo. No modificar runtime ni reclamar G004 PASS por omisión. Referencia QA de CORR-003.

## 5. Riesgos de integración y evidencia exigida

El algoritmo Node prueba límites geométricos con viewport simulado; **solo Electron y capturas confirman que menús, z-index, fuentes, píxeles y docking se muestran correctamente**. Revisar al menos 1366×768, dock estrecho, menú en fila superior/inferior, scroll, teclado, audio y Cinematics. Si falla esa revisión, CORR-004 requiere corrección propia antes de cierre.

**Sin cambios de sistema de animación:** `src/core/timeline/model.js`, evaluadores runtime, PlayMode/Player, Camera Orchestration y Jolt conservan hash SHA-256 del baseline G008-CORR-003. No se han creado managers, service locators ni otro árbol visual persistente.

# LF-INSPECTOR-GLOBAL-UX-CLEANUP-S13-G001 — Contrato UX propuesto

**Estado: RECOMENDADO · PENDIENTE DE RATIFICACIÓN EXPRESA.** Este texto es resultado del Gate documental autorizado; **no supersede contratos anteriores ni autoriza implementación**.

## UX-01 · Propósito y alcance

El Inspector de LevelForge sirve para consultar y editar propiedades y estados contextuales. **No es una página de documentación**. Se limpiará de forma integral el contenido montado en `InspectorDock.vue`: nodos, Escena, Terreno, recursos, Timeline, Audio Mixer contextual, Señales, Malla y Pintura. Los diálogos o editores externos al dock quedan fuera salvo referencias cruzadas verificadas. Preservar una única autoridad de selección y un único Inspector.

## UX-02 · Texto y densidad

1. En los campos de propiedades se muestran etiqueta, valor, control, unidad y estado indispensable. Retirar párrafos de instrucciones, atajos, tutoriales, recetas de API, explicaciones de internals y texto editorial redundante.
2. Mantener avisos que afectan a una decisión o integridad: validación, error, referencia ausente, permisos/bloqueo, operaciones destructivas, rendimiento, progreso y autoridad efectiva de Escena/World. Convertir textos largos en una frase accionable, sin ocultar el estado ni el dato.
3. **Propuesta de precedencia UX pendiente de ratificación:** el Inspector seguirá limpio tanto con `tooltips=false` como con `tooltips=true`; activar ayudas globales no debe restaurar párrafos de documentación dentro del Inspector. La implementación deberá hacerlo localmente en el propio Inspector/estilos, **sin cambiar** `src/core/tooltips.js`, el comportamiento del resto de la aplicación ni los controles de tooltips globales todavía pospuestos.
4. No eliminar masivamente `.hint`, `.note`, `.lf-help`, `.keep`, `.warn` ni ejecutar `audit-help-text --fix` a ciegas. Clasificar por **significado** y pruebas de protección.

## UX-03 · Encabezados y plegado

1. Todo **apartado de propiedades** del Inspector tendrá encabezado distinguible, accesible, contraíble/expandible. Los controles de resumen/acción en el encabezado conservarán su click propio sin plegar accidentalmente.
2. Extender el delegado existente de `InspectorDock.vue` y `store.prefs.inspFold`. Los paneles especializados podrán conservar `<details>`/su plegado local cuando sea más correcto que forzar la estructura `.sect`; deben cumplir UX, accesibilidad y persistencia exigida por contexto. **No crear un segundo gestor global.**
3. Introducir identidad semántica estable por sección y contexto, con migración no destructiva de `inspFold` basado en etiquetas para no perder preferencias previas. La decisión de alcance de persistencia (por tipo de nodo/edición de recurso, no por instancia mutable) deberá quedar probada en G002.
4. Al contraer se ocultan controles subordinados pero no se cambia el modelo ni el Undo/Redo, ejecución, efecto, escena o selección. Un error crítico no se vuelve invisible sin señal: contador/estado en encabezado o autoexpansión según el caso definido por QA del Gate específico.
5. Garantizar teclado (Enter/Espacio), `aria-expanded`, lectura de encabezado, orden de tabulación y estabilidad al cambiar de selección, editor estrecho y docking.

## UX-04 · Scroll y listas

1. Ningún listado dinámico crece indefinidamente: si es extenso, se limita altura dentro de su grupo, con scroll accesible e indicadores visibles cuando se oculta contenido.
2. **No establecer cinco elementos como umbral global**: ese criterio pertenece a los puntos Audio G007-G001. Para scripts, capas, efectos, vegetación, señales, recursos y pistas, cada Gate definirá umbral según altura real y necesidades de edición, sin scroll anidado innecesario.
3. Mantener nombres editables, selección, drag-and-drop, orden, foco y atajos. La interacción dentro de listas no debe disparar plegado por accidente.

## UX-05 · Autoridad contractual y datos

- No tocar valores, serialización, migración de proyectos, recursos, escenas, dependencias, Editor/Player, física/Jolt, render/World, materiales, VFX, audio DSP, Automation, comandos ni Signals por una limpieza visual.
- En Terreno, mantener el nodo/ID real, gizmo y selección; Escena conserva autoridad de World/lighting/bake y resets heredados; Material y VFX conservan recurso compartido; Timeline conserva `key.fx` y nombres de puntos; Señales mantiene catálogo y conexiones; Mixer mantiene efectos de bus.
- No quitar validaciones de seguridad ni advertencias de operación irreversible. Si el contrato previo exige un aviso y la limpieza propone retirarlo, **BLOQUEAR la implementación específica y tramitar Contract Amendment**, no modificar datos para acomodar el diseño.

## UX-06 · Gates de implementación propuestos (NO AUTORIZADOS)

| Gate propuesto | Unidad pequeña y verificable | Dependencia / QA dominante |
|---|---|---|
| S13-G002 | Base plegado y claves estables en `InspectorDock.vue`, sin rediseñar editores | Migración `inspFold`, teclado, click de botones, cambio de contexto/docking |
| S13-G003 | `Inspector.vue`: nodos y avisos, sin tocar lógica física/renders | Propiedades, estado, scripts, transform, Node/Editor QA |
| S13-G004 | `ScenePanel.vue`: estructura compacta + plegado de secciones | Autoridad World/Bake, reseteos, opciones heredadas |
| S13-G005 | `TerrainPanel.vue`: estructura y protección de operaciones peligrosas | Selección Terrain/pieza, pincel, capas, generator, QA integrada |
| S13-G006 | Recursos: Material/Liquid/Perfil/GameManager (incluidos componentes anidados) | Identidades por ID, recursos compartidos, pestañas/estado/edición |
| S13-G007 | Recurso VFX y editores especializados: `VfxEditor.vue` | CA VFX existente; preview explícita y curvas sin render paralelo |
| S13-G008 | Timeline/Cinematics/Audio Mixer contextual | CA-001 FX, puntos G007, 40 checks Electron heredados, transporte |
| S13-G009 | Señales + Malla/Pintura (separar en Gates distintos si auditoría G001/G002 detecta riesgo) | Árbol/dialog de señales, operaciones de mesh/pintura |
| S13-G010 | Integración UX final | Regresión cruzada Node, Electron, build Editor/Player y QA local |

**Siguiente acción:** ratificar este contrato y autorizar **solo** el siguiente Gate G002 mediante declaración literal nueva. Esta planificación no implica autorización tácita de G003-G010. Los **tooltips globales** se abordan **después** del cierre aprobado de la limpieza global, en otro Sprint/Gate.

## UX-07 · Criterios de aceptación por Gate

Para cada componente afectado: (A) un solo montaje y fuente de datos, (B) propiedades/acciones históricas conservadas, (C) cero párrafos instructivos en estado normal independientemente de la preferencia de ayudas tras la ratificación, (D) errores/advertencias visibles, (E) secciones contraíbles por teclado/ratón sin escritura de proyecto, (F) estado de plegado estable y reversible, (G) listas acotadas, (H) QA Node y Electron con controles reales, (I) compilación Editor/Player y QA local declarados solo con evidencia, (J) ledger y dos ZIP de entrega. Nunca inferir PASS visual de una comprobación estática.

## UX-08 · Contradicciones y decisión pendiente

La política existente `html:not(.lf-tips)` permite que la preferencia «Mostrar tooltips» revele ayuda del Inspector. UX-02.3 propone retirar específicamente ese vínculo visual **dentro del Inspector**. Hasta ratificación, **la política histórica prevalece** y ningún archivo CSS, `core/tooltips.js` o componente se modifica. La necesidad de conservar advertencias de autoridad/validación de contratos parent prevalece sobre cualquier eliminación genérica de párrafos.

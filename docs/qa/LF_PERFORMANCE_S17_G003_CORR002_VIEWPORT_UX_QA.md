# LF-PERFORMANCE-S17-G003-CORR-002 — Evidencia y QA

Fecha: 2026-11-18  |  Estado: IMPLEMENTADO · TEST PASS · COMPILACIÓN NO VERIFICADA · QA LOCAL NO VERIFICADO · APROBACIÓN PENDIENTE · CIERRE PENDIENTE.

## Autoridad y objetivo

Autorización literal recibida: `Listo. LF-PERFORMANCE-S17-G003-CORR-002-VIEWPORT-OVERLAYS-AND-DIAGNOSTIC-UX-CLEANUP autoriza comenzar`.

Fuente: `LF_PERFORMANCE_S17_G003_CORR001_REAL_VIEWMODES_TERRAIN_BAKE_AND_CLOUD_DIAGNOSTICS_SOURCE_BASELINE.zip` (3.638 archivos). Los cambios respetan la línea base del horneador de iluminación y de la simplificación geométrica existente. No se han tocado algoritmos de simplificación, nubes, LOD ni el bake de iluminación.

Objetivo: corregir exclusivamente la UX de los diagnósticos del viewport, panel Rendimiento y Hornear Mapa, suprimiendo explicaciones largas en interfaz sin perder métricas ni alterar su semántica.

## Mecanismo aplicado

| Área | Cambios | Estado |
|---|---|---|
| Viewport | `ViewportDiagnosticsHud.vue` se incorpora a `ViewportOverlay.vue`: muestra título, contadores y leyenda por modo, incluso con F3 cerrado. Se oculta en Lit y durante Play. | Implementado en fuente |
| Escalas | El renderer y el HUD consumen paletas de coste y LOD compartidas en `view-diagnostics-contract.js`. Shader distingue GLSL estático y pasos de nubes. | Implementado en fuente |
| Datos | `view-diagnostics.js` publica contadores estructurados que ya computaba; no se añaden estimaciones GPU. | Implementado en fuente |
| Rendimiento | `PerfPanel.vue` muestra tiempos, pasadas y escena de manera compacta; métricas avanzadas permanecen disponibles en secciones plegables. Se retiran párrafos y la leyenda trasladada al viewport. | Implementado en fuente |
| Hornear Mapa | `ScenePanel.vue` conserva tolerancias y recuentos, elimina explicación extensa y adopta botones con flexibilidad, hover, activo, disabled, foco y etiqueta reducida. | Implementado en fuente |
| Barra Vista | Tooltip reducido a la etiqueta del modo; sus contratos y descripciones técnicas internas se conservan. | Implementado en fuente |

No se introduce un profiler paralelo. La escala Shader Complexity indica **lecturas GLSL estáticas**, no tiempo GPU; las nubes representan un presupuesto de iteraciones por rayo. Light Complexity continúa siendo un recuento CPU de luces candidatas.

## Prerrequisitos, medios y evidencia

Entorno: Node 22.16.0, scripts Node existentes. No hay `node_modules`; Vite y compilador Vue no están instalados. Se usó un clon aislado del ZIP de línea base. No se modificó ningún proyecto ni paquete original del usuario.

- `node --test scripts/test-performance-s17-g003-corr002-viewport-ux.mjs`: **9/9 PASS**.
- `node --test` con ViewModes G001, performance S17-G003, diagnósticos, CORR-001, CORR-002 y profiler: **63/63 PASS** (`lf_vm_corr002_main_qa.log`).
- Batería extendida de ocho suites históricas: **97 PASS / 7 FAIL** (`lf_vm_corr002_extended_qa.log`). Repetida sin cambio contra la línea base original: **97 PASS / 7 FAIL** idénticos (`lf_vm_corr002_baseline_extended_qa.log`). Los siete fallos se deben a expectativas heredadas de otras áreas, no a esta corrección. No se les atribuye causa raíz general.
- Dos aserciones textuales históricas sobre la ubicación de la leyenda y las etiquetas de nubes se actualizaron al contrato UX vigente; no se retiraron pruebas de métricas ni se suprimieron evidencias antiguas.
- `npm run build`: **NO EJECUTADO** (`vite: not found`).
- QA visual mediante Electron embebido y pruebas en viewport estrecho: **NO VERIFICADO**.

## Pruebas visuales requeridas en el equipo

1. Activar **Shader Complexity** con F3 cerrado: leyenda y carga de nubes se ven en el viewport. Cambiar a **Lit** elimina el HUD sin superposiciones residuales.
2. Comprobar **Light Complexity**, **LOD**, **Clusters** y **Triangles** al mover la cámara: títulos, paletas correspondientes y contadores concuerdan con los datos existentes. Los colores no representan ms de GPU.
3. Abrir Rendimiento (F3): métricas principales legibles; `Más pasadas` / `Más métricas` muestran los datos previamente disponibles sin textos largos. Cerrar y abrir repetidamente sin fuga de temporizadores.
4. En Inspector estrecho: Hornear Mapa, Restaurar, valores y tolerancias permanecen utilizables; comprobar hover, active, disabled, foco por teclado y restaura sin cambiar el algoritmo.
5. Activar Play/Stop y modos de edición: el HUD no cubre el juego ni modifica cámara, geometría, nubes o materiales; comparar con CORR-001.

## Contradicciones y siguiente acción

El Gate G003 CORR-001 requería una leyenda textual en Rendimiento. Esta corrección UX autorizada la traslada al viewport; la aserción histórica se actualiza conservando la prueba de ausencia de falsos tiempos GPU. No se interpreta una métrica estática como consumo en tiempo real.

**Bloqueos:** instalación de dependencias, compilación Vite, ejecución Electron/Player y QA visual. No declarar COMPILADO, QA LOCAL PASS, APROBADO ni CERRADO antes de evidencia del usuario.

Siguiente acción: ejecutar `npm install`, `npm run build`, `npm run electron` en el equipo del usuario, revisar A/B y registrar resultado. No iniciar nuevas optimizaciones bajo este Gate.

# LF-NODE-SIGNALS-GODOT-UX-S04-G001 — Implementación

**Fecha:** 2026-11-02 · **Estado:** IMPLEMENTADO, QA local pendiente.

## Diagnóstico previo

**Observado:** `SignalConnectionsPanel.vue` construía tarjetas separadas de señales y un formulario con `<select>` plano de receptores. El runtime y el InspectorDock ya disponían de las operaciones de alta/edición/baja; `getNativeSignals()` ya publicaba metadata inmutable; `discoverNodeSignals()` ya aportaba candidatos sin ejecutar JS. **Causa raíz:** estructura del panel incompatible con la navegación y representación Godot, no falta de un runtime ni de una segunda clase de nodo.

## Producción modificada

**Únicamente** `src/components/SignalConnectionsPanel.vue`:

- Lista de árbol por fuente nativa existente, agrupación por origen, señal con `firma(nombre: tipo)` derivada de `args`, contadores de conexiones, enlaces indentados y estados de activación; `Personalizadas` mantiene sin alteración semántica los diagnósticos S03 y conexiones antiguas.
- Doble clic / Enter sobre señal seleccionada abre diálogo básico. Árbol jerárquico de receptores basado en `parentId`, con búsqueda que conserva ancestros, selección y teclado. Método textual `node.expose` como contrato existente, sin inferir ni crear método.
- Se mantiene `addSceneSignalConnection`, `editSceneSignalConnection`, `removeSceneSignalConnection`: un único commit por operación, Undo/Redo y persistencia sin cambios.
- Reutilización de `Icon.vue`, los tokens visuales de LevelForge, foco, Escape, Tab, jerarquía, flex y modal adaptable. Vista plana previa de tarjetas sustituida.

**InspectorDock.vue sin modificar**: continúa la disposición `Inspector / Señales / Terreno` para no invadir el Sprint Terreno. **Runtime y estado de escena sin modificar**.

## Pruebas y hallazgos

- Suite nueva S04-G001: 18 casos Node, acciones ejercitadas sobre la lógica de `<script setup>` con store simulado, además de comprobaciones de template.
- Regresión focal histórica: la expectativa de la prueba S03 se actualizó de `signalInfo.get(signal).owners` a `signalInfo.get(signal.name).owners` al pasar de strings a entradas de catálogo. La fuente de propietarios sigue siendo la misma.
- Fixture Electron de editor S06-G003 actualizada para seleccionar receptor en árbol y utilizar el botón `.sig-new` en lugar del selector `<select>` eliminado. Fixture S04 específica prueba la estructura Godot, árbol, origen, compilación Vue, historial y Jolt/WebGL2 reales.
- En el entorno implementador, Vite y el compilador de SFC no están instalados: Electron y build NO VERIFICADOS. No se declara QA visual PASS sin ejecución real.

## Diferencias asumidas respecto de Godot

No hay clases Node/AnimationPlayer idénticas a Godot; se agrupa por metadatos reales. No hay generación automática de callbacks ni opciones avanzadas sin soporte de runtime. Los métodos dinámicos se validan solo al entrar en Play. Las firmas de Custom Signals no se inventan. El siguiente Gate UX queda sujeto a QA local y a la decisión explícita de alcance.

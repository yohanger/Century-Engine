# S17-G003 CORR-002 — Contrato de diagnóstico en viewport

- **Autoridad:** ViewDiagnostics sigue siendo el único productor de datos editoriales de ViewModes; PerfMonitor mantiene las métricas temporales.
- **Presentación:** `ViewportDiagnosticsHud` consume exclusivamente `store.editor.vp.viewDiagnostics.last`, sin ejecutar escaneos ni renderizar diagnósticos adicionales. No depende de F3.
- **Estado:** cambia con el modo editorial existente; Lit y Play no muestran HUD; limpia su timer al desmontar. Ningún valor de HUD se serializa en el proyecto.
- **Color:** `DIAGNOSTIC_HEAT_COLORS` y `DIAGNOSTIC_LOD_COLORS` son escalas compartidas con el renderer; para nubes la leyenda reproduce los tres colores utilizados por su shader.
- **Semántica:** Shader = lecturas GLSL estáticas; nubes = pasos de raymarch; Light Complexity = candidatas CPU. No convertir esos valores en ms GPU.
- **Paneles:** Rendimiento muestra contadores y pasadas, con detalle plegable. Hornear Mapa conserva sus funciones y parámetros y solo sustituye la presentación.
- **Fuera de alcance:** simplificadores, clústeres, horneado de luz, autoridad meteorológica, shaders atmosféricos, interfaces de Runtime y nuevas mediciones GPU.
- **QA:** nueve tests nuevos de semántica y composición; regressiones del contrato anterior; QA visual Electron pendiente.

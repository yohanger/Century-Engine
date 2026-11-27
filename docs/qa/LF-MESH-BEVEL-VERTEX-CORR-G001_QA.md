# LF-MESH-BEVEL-VERTEX-CORR-G001 — Evidencia de QA

## Casos automatizados

`npm run test:bevel-vertex` ejecuta pruebas sobre:
- curvas en esquinas abiertas, chaflán de un segmento, volumen cerrado de caja, cuatro y ocho esquinas, 32 segmentos;
- ancho y segmentos inválidos, aristas sueltas, caras no manifold, edición fuera de modo vértice, roundtrip de geometría/atributos;
- bisel de contorno, chaflán elevado, rechazo de selecciones ramificadas, rechazo de mezcla de aristas;
- contratos fuente de menú, atajo, modal, vista previa, confirmación.

La regresión incluye los scripts existentes de edición de malla, LoopCut, integración, TriMesh y Box-Fit.

## Validación manual pendiente

1. En Electron Linux, crear un cubo tipo acera, seleccionar dos esquinas del borde visible, `Ctrl+Shift+B`, cambiar ancho, perfil y segmentos, aceptar con Enter.
2. Repetir y cancelar con Escape; comprobar que Ctrl+Z/Ctrl+Shift+Z efectúan un solo cambio por confirmación y que seleccionar otra pieza no cambia malla previa.
3. Probar `Ctrl+B` en borde exterior de un plano aislado y comprobar que sigue siendo superficie abierta; probar borde de malla compartida y exigir error sin mutación.
4. Guardar/abrir `.lfproj`; comprobar UV, colores Vertex Paint y triangulación tras el bisel.
5. Adjuntar `TriMeshShape3D` a la primitiva biselada; iniciar Play y Player exportado. Repetir con `BoxShape3D` autoFit. No declarar PASS de Jolt real hasta ejecutar.
6. Repetir en Windows y equipo de pocos recursos; verificar tiempos con 32 segmentos, foco y atajos.

El reporte final del proceso de pruebas se completará con los resultados reales; no se imputan pruebas visuales inexistentes.

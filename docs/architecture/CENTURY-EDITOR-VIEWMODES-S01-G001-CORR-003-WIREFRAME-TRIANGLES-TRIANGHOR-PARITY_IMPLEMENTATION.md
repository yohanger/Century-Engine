# Wireframe y Triangles: paridad de la geometría efectiva

## Alcance autorizado

`CENTURY-EDITOR-VIEWMODES-S01-G001-CORR-003-WIREFRAME-TRIANGLES-TRIANGHOR-PARITY`

No altera TriangHor, `ClusterMeshes`, la topología persistida, el Player, las herramientas de Edit Mesh ni el control de puntero.

## Fuente de autoridad

Ambas vistas editoriales consumen `ViewDiagnostics._drawTopology()`, que obtiene los índices efectivos existentes:

1. Terreno: `ClusterMeshes.terrainActive` y sus índices de página, producidos a partir de la selección activa de TriangHor o del nivel de detalle efectivo.
2. Lotes residentes: geometría de la página LOD activa en `entry.shared.pages`.
3. Dibujo directo por clústeres: `entry.directActive`, siempre que la partición tenga índices reales.
4. Objetos sin páginas indexadas aplicables: índices y `drawRange` del objeto realmente dibujado.

`faceColorBuffers()` conserva la expansión temporal de índices en posiciones de triángulos; el recurso de autoría no se reindexa ni se sobrescribe para diagnosticar.

El mismo `BufferGeometry` temporal se reutiliza entre Wireframe y Triangles. Wireframe utiliza un material propio de líneas (`wireframe: true`) y Triangles mantiene colores por triángulo. Clusters conserva sus colores de identidad de página.

La caché de topología distingue identidades reales de atributos de índice y posición, además de sus versiones y rangos de dibujo. Sustituir un índice por otro con la misma cantidad de triángulos ya no reutiliza incorrectamente la triangulación anterior.

## Ciclo de vida y compatibilidad

La representación temporal se incorpora a la escena solo durante el pase diagnóstico. Los nodos fuente se ocultan temporalmente; visibilidad, fondo y `shadowMap.enabled` se restauran en `finally`, incluso ante una excepción del renderer. El material Wireframe se libera mediante `dispose()` junto con los recursos diagnósticos. La pasada separada de gizmos del Editor permanece intacta.

## Límites

La paridad se refiere a los triángulos de la geometría efectiva, no al estilo visual ni a garantías de triangulación de polígonos no triangulares originales. Las pruebas automatizadas ejecutan la clase real `ViewDiagnostics` con un renderer y objetos Three simulados; no constituyen una compilación de Vite ni QA WebGL2/Electron real. La latencia y el consumo GPU en terreno de gran tamaño están pendientes de comprobación local.

No se han modificado otros modos del renderer, la física, el CSG ni las preferencias del usuario.

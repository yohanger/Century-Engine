# Century Engine — CORR-005: recuperación del renderizado Edit/Play

**Gate autorizado:** `CENTURY-EDITOR-UX-S02-G001-CORR-005-EDIT-PLAY-VIEWPORT-RENDER-RECOVERY`.

## Baseline y diagnóstico

El origen de la corrección es el SOURCE_BASELINE completo de CORR-004. El archivo ZIP se extrajo sin operaciones Git ni cambios locales previos acreditados. El problema reportado es la superficie vacía de Edit Mode con una escena abierta, después de introducir vistas acoplables y teletransportar el viewport principal mediante Vue Teleport.

La revisión identificó una ruta vulnerable: el selector `to` de Teleport permanecía igual cuando `DockTree` sustituía el elemento real de destino. Un target anterior podía quedar desconectado y un panel activo nuevo conservar el mismo ID. Adicionalmente, el viewport podía cambiar a dimensiones mínimas al ocultar la pestaña; no existía una recuperación explícita del dibujo vinculada a la reaparición del panel. Es una explicación técnica respaldada por el ciclo de vida del código; no se ha confirmado en Electron mediante reproducción instrumental.

## Implementación

- `App.vue` conserva un destino de respaldo conectado y resuelve **después del parche DOM** el elemento real de la vista principal y de la vista secundaria.
- Teleport recibe una referencia al elemento montado, no únicamente un selector que podría referirse a un target anterior. El cambio de destino desplaza el mismo árbol Vue; no crea un nuevo `Viewport` ni una sesión de Play.
- La vista observadora solo se monta si su destino está conectado y corresponde a la vista requerida. Así se evita un observador unido a un host de docking desactualizado.
- Al completarse la transición de DOM y la siguiente oportunidad de dibujo, se reutilizan `Viewport.resize()` y `Viewport.requestRender()`. Se verifica que el host corresponda al viewport, esté conectado y tenga dimensiones válidas.
- El regreso de foco y la recuperación de visibilidad de la ventana solicitan la misma reconciliación, sin reinicializar renderer, cámaras ni proyecto.
- `DockTree`, cámaras, selección, gizmos, Occlusion Culling, Frustum y reglas de autorización de Edit/Play no cambian.

## Límites y autoridad

No se crean renderizadores, cámaras, sesiones de juego ni fuentes de verdad adicionales. El `SOURCE_BASELINE` anterior no contiene metadatos Git ni dependencias instaladas: no permite acreditar diferencia con un repositorio remoto, compilación o funcionamiento WebGL real. La prueba visual en Electron con The Room y los casos de pestañas flotantes sigue siendo necesaria.

**Estado:** implementado en fuente y probado en Node; compilación y QA visual **NO VERIFICADOS**. Pendiente de aprobación del usuario; no cerrado.

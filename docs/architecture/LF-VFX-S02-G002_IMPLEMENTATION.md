# LevelForge — LF-VFX-S02-G002 · Nodo y Player

Fecha del Gate: 2026-10-28. Autorización recibida: «Listo. LF-VFX-S02-G002 autoriza comenzar».
SOURCE_BASELINE: `LevelForge_VFX_S02_G001_SOURCE_BASELINE.zip`, descomprimido y comparado contra modificaciones. El usuario aprobó G001; GPU y compilación seguían sin evidencia local.

## Objetivo ejecutado

Conectar el recurso `.vfx` y su simulación/render existentes al nodo `VFX3D` (`type: vfx`) mediante NodeRegistry y NodeLifecycle, en Editor/Play/Player, sin un segundo renderer y sin modificar el flujo de eventos.

## Implementación

- `src/engine/runtime/nodes/vfx.js`: definición Node3D, icono, ayuda editorial y controles `vfxId`, `enabled`, `seed`; `onEnterTree`, `onProcess`, `onExitTree`. La simulación y el renderer son privados de cada nodo. No se duplica el recurso.
- `src/engine/runtime/vfx/scene-validation.js`: validación pura del índice compartido, texturas y suma de capacidades de la escena (máximo 4.096). Proyectos anteriores o nodos aún sin recurso asignado siguen siendo válidos.
- `src/engine/runtime/scene/objects.js` y `scene-graph.js`: liberar recursos GPU al sustituir, eliminar, cambiar escena o destruir el graph. El `NodeLifecycle.stop()` ya existente desmonta la simulación Play; las guías se liberan solo al destruir el nodo.
- `src/engine/runtime/scene/textures.js`: reutilizar caché de sprites, observar carga asíncrona, no reactivar nodos de escenas eliminadas, notificar nodos VFX tras una imagen disponible. Fallos de lectura no se reintentan en cada frame.
- `src/components/Inspector.vue`: selector del VFX compartido, activación/pausa y semilla, más referencia inexistente visible. El editor profesional de VFX queda reservado a S03.
- `src/core/buildList.js`: validación preventiva del paquete Player para todas las escenas incluidas, comprobando definición, metadatos y bytes de textura.
- `src/engine/runtime/package/host.js`: comprobación de recursos y bytes del paquete antes de mutar el estado al cargar/cambiar escenas.
- `src/core/exporter.js`: fallo explícito al exportar a Godot escenas con `VFX3D`; no sustituirlas silenciosamente con `Node3D`.

El renderer permanece en `src/engine/runtime/vfx/render.js` (G001). En espacio local el quad es hijo de `visual` y hereda Transform/parenting. En espacio mundo se neutraliza la matriz del padre en cada proceso sin trasladar las partículas ya emitidas. Los cambios de definición o semilla reconstruyen únicamente la instancia afectada. La textura sigue siendo propiedad de la caché compartida.

## Alcance intocable y limitaciones

- Sin cambios en `events/`, Jolt, exportador de recursos `.levelpackage`, simulación S02-G001, Shader Graph ni pipeline global de render.
- Sin editor VFX completo, curvas en Inspector, preset vapor de café o preview aislada en Edit.
- PSX, WebGL GPU, prueba visual Editor/Player y compilación Vite **NO VERIFICADAS** en este contenedor. Los 50 tests ejecutados son pruebas Node de las rutas disponibles; las pruebas de runtime gráfico requieren la máquina del usuario.
- La prueba de paquete Player usa un contenedor ZIP sintético y una textura PNG procedimental propia; no representa QA visual ni un AppImage ejecutado.

La entrega incluye exactamente dos ZIP según la excepción LevelForge. El Excel conserva seis hojas y no declara cierre sin QA local y aprobación.

# LevelForge · CA-003 · Cinematics exclusivo y eliminación en Assets

Gate de implementación autorizado: `LF-CINEMATICS-LEGACY-CLEANUP-S05-G003`.
Fuente: decisión explícita del usuario de 2026-11-04, posterior a la aprobación local de `LF-CINEMATICS-VIEWER-S05-G002-INTEGRAL`.

## 1. Autoridad y cláusulas sustituidas

**CA-003 supersede exclusivamente las disposiciones de CA-002/S05-G002 que obligaban a mantener una superficie de creación/edición de clips heredados.** No se suprimen los sistemas de gameplay independientes ni se reescriben proyectos antiguos. Se conserva el contrato de origen verificable FilmMaker, separación `project.timelines` / `project.animations`, y preview seguro.

| Tema | Contrato G002 supersedido | Contrato CA-003 |
|---|---|---|
| Dock `clips` | Panel de editor heredado oculto y reabrible | Retirado del registro de docking y de sus layouts normalizados |
| `AnimationPanel.vue` | Editor heredado de autoría fuera de Cinematics | Eliminado como componente del Editor |
| Assets, clips de gameplay | Crear/editar desde Assets | No crea ni edita; conserva datos históricos y permite borrado manual explícito |
| Inspector CameraShake | Botón «Editar animación…» | Elimina el botón; la referencia al clip para gameplay sigue funcionando |
| Cinematics | Películas FilmMaker verificadas | Idéntico: solo consulta/importación/preview/reproducción, nunca autoría |
| `project.animations` | Colección persistente conservada | Colección/runtime conservados; sin migración ni borrado implícito |

La colección y APIs de animación usadas por el Player (`play-anim.js`, `CameraShake`, eventos) se preservan, así como clips importados por FilmMaker que los necesiten para actores. Los recursos históricos pueden seguir listándose como datos en Assets para permitir eliminación explícita, pero **nunca aparecen en Cinematics ni abren otro editor de animación**. Las funciones internas de creación/normalización de clips siguen disponibles para importadores y runtime; no son vías de autoría en Cinematics.

## 2. Eliminación de Timeline y Cinematics

- `embedded` indica proyección virtual en Assets; no prohíbe la eliminación de timelines o películas.
- Clic derecho → **Eliminar**, tecla **Supr** y selección múltiple utilizan la misma confirmación antes de modificar el proyecto.
- `Assets/Cinematics`, `Assets` y las carpetas de sistema permanecen protegidas. Renombrar, mover, arrastrar y exportar `.levelpackage` recursos embebidos siguen restringidos por sus contratos independientes.
- La eliminación de recursos temporales usa `deleteTimelines(ids)` en `state/timelines.js`, con **un solo commit** para selección múltiple de esos recursos. Limpia `timelineId`, `cinematicId`, `projSel`, `temporalSelection` y `temporalSeek` si corresponden.
- Antes de confirmar, `findTimelineUsage()` recorre las escenas cargadas y las persistidas no activas, eventos, prefabs, eventos comunes y otros timelines. Si no se puede examinar una escena, la operación se bloquea. Las referencias explícitas por nombre o ID aparecen en la advertencia. No se modifican silenciosamente.
- **Límite conocido:** no puede inferirse el destino de llamadas `game.timeline.play()` o de scripts que construyan nombres dinámicos. El diálogo advierte ese límite incluso si no aparecen referencias estáticas.
- Borrar una película no elimina otras tomas, montajes, clips, capturas de actores, modelos, scripts, fuentes `.nfm` ni assets compartidos. No hay cascadas de borrado.
- El borrado de un clip histórico de gameplay, cuando lo solicita el usuario desde Assets, advierte que puede estar referenciado por CameraShake/eventos/scripts. No se eliminan esos clips de forma automática.

## 3. Persistencia, historial y restauración

La película permanece representada únicamente por `project.timelines` y su marcador `filmMaker`, sin `project.cinematics`. El borrado y Deshacer/Rehacer utilizan el historial existente y la serialización `.lfproj`; no se crea un segundo motor ni almacén. Tras deshacer, el recurso reaparece disponible en Assets; no se reabre automáticamente una vista o selección que ya fue invalidada.

Los layouts guardados que contengan el panel legado `clips` se normalizan descartando únicamente esa identidad. El dock `anim` conserva el nombre visible Cinematics y su identidad técnica. Si `bottomTab` persistía como `clips`, pasa a `project`.

## 4. Límites y QA

No se autorizan: reescribir referencias tras borrado, convertir timelines en películas sin procedencia, borrar archivos de proyectos del usuario, cambiar los formatos `.nfm`/`.lfproj`, tocar Jolt, rehacer el runtime de clips o instalar la extensión VS Code. Las referencias dinámicas a nodos 3D siguen pendientes de otro Gate.

**Evidencia de implementación S05-G003:** Node 110/110 PASS (19 pruebas nuevas y 91 de regresión sobre contrato ya supersedido donde corresponde). Electron integrado, build Editor/Player, QA local y export Player **NO VERIFICADOS**; no declarar G003 CERRADO antes de QA local y aprobación del usuario. G002 tiene QA local aprobado declarado por el usuario el 4-Nov-2026 y se registra por separado.

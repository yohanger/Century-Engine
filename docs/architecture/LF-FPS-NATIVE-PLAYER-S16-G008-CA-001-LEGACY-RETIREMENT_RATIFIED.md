# LF-FPS-NATIVE-PLAYER-S16-G008-CA-001-LEGACY-RETIREMENT

**Estado contractual: RATIFICADO POR USUARIO, 2026-11-12.**

Declaración literal recibida:

> Ratifico LF-FPS-NATIVE-PLAYER-S16-G008-CA-001-LEGACY-RETIREMENT

Gate de implementación autorizado por separado:

> Listo. LF-FPS-NATIVE-PLAYER-S16-G008-INTEGRAL-LEGACY-REMOVAL autoriza comenzar

## Prelación y ámbito

Este Contract Amendment reemplaza **únicamente** la semántica transitoria de respaldo implícito del Player FPS definida en ID16-02 y en SPN-01: **la ausencia de `playerNodeId` no genera `FpsPlayer` ni activa una identidad de jugador por un nodo `Spawn`**.

Rigen en su lugar:

1. Con `playerNodeId` autoral válido, GameManager habilitado y cuerpo Jolt operativo: hay jugador `CharacterBody3D` nativo.
2. Con `playerSpawnMode: 'api'` y sin ID autoral, la escena inicia sin jugador hasta `game.spawnPlayer()`. No se permiten dos jugadores simultáneos.
3. Con ausencia de ambos: escena sin jugador; no hay fallback.
4. GameManager `none` o FilmMaker prohíben el jugador de gameplay. Los valores históricos de GameManager (por ejemplo `fps`) no activan controladores retirados.
5. En un proyecto nuevo de plantilla First Person solo se genera un sol y un Prefab FPS en Assets; no se crea un nodo Spawn en la escena.
6. Los datos de proyectos antiguos (incluidos nodos Spawn y marcas de guardado antiguas) **no se borran ni reinterpretan silenciosamente**. El tipo Spawn sigue registrado para lectura/edición de proyectos existentes, sin creación desde el menú. Las cargas antiguas sin jugador nativo no resucitan FpsPlayer: conservar datos no equivale a garantizar su gameplay anterior.
7. El control de movimiento/cámara pertenece a Scripts de Nodo, Jolt y Camera Orchestration. Database, ViewModel, Signals y SaveManager mantienen sus contratos vigentes.

No se autoriza migración destructiva, controlador oculto, modificación a Database ni comenzar G009. El cierre de G008 exige QA local, no solo pruebas Node.

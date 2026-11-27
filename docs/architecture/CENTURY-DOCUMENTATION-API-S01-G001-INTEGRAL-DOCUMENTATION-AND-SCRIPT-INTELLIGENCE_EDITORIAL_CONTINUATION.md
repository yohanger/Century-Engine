# Continuación editorial ratificada

La autorización literal del usuario conserva el Gate integral existente. El CHANGE anterior está aplicado según el usuario; su árbol local no fue inspeccionado. El portal público se limita al uso del motor. Se conservan instrucciones de integración útiles y se retiran de la publicación los detalles internos, sin borrar fuentes ni historia.

La declaración pública sigue siendo la única autoridad de tipos. Esta intervención añade documentación y preserva todas las firmas. Las copias de extensión se sincronizan mediante el mecanismo existente. No se modifica el runtime ni se resuelve unilateralmente ninguna discrepancia contractual.

## Discrepancias que requieren resolución

- `game.water`: declaración histórica deprecated; no expuesta por el literal público del intérprete. Conservar contrato pendiente de Amendment.
- `Player`: `src/engine/runtime/events/play-player.js`, `_playerApi`, construye un handle nativo a partir del nodo y no define `jumpNow`, `airTime`, `groundTime`, `inWater`, `swimming`, `underwater`, `waterDepth`, `waterLevel`, `water`, `current`, `breath`, `verticalSpeed` o `camera`. Esos nombres tampoco se identificaron en `play-nodes.js` ni en `MOVE_KEYS`. Se advierte en la referencia. Los accesores `x/y/z` no tienen setter, mientras `pitch` sí lo tiene; las declaraciones históricas discrepan. Los parámetros de configuración de agua presentes en `MOVE_KEYS` no acreditan simulación.
- `InputApi`: revisar retornos de operaciones mutadoras (`_inputOp` en `play-input.js`) frente a declaraciones; no se modifica contrato sin ratificación.

Los hallazgos son estáticos: requieren verificación durante Play, revisión de contratos y ratificación de cualquier modificación incompatible. No constituyen una nueva enmienda aprobada.

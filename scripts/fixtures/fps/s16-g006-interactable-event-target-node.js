// Variante para páginas de evento con disparador «Al recibir señal».
// Sustituye al receptor Signal de Nodo; no conectes ambos para la misma acción.
function _ready() {
  node.add_to_group('interactable')
  node.expose('interact', (actorId) => game.emit('fps_interaction', {
    actorId, targetId: node.id
  }))
}

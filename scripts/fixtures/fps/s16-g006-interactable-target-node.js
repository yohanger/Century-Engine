// Script de Nodo opcional del objeto interactivo. Se conecta por el sistema de Signals existente.
function _ready() {
  node.add_to_group('interactable')
  node.define_signal('interacted')
  node.expose('interact', (actorId) => {
    node.emit_signal('interacted', actorId)
  })
}

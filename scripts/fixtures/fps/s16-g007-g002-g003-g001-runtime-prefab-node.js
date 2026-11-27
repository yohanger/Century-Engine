// Prueba manual G003-G001: asignar a un Node3D ordinario.
// Crear un Prefab de prueba llamado «Caja QA» y la acción «qa_prefab» en Input Map.
// Cada pulsación crea o destruye la instancia temporal, sin guardar cambios autorales.
let caja = null

function _process(_delta) {
  if (!game.input.justPressed('qa_prefab')) return
  if (caja?.is_valid()) {
    game.prefabs.destroy(caja)
    caja = null
    return
  }
  caja = game.prefabs.instantiate('Caja QA', { position: [2, 2, 0] })
}

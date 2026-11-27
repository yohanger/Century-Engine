// Script Global de ejemplo para una escena configurada con Aparición por API.
// El personaje físico se crea una vez durante el evento de inicio.
let playerRoot = null

game.on('start', () => {
  if (game.player !== null) throw new Error('La escena debía comenzar sin jugador')
  playerRoot = game.spawnPlayer('Personaje FPS', { position: [0, 0, 0] })
  game.log(`Jugador nativo creado: ${playerRoot.id}`)
})

# Clima y efectos ambientales

Configura los fenómenos meteorológicos desde Escena → Clima. Consulta [Agua y fluidos](#/agua) para las limitaciones del agua obsoleta.

## Rayos físicos e impactos sobre el mundo

En **Escena → Clima**, habilita el clima y selecciona una tormenta, **Tipo de rayos: Físicos** y **Impactos físicos sobre el mundo**. Esa última opción está apagada en proyectos anteriores y no se aplica al modo de rayos sencillos.

El primer contacto compatible con Terrain, geometría estática o agua genera el evento `game.on('lightningImpact', (impact) => { ... })`. `impact` incluye `id`, `seed`, `peakKA`, `kind` (`terrain`, `object` o `water`), `point` `[x,y,z]`, `normal`, `ownerId`, `surface` y `materialId` cuando existen. Los eventos `lightning` y `thunder` permanecen disponibles con su retardo acústico.

Puedes activar **Impulsos Jolt** y configurar **Radio físico (m)** e **Impulso máx. (m/s)**; solo se aplica a cuerpos dinámicos compatibles ya registrados. **Perturbar agua** crea una ondulación de superficie sin añadir volumen. No existe electrocución, daño universal, fuego, electricidad en cables o propagación eléctrica por agua en esta versión.

**Limitaciones:** raycasts de objetos compatibles según el sistema actual de impactos; no garantiza intersección de todas las ramas contra cada malla o cuerpo Jolt. Los canales muy lejanos no se desplazan artificialmente hacia la cámara. Comprueba los impactos en Play y en el juego exportado.

## Tornados e interacción física

En **Escena → Clima**, activa el clima y **Tornado en escena**. Configura centro X/Y/Z, radio, altura, intensidad tangencial (m/s), duración, rumbo y velocidad de desplazamiento. Se admite un tornado por escena.

Para desplazar objetos físicos, activa **Afectar cuerpos Jolt**; se aplican impulsos limitados a `RigidBody3D` compatibles, mientras que los estáticos y las entidades gobernadas por Timeline no reciben esa fuerza. **Afectar jugador FPS** habilita una deriva separada de su cápsula Jolt, sin sustituir el controlador de movimiento. Ambos ajustes son optativos.

**Columna visual:** crea o reutiliza un recurso `.vfx` en Assets. En el Inspector de ese recurso selecciona **Espacio Mundo**. Asígnalo a un nodo `VFX3D` existente; después elige ese nodo en el campo **Emisor VFX3D del tornado** de Clima. El VFX no genera física ni partículas fuera de su nodo; cada instancia tiene su propia simulación. No se crea un tornado visual automáticamente si falta esta referencia. La posición original del emisor se restaura al detener Play.

Scripts: `game.on('tornadoStart', callback)`, `game.on('tornadoEnter', callback)`, `game.on('tornadoExit', callback)`, `game.on('tornadoEnd', callback)`. Los eventos contienen ID, posición mundial, dimensiones, edad y `objectId` cuando procede. No se aplica daño automático a enemigos ni destrucción de edificios. El sistema de agua y sus volúmenes permanecen intactos.

## Tornado destructivo: árboles, agua y brasas

En **Escena → Clima** habilita el tornado y, expresamente, las nuevas funciones de **vegetación destructible**, **agua suspendida** y **combustión** que necesites. Los tres efectos reaccionan a la intensidad y posición del viento.

En **Terrain → Vegetación**, configura por tipo **Destructible**, resistencia de raíz y tronco (newtons), **Combustible** y humedad. Los árboles permanecen en sus instancias optimizadas mientras la fuerza no supera sus límites. Cuando se desprenden durante Play, pasan a cuerpos Jolt acotados y la instancia original deja de dibujarse. Las formas procedurales compatibles admiten separación tronco/copa; una malla importada arbitraria no se fractura automáticamente.

Para agua levantada, selecciona un cuerpo de agua bajo el tornado y activa el transporte físico. Una región simulada descuenta de su inventario el agua suspendida; los cuerpos tradicionales actúan como fronteras externas. El agua vuelve a regiones compatibles o se registra como salida. El volumen y su conservación no dependen de partículas visibles.

En el Inspector de nodos compatibles, la sección **Combustión meteorológica** controla si puede arder, humedad, umbral térmico e ignición inicial. Los impactos físicos de rayo pueden encender fuentes cercanas. Lluvia, agua física y depósitos de agua suspendida pueden enfriar fuentes encendidas. El fuego se calcula mediante fuentes térmicas y brasas limitadas; no es incendio volumétrico de cualquier malla.

Los efectos visuales de agua y brasas deben vincularse a **VFX3D** existentes, con recursos `.vfx` reutilizables. Si el estado físico está inactivo, no se generan nuevas partículas del efecto condicionado. Sin recurso asignado no aparece un emisor global de sustitución. Los efectos no representan un sistema de inventario líquido alternativo.

**Límites:** máximo 64 paquetes de agua suspendida, 64 focos térmicos, 96 brasas y presupuesto configurado de árboles desprendidos. No hay CFD, fractura universal de edificios ni fuego realista sobre superficies no configuradas. Prueba el efecto en el juego exportado.

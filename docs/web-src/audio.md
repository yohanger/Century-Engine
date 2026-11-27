# Audio y animación

Century Engine incorpora fuentes de audio, Audio Mixer, animaciones de objetos y Timeline. Son sistemas distintos, aunque pueden coordinarse desde eventos y scripts.

## Audio

Las fuentes son nodos especializados y pueden utilizar grupos del mezclador. El runtime incorpora audio posicional y oclusión, que puedes comprobar en una escena de juego. Consulta `game.audio` en la [API](#/api-audioapi).

## Animación

En la raíz de Assets, elige **Crear → Clip de animación**. Haz doble clic en el recurso para editarlo en **Animación**. Para importar una captura, usa **Juego → Importar captura de movimiento (.lfcap)**. Las acciones de evento incluyen reproducir o detener animación; en script se pueden utilizar métodos de `game.animation` y del handle de nodo.

## Timeline

En **Timeline**, pulsa **Nuevo Timeline**, escribe un nombre y confirma. El recurso aparece en Assets y se abre en el editor de pistas. También puedes crearlo desde **Assets → Crear → Timeline**. La biblioteca permite buscar y cambiar de secuencia. El Timeline coordina secuencias y sus operaciones de reproducción y parada tienen API propia. Consulta la interfaz `TimelineApi`.

## Efectos de cámara

`CameraShakeBase` es un nodo de gameplay con recetas de movimiento visual. No cambia por sí solo la física del jugador. Puede activarse desde `game.cameraShake`.

## Lluvia: sonidos de impacto por superficie
En **Escena → Clima → Sonido del clima**, activa «Impactos por superficie» y añade perfiles de metal, piedra, tierra, hierba u otras superficies. Asigna clips de audio importados en Assets (hasta cuatro variantes por perfil), volumen, variación de tono y máximo de impactos por segundo. Los perfiles no generan sonidos de forma automática: sin clips hay silencio de impactos.

Cada material local o `.material` compartido también permite configurar **Impactos acústicos de lluvia** en el Inspector. Allí puedes activar el perfil, elegir superficie, añadir hasta ocho clips mediante selector o arrastrando desde Assets, escucharlos con ▶ y ajustar volumen, tono y límite. Si hay un perfil activo en el material, prevalece sobre el general de la escena; en su ausencia se utiliza la superficie de Layers, Terrain pintado o agua visible.

Los impactos utilizan audio posicional y el sistema de oclusión Web Audio existente. La lluvia ambiental continúa como bucle independiente: bajo un techo puede atenuarse mientras se oyen gotas golpeando la cubierta. La simulación física del agua no depende de estos sonidos. El muestreo de gotas visibles y un presupuesto global de voces evitan reproducir miles de clips simultáneos.

**Compatibilidad:** los proyectos antiguos mantienen esta función desactivada. Comprueba el resultado con los clips asignados en el juego exportado. No se incluyen archivos de sonido predeterminados.


Los timelines nativos admiten renombrar, duplicar, mover, copiar su ruta lógica, exportar como `.levelpackage` y eliminar desde Assets. El renombrado conserva el ID y bloquea referencias explícitas por nombre; las referencias escritas en scripts requieren revisión. Los paquetes incluyen las dependencias detectadas, pero los enlaces a nodos deben revisarse en la escena destino.

**Cinematics** reproduce exclusivamente películas importadas de Nether FilmMaker; su biblioteca permanece separada de la autoría de Timeline.

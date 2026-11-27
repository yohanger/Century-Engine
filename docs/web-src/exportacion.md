# Exportación y Player

La exportación de Century Engine produce un ejecutable que usa el runtime del motor, no el editor completo. El Player reutiliza `PlayMode` y las mismas rutas de scripting y física utilizadas durante la reproducción en el editor.

## Preparar un juego

1. Guarda el proyecto.
2. Configura el GameManager, el Spawn o una cámara principal según el tipo de juego.
3. Abre **Archivo → Exportar juego**.
4. Selecciona las escenas que se incluirán y su orden inicial.
5. Revisa los avisos del Build y ejecuta la exportación.

## Plataformas

Century incluye exportación integrada de AppImage para Linux. Las opciones de otras plataformas dependen de los mecanismos implementados y no deben darse por habilitadas sin comprobar la ventana Build de la versión instalada.

## Player y pruebas

Comprueba en el ejecutable independiente lo mismo que verificaste en PlayMode: referencias de escena, recursos, audio, scripts, cuerpos físicos, Input Map y guardados.

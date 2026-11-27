# LF-EDITOR-CAMERA-EDITMODE-CORR-G001

Corrección mínima: la cámara de perspectiva del editor inicia en (0,10,10) mirando al origen mediante OrbitControls. `resetSceneState` conserva sincronización, selección, historial y navegación, pero omite `frameAll` al abrir o cambiar escenas. No se modifica la cámara del Player, ni los eventos. La vista de edición pertenece a la sesión del editor y no al contenido de cada escena.

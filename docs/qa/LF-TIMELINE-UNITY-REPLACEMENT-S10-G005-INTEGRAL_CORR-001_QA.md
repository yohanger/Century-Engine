# QA de usuario — S10-G005 CORR-001

Estado: **PENDIENTE QA LOCAL**; la compilación en este entorno **NO VERIFICADA**.

## Preparación

Partir del SOURCE_BASELINE G005 INTEGRAL que ejecutó el usuario. Comparar y respaldar antes de aplicar CHANGE. No sobreescribir archivos locales sin comparación.

Desde la raíz del proyecto (`package.json`):

```bash
npm ci
node --test scripts/test-timeline-unity-replacement-s10-g005-corr001.mjs
npm run electron -- --build
```

Resultado esperado en la suite nueva con Vue instalado: **12 PASS, 0 FAIL**; si falta Vue, **11 PASS y 1 SKIP**. No confundir compilar con aprobar QA visual.

## Escenarios de aceptación

1. Abrir la Timeline en dock ancho y estrecho: se muestra un solo rótulo de recurso en la cabecera interna y `Vista previa` arriba. Crear/seleccionar Timeline sigue funcionando.
2. Desplazar la toolbar horizontalmente: se pueden alcanzar todos los botones, incluyendo Curvas, zoom, Snap, Mix, Ripple, Replace, Marcador, Clip y Opciones. No hay recortes ni controles ocultos en un panel pequeño.
3. Crear clips reales de cámara/nodo; arrastrar **el cuerpo** para moverlos y el **asa exterior derecha** para cambiar su duración. Cambiar modo de edición (Mix/Ripple/Replace). Repetir con duraciones cortas. No arrastrar el clip al intentar redimensionarlo.
4. En pistas camera/node con claves, mover un segmento y redimensionar usando su asa. Verificar que los círculos de claves no bloqueen el arrastre. Comandos y Naturaleza son eventos discretos y no inventan clips expandibles; física horneada permanece protegida.
5. En la regla, comprobar que el fin de duración se muestra como **punto amarillo**; arrastrar y usar flechas, comprobar que se respeta la duración mínima.
6. Abrir Curvas, seleccionar un canal y hacer doble clic **sobre la curva** entre claves: aparece una clave real en el tiempo y valor seleccionados y en Inspector. Probar Snap 0.1 s y Snap libre.
7. Eliminar una clave nueva con Supr o «Eliminar clave» y utilizar Undo/Redo. Intentar eliminar una clave referenciada por un clip: debe rechazarse sin dañar el clip. Repetir en pista bloqueada.
8. Panel de 300–400 px, 600 px y ampliado: ejes, etiquetas, claves y herramientas deben permanecer utilizables. Probar acoplado/desacoplado, zoom, pan, selector de canales y Bézier.
9. Guardar, cerrar y reabrir; comprobar clave nueva/eliminada, duración de clips, historial y reproducción igual entre Preview y Player. Verificar cabeceras fijas G001 y selección G002, modos G003, grupos G004.

## Evidencia que debe devolver el usuario

Salida de Node y `npm run electron -- --build`, dos capturas de la toolbar (ancha y estrecha), vídeo de clip moviéndose vs redimensionándose, curva con clave insertada y otro vídeo con eliminación/Undo. Informar para cada caso PASS/FAIL con observación. No declarar cierre sin aprobación explícita.

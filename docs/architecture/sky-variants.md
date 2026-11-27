# Especialización del cielo sin reducir detalle

`SkyVariants` conserva el shader atmosférico original y crea variantes de `ShaderMaterial` que sustituyen por constantes únicamente estados discretos conocidos: modo de cielo, disponibilidad del campo 3D, ausencia de condensación/organización de tornado, luz lunar exactamente nula y ausencia de cuerpos celestes. Las fórmulas de densidad, erosión, dispersión y composición permanecen iguales. No cambia resolución, ruido, cantidad de muestras, iluminación ni frecuencia de dibujo del cielo.

Las coordenadas, texturas, mezcla del condensado, tiempo y parámetros meteorológicos continúan en los uniformes compartidos con `Viewport.skyMat`. Un cambio de cámara o la evolución del volumen no recompila el programa. Al cambiar un estado discreto, la selección vuelve al shader genérico hasta que esté lista la variante correcta; no utiliza una variante del estado anterior.

Se usa `KHR_parallel_shader_compile` mediante `renderer.compileAsync`. Los contextos de canvas, compositor lineal y captura ambiental se preparan secuencialmente: Three consulta `currentProgram` mientras espera y no debe sustituirse por el siguiente destino antes de completar el anterior. Se restaura el render target, cara y mip previos. Un driver sin esta extensión conserva el shader original, sin provocar compilación síncrona por esta optimización.

La caché contiene como máximo ocho materiales, con uniformes compartidos y eliminación de entradas antiguas ya compiladas. No expulsa materiales con compilación pendiente. Un cambio de contexto invalida la generación y la disposición libera materiales y el destino auxiliar de compilación. Ese destino de 1×1 no es un pase de reconstrucción ni una reducción de resolución del cielo.

La selección se aplica al cielo principal y a la captura IBL. Esta última vuelve a seleccionar la variante después de modificar temporalmente los uniformes de tornado/flash y después de restaurarlos. Stats → Más métricas → «Cielo · programa» permite comprobar si está especializado, preparando una variante o utilizando el respaldo original.

El controlador de presupuesto conserva ahora `cloudScale = 1`: no reduce los pasos de nubes al aumentar la presión. Puede seguir gestionando AO, LOD y capturas según su configuración, pero las nubes solas ya no se anuncian como un actuador de reducción de calidad.

## Verificación

- `node --test scripts/test-sky-variants.mjs`: estados, fórmulas conservadas, compilación secuencial, transición segura, respaldo, contexto perdido, invalidación y límite de caché.
- `node --test scripts/test-sky-variants-electron.mjs`: 27 comprobaciones WebGL; compara buffers HDR completos en ocho casos: día, mezcla de condensado, cielo físico, HDRI, mapa 2D, nubes procedurales, astronomía nocturna y tornado.
- `npm run test:suite -- sky-quality`: ambos grupos.

La especialización puede cambiar mínimamente el redondeo del compilador GPU, como ocurre al optimizar cualquier programa de coma flotante. En el ensayo de `the_room` a 1280×720 se encontraron hasta cuatro canales HDR distintos entre 3.686.400, con diferencia máxima de 0,00048828125; las capturas RGB de pantalla fueron idénticas. En los ocho casos sintéticos de regresión HDR no hubo diferencias.

Estas comprobaciones no certifican todos los drivers ni garantizan 60 FPS en el juego completo. El shader genérico sigue siendo la referencia y el respaldo.

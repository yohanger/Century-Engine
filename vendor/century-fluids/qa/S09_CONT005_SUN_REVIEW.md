# Sol y revisión de espuma en S09 CONT-005

El usuario señaló que la espuma óptica parecía pintura y pidió que represente un fenómeno del agua. Se retiraron el atributo visual por vértice, el cálculo de la máscara, la modificación del material y el control de intensidad. El SOURCE_BASELINE y las capturas anteriores conservan esa etapa como historial.

## Iluminación del playground

El cielo y el disco solar se renderizan desde una dirección común al entorno de reflexión y a la luz direccional. El mapa de entorno se genera una vez al construir el visor. Se excluye el disco de alta intensidad del mapa filtrado y se preserva su aporte directo por la luz direccional, para evitar un punto quemado en la reflexión. Se ajustó el encuadre inicial para mostrar el sol, el horizonte y el agua. La iluminación se aplica en el consumidor Three.js y el solver utiliza su configuración física anterior.

Se conservan el tinte, la transparencia, las cuatro escenas, las vistas de partículas/superficie y el pulso por clic. Se verificó que cambiar el tinte o la transmisión en pausa no avanza el reloj. Arrastrar orbita, y el clic en la superficie programa un pulso para el siguiente paso. La prueba de pulso en el consumidor ESM confirmó masa invariante y penetración dentro del límite existente.

## QA y estado

- 143/143 pruebas Node y compilación TypeScript. La prueba de la máscara de espuma se retiró junto con la funcionalidad que verificaba.
- 3/3 pruebas Node con JoltPhysics.js WASM 1.1.0 real. Build Vite desde el consumidor ESM empaquetado.
- Brave 158 y WebGL, resolución de 1280×800. Captura del sol y su iluminación sobre el agua. La prueba de interacción comprobó tinte, transparencia, clic y órbita y una escena Jolt real. La regresión general recorrió las cuatro escenas y veinte transiciones sin errores de consola ni de recursos.
- El equilibrio hidrostático y el perfil interno de presión de referencia siguen pendientes. La espuma física y el vaso interactivo están definidos en la [propuesta pendiente de autorización](../docs/28_S09_CONT005_PROPUESTA_ESPUMA_FISICA_Y_VASO.md). S09 G001 CONT-005 sigue abierto. S08 permanece en pausa y S10 sigue sin autorización.

Arranque desde una copia nueva del SOURCE_BASELINE: `npm ci` y `npm run playground`. Para una prueba de build se usa `node tests/run_playground.mjs --build`. El arnés de Brave `tests/browser_water_qa.mjs` recibe la URL de Vite y el directorio de evidencias, con Playwright y Brave provistos en `PLAYWRIGHT_MODULE` y `BROWSER_EXECUTABLE`.

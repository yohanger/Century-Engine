# Espuma física subresuelta y vaso Jolt en S09 CONT-005

## Autoridad y alcance

Se verificó el ZIP SOURCE_BASELINE DAYLIGHT y su manifiesto. El usuario respondió «Claro» a la pregunta expresa de autorización de la [propuesta de espuma física y vaso](../docs/28_S09_CONT005_PROPUESTA_ESPUMA_FISICA_Y_VASO.md). La ejecución permanece bajo el mismo CONT-005 de S09 G001, con CF-CA-005 ratificado. S08 sigue en pausa y S10 sin autorización. Las cuatro escenas anteriores se conservan y el vaso tiene una escena propia de experimentación.

## Aire atrapado

El módulo de agua puede habilitar un escalar de volumen de aire por partícula. Se almacena en el mismo `ParticleStore` y conserva la asociación con el ID al redimensionar, drenar y mover elementos. Se publica junto con la cinemática validada al finalizar un paso. El solver usa los pares SPH existentes y su único subpaso. El planificador utiliza física global cuando el modelo de aire está habilitado, pues el reposo de agua no implica que el aire haya dejado de evolucionar.

La detección aproxima la interfaz con la cobertura de vecinos hacia arriba. La captación exige una parcela superior expuesta que se acerque a una parcela inferior que pertenezca a una lámina líquida. Usa la velocidad normal y vertical de aproximación, antes de la proyección, cerca del soporte SPH. El prototipo ensaya 0,48 m/s como umbral, un saldo máximo de aire del 12 % del volumen de líquido de una parcela, transferencia ascendente local y tiempos de liberación de 1,6 s en superficie y 6 s bajo cobertura de agua. Estos valores son parámetros de ensayo y faltan datos experimentales a la escala del playground para calibrarlos. Los glifos de burbujas se generan desde las posiciones y el volumen simulado. Al desaparecer el aire, desaparecen los glifos.

En un impacto de prueba, el aire llegó a 90,05 mL y se redujo a 1,01 mL tras 900 pasos. Hubo exactamente cero captación en los controles de reposo, traslación uniforme y perturbación sumergida de ocho pasos. En la presa se observó un máximo de 166,83 mL. El saldo por paso usa volumen anterior más captación menos liberación. El transporte ascendente redistribuye dentro de ese saldo. En el ensayo emparejado, posiciones, velocidades y masa de agua coincidieron con el modelo de aire desactivado. La densidad de mezcla y la retroacción del gas sobre el momento están fuera del perfil validado.

## Vaso

El vaso de Jolt tiene un único ID cinemático y una forma compuesta por cinco cajas. Su fondo mide 0,066 m de espesor y las paredes 0,070 m. La boca mide 0,32 × 0,32 m y el espaciado de partículas de la escena es 0,11 m. El puente reutiliza los contactos de caja y acumula reacción y par sobre el centro de masa del cuerpo compuesto. Para ese contorno predice las poses con el giro compartido y comprueba el segmento relativo entre poses. La aproximación se valida a las velocidades limitadas del manipulador, 0,48 m/s y 0,85 rad/s. Se deja una separación de al menos 0,068 m respecto a las caras del tanque para evitar atrapar partículas en huecos estrechos. El trabajo publicado es la estimación de contacto `−(J·v + L·ω)` acumulada por paso, con los impulsos sobre el vaso.

El ensayo de 1.235 pasos con JoltPhysics.js 1.1.0 en Node recogió **2,662 kg** y retuvo los mismos dos IDs al elevar, trasladar y sostener el vaso. Ambas partículas salieron al pasar por la boca durante el vertido. La masa total permaneció en 266,2 kg. La penetración máxima del fluido fue 6,86×10⁻¹⁵ m y el error máximo de balance de momento, al incluir gravedad y las reacciones de todos los contornos, fue 2,10×10⁻¹³ N·s. Se realizaron tres ciclos adicionales de reapertura. Este ensayo aún da **1.117/1.235** pasos con `iteration_limit`. El balance y la retención obtenidos no acreditan convergencia general ni presión hidrostática de esa escena.

## Reproducción

```bash
npm ci
npm run qa
node tests/run_playground.mjs --build
node tests/verify_playground_consumer.mjs
node tests/verify_cup_wasm.mjs
node tests/benchmark_water_foam.mjs off
node tests/benchmark_water_foam.mjs on
node tests/characterize_convergence.mjs
npm run preview --prefix playground -- --port 4178 --strictPort
```

El QA de ratón usa `tests/browser_physical_water_qa.mjs` con la URL del preview y un directorio de evidencia. Requiere el módulo de Playwright en `PLAYWRIGHT_MODULE` y el binario gráfico de Brave en `BROWSER_EXECUTABLE`. Usa el canvas real para el arrastre. El recorrido general del navegador incluye las cuatro escenas de origen y el vaso. La aceptación visual del usuario permanece pendiente.

## Mediciones locales

Node 26.13.1 sobre Intel Pentium Silver N5030. En la presa se ejecutaron tres repeticiones medidas de 180 pasos tras una repetición de calentamiento por configuración. Los tiempos de la superficie son del extractor CPU, sin GPU, y reflejan la carga variable de este host compartido.

| Medición | Aire desactivado | Aire habilitado |
| --- | ---: | ---: |
| Física P50 / P95 (ms) | 8,99 / 15,14 | 9,78 / 15,31 |
| Superficie P50 / P95 (ms) | 75,16 / 99,35 | 81,78 / 137,48 |
| RSS pico de proceso (MiB) | 148,48 | 147,43 |
| Pasos de presa con `iteration_limit` | 270/540 | 270/540 |

La prueba de impacto positiva empieza a captar en el primer paso de aproximación elegible del fixture. En la presa el primer evento aparece en el paso 37. La evolución continúa después de esa aproximación. Las mediciones se conservan sin extrapolar un presupuesto de 60 FPS, una mejora de memoria o una calibración experimental de espuma.

El nivel de corte visual del vaso se reduce a 0,68 para resolver las dos gotas del ensayo de elevación con la celda equilibrada de 0,08 m. Los volúmenes que aparecen en el visor siguen derivados de las posiciones, y el indicador de masa usa las partículas dentro del contorno interior. Se conservan valores de extracción anteriores en las demás escenas.

Los tanques de referencia conservan `iteration_limit` en 88/240 y 1/8 pasos. La densidad de mezcla validada, la presión interior, el equilibrio hidrostático y la aceptación visual siguen pendientes en CONT-005.


## Resultado del QA de interfaz

Compilaron TypeScript y Vite y pasaron 146/146 pruebas Node, 3/3 pruebas Jolt WASM de regresión y el ensayo del vaso con Jolt real. El ensayo final de elevación confirma 74 vértices visibles en el volumen del vaso con una celda de 0,08 m. La ruta de arrastre, elevación y vertido en Brave se ejecutó antes del ajuste final del nivel de corte, con 2,66 kg después de levantar y 0 kg después del vertido. Una repetición interactiva con el build final agotó la espera de recolección. El vaso depende del punto y del instante de inmersión.

En aquella corrida precedente, la presa produjo 12,53 FPS con el aire habilitado y 15,39 FPS sin el modelo. El heap V8 al final de cada ventana fue de 23,56 y 20,35 MiB respectivamente. Son ventanas locales, con la misma resolución de 1280×800. La captura de espuma del build final, los JSON y los resultados de la prueba física figuran en `CONT005_physical_water`.

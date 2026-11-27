# Century Fluids · seguimiento de S09 CONT-005

El Gate `CENTURY-FLUIDS-S09-G001-CONT-005-INTEGRAL-PHYSICS-STABILITY-PERFORMANCE-AND-PLAYGROUND-QA` permanece abierto en S09 G001. CF-CA-005 sigue ratificado. Se conservan los once Sprints S00–S10, S08 EN PAUSA y S10 NO AUTORIZADO.

La ruta indicada por el usuario contiene la copia extraída de CONT-005. Se comprobaron los 164 hashes de `qa/MANIFEST.sha256` y se trabajó en copias aisladas. El ZIP de entrada no estaba disponible. Para validar el delta se reconstruyó un ZIP local con esos 164 archivos más su manifiesto. Su hash identifica esa reconstrucción. El hash del manifiesto original identifica el contenido que se usó para comparar.

## Solver, presión y contactos

- El orden auditado es gravedad y viscosidad, proyección de divergencia y densidad, integración con contacto, proyección de soporte opcional, diagnóstico final y publicación. La proyección de soporte actúa sobre velocidades en las posiciones finales. Se reutilizan los pares y las restricciones de estas posiciones entre diagnóstico, evaluación final e inicio del siguiente subpaso. La reacción de cada contacto sigue en el acumulador que consume Jolt.
- Los tanques de referencia conservan las configuraciones anteriores. El 4³ reporta **88/240** pasos con `iteration_limit` y el 6³ **1/8**. Las proyecciones previas al contacto cumplieron sus límites en ambos ensayos. El residual final supera 0,05 s⁻¹ en los pasos marcados. El primer paso 4³ llega a 0,333 s⁻¹ tras contactos aun cuando su residual previo es cero.
- Se ensayó un barrido de presión secuencial en los contactos, que dio 104/240 y 2/8. Proyectar el soporte antes del avance dio 60/240 y 1/8, con velocidad media final 0,0613 m/s frente a 0,0414 m/s del baseline 4³. Continuar ensayando rondas de residual no monótono dio 25/240 y 1/8, pero la velocidad máxima final subió de 0,1273 a 0,1863 m/s. Se descartaron las tres variantes. Las mediciones conservan la tolerancia y el diagnóstico real.
- El replay 4³ de 1.200 pasos incluye un impulso horizontal de 0,35 m/s por masa en una partícula en el paso 961. El estado de partículas y los informes produjeron el mismo SHA-256 en ambas versiones en el mismo host. La masa fue 85,184 kg, el error máximo de balance de momento fue 8,62×10⁻¹⁴ N·s y la penetración se mantuvo en 0 m. La compresión relativa máxima reportada fue 0. La fuerza media del suelo durante el segundo previo a la perturbación fue 835,655 N, frente a 835,655 N de peso. La tracción uniforme equivalente sobre la planta fue 1.485,609 Pa. Esa magnitud integra la reacción en el suelo. Falta acreditar el perfil interno de presión.
- La velocidad media 4³ fue 0,0105 m/s antes de perturbar, 0,0240 m/s justo después y 0,0182 m/s al final. El replay reportó 93/1.200 pasos con `iteration_limit`. El reposo volumétrico gravitacional queda pendiente. Para cambiar la proyección se requiere una corrección coherente presión-soporte que supere simultáneamente las pruebas de residual, energía, deriva, momento y casos dinámicos.

## Reposo regional

Con gravedad o fronteras inciertas se usa el cálculo global. En el caso regional sin fuerzas externas ni contornos, un chunk activo contagia la activación a todos los chunks alcanzables por el radio SPH y el desplazamiento CFL conservador. Se recorre el conjunto de chunks recién activados porque la presión puede propagarse por una cadena de partículas en un mismo paso. La regresión verifica igualdad con el solver global y conserva un chunk aislado en reposo.

Se comprobó una capa conectada de 25 partículas exactamente apoyadas sobre un plano. Durante 64 pasos, la certificación existente reprodujo las reacciones y el estado del solver global. Un impulso a una partícula reactivó el solver. La certificación aplica a ese punto fijo discreto. La extensión a un volumen conectado multicapa bajo gravedad sigue pendiente.

## Agua y Jolt en el playground

- El tanque original contiene 110,592 kg, equivalentes a 0,1106 m³ a densidad de referencia. Su planta de 2,90 × 1,90 m implicaba una profundidad uniforme de 0,0201 m, menor que el diámetro de contacto de 0,060 m y que el espaciado de 0,120 m. Tras extenderse, el agua quedaba distribuida en gotas. El tanque nuevo tiene planta de 0,68 × 0,68 m con la misma masa. A los 360 pasos, la malla del tanque nuevo forma un componente conectado. Se ajustaron también la columna de presa y el trayecto hacia el obstáculo.
- La superficie física reconstruida ahora es la vista predeterminada. La malla usa transmisión, índice de refracción 1,333, reflejo ambiental y recorte en los planos del tanque. El modo de partículas y el modo combinado siguen disponibles. El intervalo inicial de superficie es 100 ms y la aplicación omite actualizaciones cuando el tiempo simulado no cambió. La malla sigue derivada de las posiciones del solver.
- El campo implícito conserva el kernel compacto, el umbral y las normales analíticas. Se acumula cada contribución en los nodos que puede alcanzar y se omiten cubos de signo uniforme antes de recorrer tetraedros. Se probaron volúmenes, orientación, gotas aisladas, reutilización de chunks y coincidencia de costuras.
- El host crea los cuerpos rígidos solo al abrir la escena de flotación. Sus cinco cajas reproducen el suelo y las paredes del tanque para Jolt. El puente conserva el orden `bridge.step(dt)` → `Jolt.Step(dt, 1)`. La esfera de radio 0,16 m y densidad 940 kg/m³ usa detección continua lineal y contacto fluido sin fricción en esta escena de ensayo. El test de torque real independiente sigue usando contacto fuera de centro con fricción.
- El ensayo de producción Node del playground verificó 360 pasos de tanque, presa y obstáculo y 1.200 pasos de flotación. La esfera quedó contenida, alcanzó 0,360 m en la muestra de 240 pasos y terminó apoyada a 0,160 m de altura. El máximo de penetración de fluido en flotación fue 4,24×10⁻⁸ m y hubo 134/1.200 `iteration_limit`. El baseline anterior llegó a una penetración no resuelta de 0,0388 m en flotación. Variantes ligeras también mostraron inestabilidad. La flotabilidad se comprueba por impulso y respuesta real de Jolt. El reposo de una esfera flotando libremente y la estabilidad general del acoplamiento explícito quedan pendientes.

## Reproducción

```bash
npm ci
npm install --prefix tests/jolt-real --no-save --package-lock=false --ignore-scripts
python3 qa/verify_s09_cont005.py --project . --jolt --browser-build
node tests/characterize_convergence.mjs
node tests/benchmark_cont005_ab.mjs . . playground
node tests/benchmark_cont005_ab.mjs . /ruta/baseline-extraido reference
npm run preview --prefix playground -- --port 4175 --strictPort
```

Para repetir A/B preparar y compilar ambas versiones. Ejecutar el arnés de referencia una vez por versión con el mismo segundo argumento, la copia extraída anterior. Reporta percentiles de 540 pasos y 45 actualizaciones de superficie por escena después de una repetición de calentamiento. En modo `playground` usa las escenas propias de cada versión y sus respectivos consumidores instalados. Los resultados JSON completos están en `qa/CONT005_followup/`.

Para QA gráfico automatizado instalar Playwright en un directorio de herramientas separado de Century Fluids y apuntar a Brave como ejecutable local. Con el servidor Vite ya levantado:

```bash
PLAYWRIGHT_MODULE=/ruta/playwright/index.mjs BROWSER_EXECUTABLE=/ruta/brave \
  node tests/browser_cont005_qa.mjs http://127.0.0.1:4175/ /ruta/evidencia
```

La automatización comprueba montaje del canvas, estado de Jolt WASM, cuatro escenas, paso, pausa/reproducción, cambio de calidad y representación, reinicio y veinte transiciones. Las capturas corresponden al recorrido automatizado. La aceptación visual y de rendimiento del usuario sigue pendiente.

## Mediciones A/B

Host compartido con carga de escritorio, Linux 6.14, Intel Pentium Silver N5030 y UHD Graphics 605 / Mesa 25.0.7. Node 26.13.1, TypeScript 5.8.3, Vite 8.3.8 y JoltPhysics.js 1.1.0. Brave 158.1.100.58 (motor Chromium 158.0.8127.42), escritorio a 1280×800 y DPR 1. Los resultados corresponden a dos ejecuciones por comparación en este equipo, una por versión.

| Fixture anterior idéntico | Física CPU P50 / P95 anterior → actual (ms) | Actualización de superficie CPU P50 / P95 anterior → actual (ms) |
| --- | ---: | ---: |
| Tanque | 5,05 / 8,12 → 3,21 / 4,91 | 636,55 / 770,12 → 41,50 / 72,18 |
| Presa | 8,69 / 18,07 → 6,20 / 9,95 | 634,07 / 1.072,35 → 75,34 / 101,93 |
| Obstáculo | 6,43 / 10,34 → 4,77 / 7,68 | 617,05 / 756,69 → 55,16 / 81,62 |

El RSS pico de ese proceso Node pasó de 149,5 a 162,8 MiB. El pico incluye V8 y buffers de todo el ensayo. El sentido de la métrica difiere del heap usado del navegador. Se incluye el detalle de ambas.

| Escena en Brave con la configuración inicial de cada versión | FPS anterior → actual | Tiempo simulado en la ventana anterior → actual |
| --- | ---: | ---: |
| Tanque | 1,52 → 11,20 | 0,53 → 2,38 s |
| Presa | 2,69 → 7,39 | 0,70 → 1,66 s |
| Obstáculo | 1,66 → 13,28 | 0,50 → 2,80 s |
| Flotación | 2,07 → 13,55 | 0,56 → 2,92 s |

Brave mide intervalos de animación en ventanas de al menos 6,5 s por escena, con WebGL real. La comparación integra cambios de tamaño de escena, presentación, intervalo de malla y extracción de superficie. Los FPS siguen por debajo de 60 en los cuatro casos y el reloj descartó pasos en todas las ventanas. Los JSON incluyen tiempo de envío CPU, frames, heap y pasos descartados. La memoria del heap de V8 tras veinte transiciones fue 32,15 → 21,96 MiB en las dos muestras CDP. La memoria GPU total y la existencia de fugas a largo plazo quedan pendientes.

En la prueba geométrica a los 360 pasos del tanque, el baseline tenía 30 componentes de triángulos conectados y el mayor concentraba el 10,9 % de los triángulos. La malla actual tiene un único componente con el 100 %. Las capturas de tanque se tomaron durante recorridos con duración simulada distinta. La comparación exacta de conectividad se hizo a paso fijo y está en los JSON del playground.

## Resultado y evidencias

- Suite Node y compilación TypeScript **143/143**. Jolt WASM real Node **3/3**. Build Vite y empaquetado del consumidor verificados.
- Brave ejecutó las cuatro escenas, verificó los controles y completó veinte transiciones. El recorrido actual no registró errores de consola ni de recursos. Las capturas, muestras y diagnóstico están en `CONT005_followup/brave-after/`.
- Siguen pendientes la convergencia de los tanques de referencia, la validación del equilibrio hidrostático volumétrico y del perfil de presión, el reposo gravitacional parcial y la estabilidad general de flotación. La aceptación visual y de rendimiento del usuario queda pendiente. CONT-005 sigue abierto y no se propone aprobación integral.

## Aplicación del CHANGE

Validar primero la copia anterior con `sha256sum -c qa/MANIFEST.sha256`. El SHA-256 de ese manifiesto es `516bcc86f3524599bb991c4d2491e9626984522f161d774267839b6e75a5392c`. Superponer sobre una copia los archivos bajo `CENTURY_FLUIDS/` del CHANGE y volver a validar el manifiesto resultante. `CHANGE_REMOVALS.json` acredita cero eliminaciones y registra el hash del manifiesto de entrada. El SOURCE_BASELINE incorpora el árbol completo. Ambos paquetes excluyen builds, tarballs y cachés.

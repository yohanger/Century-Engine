# CONT-005 · Agua en orilla y referencia visual

**Alcance:** CONT-005 abierto. CF-CA-005 ratificado. S08 EN PAUSA. S10 NO AUTORIZADO.

## Comparación con el video facilitado

Se revisó el archivo MP4 local. Hacia 00:37, en la playa, se observa arena a través de la lámina somera, cambio de color con la profundidad y espuma en el frente al romper. Hacia 07:15 y 07:52, en el tramo de roca, hay reflejos fragmentados, espuma localizada e irregular y agua que sigue el relieve. El ensayo usa una orilla contenida y recursos gráficos originales. Quedan fuera de esta comparación la escala y extensión del océano.

## Implementación

- **Física.** La escena de 320 partículas usa la frontera de mapa de alturas existente. Una frontera móvil con velocidad derivada del mismo paso físico genera olas sobre la pendiente. El clic conserva la inyección de impulso existente. Ni la iluminación ni la malla aportan fuerzas.
- **Aire.** La captación vertical se conserva. El caso oblicuo exige una partícula incidente expuesta, un receptor próximo a la interfaz apoyado por líquido y velocidades relativas de cierre normal y descenso. El transporte, la flotación subresuelta y la disipación del aire siguen usando el estado por partícula. La concentración y el saldo se pueden observar con o sin render. El aire todavía es un cierre subresuelto unidireccional, sin fuerzas de realimentación ni tamaños discretos de burbuja verificados experimentalmente.
- **Superficie.** Se reutiliza la extracción por chunks. Para la orilla, el espacio de reconstrucción es más ancho en horizontal que en vertical. Se aplica la transformación a una copia de las coordenadas y se devuelve la geometría a metros antes de mostrarla. El ángulo de la superficie, el fondo de terreno y los metros de profundidad gobiernan los reflejos, la refracción y la absorción. Las ondulaciones menores que la malla alteran las normales ópticas con el tiempo de la simulación. La arena se oscurece al mojarse con partículas próximas al terreno y recupera claridad al secarse.
- **Espuma visible en todas las escenas.** El atributo de dispersión se pondera por la distancia al aire que transporta el agua. Con cero aire la contribución es cero. El grano dentro de esa huella da estructura a la representación. Se retiran los glifos esféricos del playground. Las texturas de arena y roca son originales, generadas para este ensayo. El video se usa como referencia y sus imágenes permanecen fuera de los paquetes.

## Evidencia y limitaciones

El escenario de orilla es un ensayo controlado de pocos metros. No se demuestra paridad visual con el video y la aceptación visual corresponde al usuario. Las crestas siguen limitadas por el espaciado y el coste de la simulación. El modelo de espuma requiere una calibración experimental antes de extrapolar a una escala oceánica. CONT-005 conserva sus criterios de convergencia, reposo regional, rendimiento y aceptación visual. Véase el [contrato vigente](../docs/27_S09_CONT005_INTEGRAL_PHYSICS_STABILITY_PERFORMANCE_AND_PLAYGROUND_QA.md).

Para repetir el perfil numérico desde la raíz, prepara el consumidor con `node tests/run_playground.mjs --build` y ejecuta `node tests/measure_cont005_shore.mjs CAMINO.json`. El perfil usa 540 pasos de 1/120 s en cada variante. Reporta el máximo error por paso después de contabilizar gravedad e impulsos sobre las fronteras, y contabiliza por separado el saldo de aire. Las mediciones de CPU y del navegador describen la máquina ensayada. No se extrapolan a producción ni son una promesa de rendimiento.

### Ensayo físico de 4,5 s por variante

| Variante | Frente máximo Z | Aire máximo | Límites de iteración |
| --- | ---: | ---: | ---: |
| Batidor móvil, con aire | 0,551 m | 137,4 mL | 438/540 |
| Batidor móvil, sin aire | 0,551 m | 0 mL | 438/540 |
| Batidor fijo, con aire | 0,209 m | 17,4 mL | 415/540 |

La coordenada de avance es común a los tres ensayos. Con el batidor móvil el frente también retrocedió hasta Z = 0,123 m después del segundo 2. El control con el batidor fijo registra captación durante el asentamiento de las capas iniciales. Los controles de calma, traslación uniforme y movimiento sumergido están separados en las pruebas del módulo. Se conservaron 214,375 kg de agua en todos los pasos. Las posiciones con y sin aire fueron idénticas en la variante móvil. El error máximo por paso del balance de momento fue 1,15 × 10⁻¹² N·s y la penetración máxima de frontera, 9,1 × 10⁻¹⁵ m. El error máximo del balance del aire en la variante móvil fue 1,63 × 10⁻¹⁹ m³.

El modelo anterior de impacto vertical, aplicado al primer ensayo de esta misma orilla, dio un pico de 5,18 mL. Esta comparación mide la respuesta de las reglas de captación en el escenario, no precisión física a escala de playa. Las pruebas del módulo distinguen impacto oblicuo de roce y separación. Los tanques de referencia del Gate conservan los resultados pendientes (88/240 y 1/8). El valor de 438/540 corresponde a la escena nueva y es un resultado distinto.

### Perfil CPU y distribución

En Node 26.13.1 sobre Intel Pentium Silver N5030, la variante con batidor y aire tuvo mediana/p95 de **36,3/50,6 ms** por paso, tras 60 pasos de calentamiento. La reconstrucción por chunks a 0,06 m, medida cada 12 pasos, tuvo **190,7/264,4 ms**. El perfil sin aire registró **33,7/53,7 ms** por paso y **172,1/207,8 ms** por actualización de superficie. Los ensayos son secuenciales. Estas cifras identifican el coste del caso, sin aislar una mejora de rendimiento del solver ni representar FPS reales.

TypeScript y el build de producción de Vite pasaron. La suite Node completa aprobó 147/147 casos en serie con el binario TypeScript local en `PATH`. JoltPhysics.js WASM 1.1.0 aprobó sus tres pruebas reales. Los registros se conservan en [CONT005_shore](CONT005_shore/).

### Brave con Vite de producción

Brave 158.0.8127.42, visible, resolución 1000 × 660 y ANGLE en Intel UHD 605. Se cargó Jolt WASM real. Se recorrieron las seis escenas, incluidas las cuatro originales, con malla visible y pausa comprobada. En la orilla, el clic dejó un pulso preparado en pausa y se efectuó un paso manual. El control de aire reinició la escena y el indicador pasó a «Desactivado». Los PNG y el registro JSON se guardan en [brave](CONT005_shore/brave/).

Con calidad equilibrada e intervalo de malla de 100 ms, los dos puntos de observación en movimiento de la orilla dieron **3 FPS**, **34,5–44,4 ms** por paso informado, **179,9–201,4 ms** por actualización de malla, **3,4–4,7 ms** para enviar el render y **31,3–53,8 MiB** de heap JS. Hubo pasos descartados por el presupuesto del reloj. Los FPS del HUD están redondeados. El tiempo de envío del render excluye trabajo asíncrono de GPU y el heap excluye WASM y memoria gráfica. El clip local carece de un caso físico comparable y el baseline anterior carece de escena de orilla, por lo que estos datos no establecen una ganancia A/B de FPS.

En la captura de la compilación entregada se distingue el fondo en agua somera y se ven reflejos, avance y un borde mojado. Persisten crestas gruesas y discontinuidades aguas arriba. Los controles y mediciones acreditan el funcionamiento en este equipo, con paridad y aceptación del usuario todavía pendientes.

### A/B contra el SOURCE_BASELINE de espuma y vaso

Se abrieron builds de producción del baseline anterior y de esta entrega en el mismo Brave con aceleración Intel y resolución de 1000 × 660. Se usó vista de superficie, calidad equilibrada, malla cada 100 ms, velocidad 1× y espuma activada. Los casos comunes empezaron a medirse al alcanzar al menos 0,25 s de simulación. Se tomó una ventana de seis segundos de reloj por variante, contando fotogramas reales de `requestAnimationFrame` y muestreando los tiempos del HUD. Se invirtió el orden entre los dos casos. [Muestras sin agregar](CONT005_shore/browser-ab.json).

| Escena | FPS antes → ahora | Paso físico, mediana | Superficie, mediana | Envío del render, mediana | Heap JS, mediana |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tanque | 18,73 → 18,73 | 4,6 → 4,6 ms | 39,7 → 39,1 ms | 2,1 → 2,0 ms | 25,2 → 26,0 MiB |
| Rotura de presa | 12,93 → 12,40 | 6,9 → 7,1 ms | 68,2 → 68,6 ms | 3,4 → 3,8 ms | 28,8 → 30,6 MiB |

En esta muestra el tanque se mantuvo y la presa perdió 0,53 FPS. La ventana única por variante da un resultado descriptivo, insuficiente para atribuir ese cambio con confianza o extrapolar a otras escenas. La muestra de orilla se reporta por separado.

# Apariencia del agua y pulso interactivo en S09 CONT-005

**Autoridad.** Se verificó el SOURCE_BASELINE anterior en ZIP y se trabajó sobre una copia. El usuario aprobó la entrega anterior y pidió corregir la separación, representar espuma, ajustar el color y agitar el agua con un clic. El ajuste de geometría y material pertenece a la visualización del playground autorizada por CF-CA-004. El clic es una perturbación de QA que consume el método público existente `FluidWorld.applyParticleImpulses()`. S09 G001 y CONT-005 permanecen abiertos. CF-CA-005 sigue ratificado, con S08 EN PAUSA y S10 NO AUTORIZADO.

## Qué producía la separación

A los pasos 60 y 96 del tanque, las 64 partículas formaban un componente en la vecindad SPH de 0,30 m. La malla equilibrada de 0,08 m tenía cinco componentes. La vecindad del solver y el nivel de corte de la superficie tienen radios y criterios distintos. La brecha aparecía también en la extracción global, lo que permite localizarla en la reconstrucción y no atribuirla a las costuras de los chunks.

En el consumidor de agua del playground, el radio de influencia visual pasa de 0,160 a 0,185 m y el nivel de corte de 0,75 a 0,95. Se conservan el extractor, las normales analíticas y los parámetros públicos del módulo. Se midieron quince pares de capturas con el mismo estado y la misma celda de 0,08 m. El arnés une vértices de chunks por coordenada con tolerancia de 1 µm y cuenta componentes a partir de los índices.

| Fixture y paso | Componentes anteriores → actuales |
| --- | ---: |
| Tanque, 60 | 5 → 1 |
| Tanque, 96 | 5 → 1 |
| Presa, 36 / 60 / 96 | 3/3/3 → 2/1/2 |
| Presa, 360 | 2 → 2 |
| Obstáculo, 60 / 96 / 144 / 360 | 3/4/4/2 → 1/1/1/1 |

Se conserva la separación de gotas cuando el campo de reconstrucción queda bajo el umbral. La malla puede subresolver gotas pequeñas con la cuadrícula gruesa. El ajuste del campo del playground preserva la dinámica medida. Los problemas pendientes del solver de referencia siguen registrados en la revisión anterior.

## Controles del playground

- **Apariencia del agua** permite graduar el color, la transparencia y la espuma. Se puede ajustar en pausa. El sombreado de espuma combina la dispersión local de velocidades de las partículas y la orientación expuesta de la superficie. El mismo transporte uniforme de todas las partículas produce cero espuma en la prueba. El efecto es óptico, con un patrón local de sombreado. Un modelo de espuma persistente o de aire incorporado requeriría especificación física y autorización adicionales.
- Un **clic izquierdo sobre la superficie** programa un impulso localizado para el siguiente paso físico. El impulso vertical se distribuye por distancia en las partículas reales, con incremento local limitado a 0,8 m/s. Arrastrar conserva la órbita y el clic sobre el fondo o un sólido visible se descarta. El modo «Solo partículas» oculta la superficie seleccionable. En pausa, el impulso espera a «Paso +1» o a reanudar. El control usa el reloj del host existente.
- La comprobación del consumidor ESM compara dos mundos iguales con y sin el clic, prueba la masa y el impulso vertical, y avanza 90 pasos con el mismo límite de penetración. La escena habitual de flotación sigue usando Jolt WASM real cuando está disponible.

## Evidencia y reproducción

```bash
npm ci
npm run qa
node tests/run_playground.mjs --build
node tests/verify_playground_consumer.mjs
node tests/characterize_water_surface.mjs /ruta/baseline-anterior .
npm run preview --prefix playground -- --port 4176 --strictPort
```

Para repetir el conteo A/B se necesita compilar e instalar el consumidor de ambos árboles. La regresión visual usa Brave 158 con WebGL a 1280×800. `tests/browser_water_qa.mjs` recibe la URL de Vite y un directorio de evidencias, con el módulo de Playwright en `PLAYWRIGHT_MODULE` y el ejecutable local en `BROWSER_EXECUTABLE`. Compara el canvas en pausa al cambiar color, transparencia y espuma, comprueba que arrastrar no aplica un pulso, hace clic sobre la superficie y verifica el avance posterior y Jolt WASM real.

Pasaron 144/144 pruebas Node y 3/3 pruebas Jolt WASM. Vite compiló y Brave completó las cuatro escenas y veinte transiciones con WebGL. El directorio `CONT005_water` conserva los resultados de Node/TypeScript, Jolt, build Vite, recuentos de malla y capturas de la interacción automatizada. La aceptación visual de esta revisión queda pendiente.

> **Revisión posterior.** La espuma óptica se retiró a petición del usuario. Las capturas y mediciones anteriores se conservan como historial. La validación del sol y la propuesta de espuma física y vaso se documentan en los archivos de esta entrega.

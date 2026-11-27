# CF-CA-006 Agua voxelizada

Ratificado por el usuario el 20 de noviembre de 2026. Autorización literal de ejecución dentro del Gate existente `CENTURY-FLUIDS-S09-G001-INTEGRAL-PERFORMANCE-AND-STABILITY`. La aceptación integral sigue sujeta a la comparación y a la revisión del usuario.

## Autoridad y consumo

`FluidWorld` y `createWaterWorld` crean el mismo mundo voxelizado. La masa vive en los volúmenes de celdas almacenadas por chunks. `fillBox` y `drainBox` devuelven los m³ que pudieron ingresar o extraerse. `cells`, `cellAt` y `volumeInBox` consultan el estado. Se dimensiona la cuadrícula en campo `cellSizeMeters` de las opciones voxel. El reloj pertenece al consumidor. Los contornos se describen en unidades SI mediante planos, esferas, cajas y terrenos de altura.

La actualización por celdas activadas, caída por caras vecinas y render separado se inspira en las [reglas de Luanti](https://raw.githubusercontent.com/luanti-org/luanti/master/src/servermap.cpp). El núcleo original de Century Fluids conserva el volumen mediante transferencias debitadas y acreditadas en el mismo paso. El paso rechaza y revierte cambios de volumen si supera el presupuesto o queda agua desplazada sin salida admisible. El modelo es de juego y aproxima la altura hidráulica, el transporte, el arrastre y la flotabilidad. Requiere gravedad cero o hacia −Y.

`@century/fluids/surface` entrega deltas de geometría y atributos de profundidad y agitación mediante `VoxelSurfaceCache`. Three.js y el sombreado de agua viven en el playground. La espuma deriva del movimiento para este modelo. La malla se obtiene a partir de un campo 3D compartido. Las teselas comparten posiciones y normales en las costuras y el playground interpola vértices entre actualizaciones para dar continuidad al movimiento. La profundidad óptica y la superficie interpolada solo intervienen en el dibujo. El puerto Jolt es opcional y conserva un único `Jolt.Step(dt)` del consumidor. Cerca de sólidos, el volumen libre y las aperturas usan muestreo. La resolución debe representar las paredes y aberturas relevantes de la escena.

## Compatibilidad y pruebas

La compilación parte de las cuatro entradas ESM existentes. Los archivos históricos de SPH, partículas, espuma y su puente Jolt están preservados para reproducibilidad. Los consumidores que dependían de IDs de partículas o diagnósticos SPH deben migrar al contrato de volumen y actividad. Las pruebas antiguas que dependen de esos APIs se ejecutan en la referencia fijada. El nuevo paquete contiene un solo solver activo.

En una copia de trabajo, compilar el candidato y ejecutar `node --test tests/voxel_physics.test.mjs`. `node tests/run_playground.mjs --build` empaqueta e instala el candidato en el visor. Después, `node tests/verify_voxel_cup.mjs` ensaya el vaso con el mismo Jolt WASM que usa el visor. Para una comparación, compilar ambas versiones y preparar el playground de cada una. Ejecutar `node tests/benchmark_voxel_ab.mjs RUTA_SPH RUTA_VOXEL RUTA_JSON`. Este runner fija escenas, masa inicial, gravedad y paso del host, y mide física, malla, memoria de proceso y observables comunes en procesos separados. Los límites de equivalencia incluyen el muestreo espacial de cada solver y la cuantización del drenaje en SPH.

S08 y S10 mantienen su estado contractual. El trabajo de implementación y QA del candidato pertenece al mismo S09-G001. No declara cierre ni release.

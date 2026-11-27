# LF-STAIRS-SIDES-G001 — Laterales configurables de Escalera

## Contrato autorizado

Extiende la primitiva **Escalera existente**, sin crear nodos, generadores alternativos ni sistemas de materiales adicionales. `props.sides` selecciona `none`, `left`, `right` o `both`. Los parapetos siguen las huellas de cada escalón en los recorridos rectos y curvos; su altura (`props.sideHeight`, 0.1–5 m) y grosor (`props.sideThickness`, 0.05–2 m) son métricos y se proyectan **fuera** del ancho útil X. Valores iniciales: sin laterales, 1 m de altura y 0.15 m de grosor.

Las caras laterales estructurales de la Escalera **no se eliminan**. Los parapetos son volúmenes cerrados adicionales que comparten el objeto PolyMesh y están adyacentes a la Escalera, sin penetrar su ancho útil. Su representación permite mallas con varios componentes cerrados; no se promete unión booleana ni un único sólido conexo. No se incorporan barandillas, pasamanos ni postes. El material es el de la Escalera existente.

`turn=0` y `sides=none` mantienen la geometría anterior y las cajas Godot históricas. Las variantes con laterales usan el exportador GLB y colisión `ConcavePolygonShape3D` existentes. En giros con parapeto interior, se valida el radio adicional: lado izquierdo con giro positivo y lado derecho con giro negativo. Si una escena guardada queda inválida por dimensiones posteriores, se visualiza recta y el Inspector informa el problema. Se rechazan cambios de Inspector que vuelvan inválida la curva.

## Pruebas automatizadas — asistente

Desde la raíz del SOURCE_BASELINE:

```bash
node --test scripts/test-stairs-sides-g001.mjs
node --test scripts/test-stairs-param-g001.mjs scripts/test-stairs-curve-g001.mjs
node --test $(find scripts -maxdepth 1 -name 'test-*.mjs' ! -name 'test-starcat.mjs' | sort)
npm run build
```

SIDES-01..26 cubren compatibilidad, modos, límites, altura, grosor, radios, topología, triangulación, normales/UV, Blockout, Edit Mesh, serialización, trimesh, GLB, Inspector, reconstrucción, CSG y conexiones con exportación. Dos tests antiguos de STAIR y dos de CURVE actualizan únicamente las comprobaciones de firmas/call sites extendidos; los casos funcionales históricos no se han eliminado. `test-starcat.mjs` necesita Three.js en `node_modules`; su exclusión se declara y no se contabiliza como PASS.

**Resultado sobre el SOURCE_BASELINE de este Gate (2026-10-27):** SIDES: 26 PASS / 0 FAIL. Regresión disponible: 1547 PASS / 0 FAIL / 18 SKIP, sin `test-starcat.mjs`. `npm run build` devuelve 127 (`vite: not found`). Compilación, GPU, física Jolt y ejecución real Godot permanecen **NO VERIFICADAS**, no PASS.

## QA visual y de funcionamiento — usuario

1. En una copia separada instala dependencias con `npm ci`, ejecuta `npm run build` y `npm run electron`. Confirma apertura del Editor sin errores.
2. Crea Escalera. Comprueba los modos **Ninguno, Izquierdo, Derecho, Ambos** con 2, 8 y 64 escalones; las caras estructurales originales siguen cerradas aun en «Ninguno».
3. Con «Ambos», cambia altura a 0.1, 1 y 3 m; grosor a 0.05, 0.15 y 0.5 m. Los laterales deben seguir el contorno de los peldaños, sin ocupación del paso central; X/Y/Z siguen siendo dimensiones de la Escalera, no parámetros duplicados.
4. Prueba giros −90°, −45°, 0°, +45° y +90° con ancho/longitud válidos; comprueba que los parapetos siguen el arco y no son cajas rectas.
5. Crea una curva cerrada de radio interior ajustado y aumenta el grosor o activa el lateral interior hasta invalidarlo; el Inspector debe **rechazar** el cambio e informar. Si modificas XYZ posteriormente hasta invalidar el giro guardado, no debe producir una malla corrupta.
6. Convierte a **Edit Mesh** (con parapetos). Selecciona y edita vértices/caras, conserva material Blockout, UV, Snap y Undo/Redo. Guarda y reabre: los valores de `props` y la geometría deben persistir.
7. Comprueba un brush sustractivo sobre una Escalera con laterales y otra Escalera como cortador. Cambia altura/grosor y verifica regeneración de cortes sin restar paredes obsoletas.
8. En **Player**, verifica renderizado, sombras y colisión estática Jolt al caminar sobre huellas y contra muros laterales. Las zonas altas deben mantener la barrera.
9. Exporta a Godot las cuatro modalidades y una curva. Sin laterales y giro 0° deben continuar las cajas; con cualquier lateral debe exportar GLB + colisión triangular. Compara orientación, dimensiones y material en ejecución.
10. Abre escenas antiguas sin `sides`, `sideHeight`, `sideThickness` ni `turn`; deben conservar el aspecto y funcionamiento anterior.

## Evidencia y cierre

El usuario ejecuta QA local. Si hay fallos, enviar comandos/logs, captura o vídeo, pasos para reproducir y escena mínima. Se debe diagnosticar antes de proponer correcciones. **Autorizado/Implementado** no equivale a **Compilado/QA local PASS/Aprobado/Cerrado**. El siguiente trabajo es el QA de integración del Sprint de Escaleras, sujeto a autorización de su propio Gate.

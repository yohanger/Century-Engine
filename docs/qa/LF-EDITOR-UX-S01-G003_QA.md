# LF-EDITOR-UX-S01-G003 — Luces, RectAreaLight y sol/luna

**Gate autorizado:** `Listo. LF-EDITOR-UX-S01-G003 autoriza comenzar` (2026-10-25).

**Baseline de entrada:** `LevelForge_EDITOR_UX_S01_G002_EXT_001_SOURCE_BASELINE.zip` (734 archivos; Three.js 0.186.1). **Referencia externa recibida:** `FrostEngine_v1(1).unitypackage` (consultado para las semánticas de iluminación, no incorporado a la distribución).

## Diagnóstico con evidencia

- `FrostEnvironmentPresentation.cs` de FrostEngine resuelve el sol mediante `RenderSettings.sun`, lo actualiza con el vector solar y su energía, y mantiene otra luz `Frost Environment Moon Light` direccional **sin sombras**, creada si la intensidad lunar supera un umbral. Restaura el estado solar y destruye la luz lunar en Dispose.
- LevelForge disponía de `frame.sunDir`, `frame.moonDir`, `frame.sunMul` y `frame.keyDir/keyMul`, pero `_worldSun` aplicaba `keyDir` y `keyMul` a una **única** direccional; la luz saltaba de orientación al cambiar el cuerpo dominante.
- `src/engine/runtime/nodes/light.js` usaba un marco rectangular manual rotado 180° de manera independiente. Se reemplazó solo ese marco por el `RectAreaLightHelper` del addon de Three.js, como hijo del emisor, sin cambiar `RectAreaLight` ni su contrato local -Z. SpotLight y DirectionalLight conservan sus flechas de dirección y el PointLight conserva el icono; no se detectaron cambios necesarios a estos gizmos.

## Contrato implementado

1. `environment.time.celestialLights`: nueva opción booleana, **false** por defecto. La normalización solo acepta el booleano true. Se expone en Escena → Hora como **Sol y luna independientes (Frost)**. Las escenas antiguas, sin esa clave, siguen usando `keyDir/keyMul` en una sola luz, sin luna adicional.
2. Con `Controlar la hora` y la opción explícitamente activadas, la primera direccional visible funciona solo como **sol** (`frame.sunDir`, `frame.sunDirectMul`, `frame.sunColor`); se conserva su color/intensidad base del Inspector como multiplicador de energía y la lógica de sombras/horneado existentes. Para direccionales bajo padres rotados se neutraliza la rotación mundial del padre antes de aplicar la orientación astronómica.
3. **Luna**: `THREE.DirectionalLight` interno, no serializado ni visible como nodo en Jerarquía. Utiliza `frame.moonDir`, `frame.moonMul` y el color lunar de `World`. No genera sombras (`castShadow=false`), ni mapas de sombra, ni geometría de autoría. Solo existe si el sol de escena es elegible, `view.lights` está encendido, y la energía lunar supera el umbral. Se elimina al apagarse, al desactivar el modo, al cambiar de escena y al destruir `SceneGraph`.
4. El modo sin mundo activo restaura la orientación, el color y la energía del Inspector usando `syncObject`, como hacía el sistema previo. La lógica `key*` sigue vigente para modo heredado y otras rutas.
5. **RectAreaLight**: helper oficial unido al emisor, orientación compartida; ancho/alto actualizados mediante la propia `RectAreaLight`, sin una segunda rotación del marco. El helper nace invisible y se muestra solo al seleccionar el nodo por el mecanismo G002 existente. Durante Play y en Player se fuerza invisible; no se crean sombras del área. Limpieza `dispose` del helper en la reconstrucción/destrucción.
6. No se altera el esquema de archivos antiguos, Jolt, Event/Database, renderizadores, tiempo astronómico, LUT, SSR, Outline, WATER, Lensflare ni el exportador.

## Pruebas automatizadas

- `node --test scripts/test-editor-ux-s01-g003.mjs`: **13 PASS, 0 FAIL**. Comprueba valores por defecto, cálculo independiente, reuso/limpieza de luz lunar, orientación bajo padres, visibilidad, modo Player, helper oficial y ausencia de sombra lunar.
- `scripts/test-three-s02.mjs` fue actualizado para comprobar el helper oficial y su vínculo al emisor en vez de esperar geometría manual. Las pruebas anteriores de iluminación, Lensflare y selección se conservan.
- Regresión global: ejecutar `node --test $(find scripts -maxdepth 1 -name 'test-*.mjs' ! -name 'test-starcat.mjs' | sort)`; `test-starcat.mjs` precisa Three.js instalado.
- Compilación Editor/Player: `npm ci && npm run build`. En el entorno de construcción no está instalado Vite (`vite: not found`); **BUILD/QA WebGL NO VERIFICADOS**.

## QA manual: Linux, GPU real

| ID | Acción | Criterio de aceptación |
|---|---|---|
| G003-01 | Abrir escena anterior sin `celestialLights`; modificar hora de 12:00 a 00:00. | Misma lógica heredada de una luz; sin pérdida de configuración. |
| G003-02 | Añadir DirectionalLight, ir a Escena → Hora → activar hora y `Sol y luna independientes (Frost)`. | Día ilumina con la direccional solar. |
| G003-03 | Llevar hora a medianoche y ajustar Luz lunar. | La luna ilumina independientemente; el sol no apunta hacia la luna. |
| G003-04 | Mover hora gradualmente a amanecer/atardecer. | Transición sin saltos bruscos de orientación de la luz solar. |
| G003-05 | Cambiar ubicación/fecha con Astronomía real activa. | Posiciones del sol y luna corresponden visualmente al cielo; la luna responde a su fase. |
| G003-06 | Desactivar «Luces» en Vista; reactivar. | Luna y sol se ocultan/reaparecen conforme a ajustes. |
| G003-07 | Apagar `Controlar la hora`, luego `Sol y luna independientes`, luego cambiar escena. | Restaura manual de DirectionalLight; ninguna luz lunar persiste. |
| G003-08 | Repetir con una DirectionalLight bajo grupo rotado. | Su dirección mundial corresponde al sol, no a la rotación del padre. |
| G003-09 | Crear RectAreaLight, rotar y cambiar ancho/alto. | Plano del helper centrado en el emisor; flecha apunta al lado que ilumina. |
| G003-10 | Verificar PointLight, SpotLight y DirectionalLight en posición/orientación distinta. | Los iconos/flechas y haces conservan orientación/centro correctos. |
| G003-11 | Deseleccionar áreas y entrar en Play Mode / ejecutar Player exportado. | Ningún marco/editor helper del área en juego. |
| G003-12 | Activar sombras, SSR/Outline/Lensflare, cambiar de escena repetidamente. | Sin errores WebGL, fugas evidentes ni sombras lunares extra. |
| G003-13 | Comparar en la misma escena r186.1 G002_EXT vs G003, con modo antiguo. | El modo heredado tiene apariencia equivalente. |

**Pendiente de aceptación visual del usuario.** En caso de inconsistencias, corregir solo bajo Gate correctivo explícito; no avanzar a G004 hasta que el usuario apruebe G003.

# LF-THREE-S04-G001 · Three.js S04 · Lensflare opcional

**Estado:** implementado en fuente; QA WebGL Editor/Player y aceptación del usuario **PENDIENTES**. **Baseline de origen:** `LevelForge_THREE_S03_G001_SOURCE_BASELINE.zip` (714 archivos). **Three.js:** r170 (sin actualización).

## Contrato implementado

- **L01:** `Lensflare` y `LensflareElement` del addon oficial `three/addons/objects/Lensflare.js`, únicamente en `Light` para `omni` (PointLight) y `spot` (SpotLight). No se integran en el sol astronómico ni en `RectAreaLight`.
- **L02–L03:** desde Inspector → Luz aparecen `Lensflare` (activación), `Tamaño flare (px)` (16–256) e `Intensidad flare` (0–2). El color del efecto sigue el color y temperatura de la luz existente. Las propiedades se guardan en `obj.light` y usan `normalizeLight()`. Los proyectos sin `flareOn` permanecen apagados por defecto.
- **L04:** una imagen radial RGBA de 64×64 se calcula **una sola vez** en memoria. Cada luz tiene una `DataTexture` que reutiliza ese mismo buffer de píxeles. La separación por textura GPU es **necesaria**: `Lensflare.dispose()` del addon oficial destruye las texturas de sus elementos; compartir una única instancia `THREE.Texture` invalidaría otras luces al borrar una. No se instala gestor adicional. El efecto se elimina al desactivar el checkbox, borrar/reconstruir el nodo, recargar escena o liberar `SceneGraph`.
- **L05:** la luz sigue utilizando las rutas existentes de color, energía, sombra, transformación, animación y scripts de gameplay. El flare es un hijo de la luz, por lo que hereda posición y visibilidad, pero no altera iluminación física. Las ayudas de selección de luz permanecen visibles solo en Edit Mode; no deben ocluir el flare en Play/Player.
- **L06:** Editor, Play Mode y Player comparten `nodes/light.js` y `scene-graph.js`. El shader e interfaz de Lensflare dependen de `WebGLRenderer` oficial; no se crea postprocesado ni renderizador nuevo.
- **L07:** opt-in, sin coste relevante si no se activa. El coste de oclusión/renderización de flares activos debe medirse en Intel UHD 605; **NO VERIFICADO en GPU aquí**.
- **L08:** LUT y DOF ya implementados, sin cambios ni incorporación de `LUTPass` o `BokehPass`. `OutlinePass` queda pendiente de contrato `LF-THREE-S04-G002` (selección Editor vs. resalte gameplay); NO implementado.

Referencia de implementación correspondiente al contrato de dependencia: https://github.com/mrdoob/three.js/blob/r170/examples/jsm/objects/Lensflare.js
Documentación oficial de la API (puede reflejar versiones posteriores): https://threejs.org/docs/pages/Lensflare.html

## Pruebas y evidencias disponibles

```bash
node --test scripts/test-three-s04.mjs
node --test scripts/test-three-s02.mjs scripts/test-three-s03.mjs
npm run build
npm run electron
```

La suite S04 incluye contratos de addon oficial, default OFF, tipos admitidos, parámetros acotados, interfaz, textura y limpieza, reactividad runtime, separación de efectos y pruebas dinámicas condicionales. Las pruebas dependientes de Three.js se marcan SKIP sin `node_modules`; **no confundir con PASS**.

**Registro del entorno de entrega:** 808 PASS, 0 FAIL, 12 SKIP en 35 suites `scripts/test-*.mjs`, omitiendo `test-starcat.mjs` (no carga sin Three.js); `npm run build` devuelve `vite: not found`. La compilación del Editor/Player y las pruebas WebGL están **NO VERIFICADAS**.

## QA local obligatorio

- [ ] Abrir una escena antigua: todos los flares apagados y aspecto previo sin cambios.
- [ ] Crear PointLight: activar Lensflare, cambiar tamaño/intensidad/color y comprobar que se actualiza en el Inspector sin reconstrucción constante.
- [ ] Crear SpotLight con flare y girar/mover la cámara: sigue la fuente y las transformaciones.
- [ ] Comprobar oclusión real detrás de un cubo, pared y techo; anotar si el artefacto funciona con SSR/DOF/Bloom activados.
- [ ] Cambiar el color, energía, encendido y apagado por `game.node(...).light` y comprobar sincronización. Comprobar animación parpadeante.
- [ ] Guardar/abrir proyecto, entrar en Play Mode y exportar Player: mismo efecto opt-in; no mostrar esfera de ayuda del Editor en Player.
- [ ] Desactivar, borrar y volver a crear una de dos luces con flare: la otra debe permanecer visible y no generarse texturas residuales.
- [ ] Cambiar escenas repetidamente y detener Play: sin errores WebGL ni crecimiento progresivo injustificado de recursos.
- [ ] Comparar FPS y memoria con flares OFF/ON y SSR OFF/ON en la GPU del usuario; informar coste, sin extrapolar de Node.
- [ ] Verificar que PointLight/SpotLight/Directional/RectAreaLight, LUT, DOF, SSR, WATER y cielo mantienen el comportamiento anterior.
- [ ] `npm run build` compila Editor + Player; `npm run electron` abre y representa el efecto.

## Entrega e instalación

Dos ZIP exactamente:
1. `LF-THREE-S04-G001_CHANGE.zip` — solo archivos nuevos/modificados, tests, QA y ledger.
2. `LevelForge_THREE_S04_G001_SOURCE_BASELINE.zip` — proyecto completo acumulado.

Comparar los archivos locales afectados con el baseline aprobado antes de sobrescribir. Extraer **solo CHANGE** en la raíz `~/ENGINES/lf-0.26.13/lf`; conservar SOURCE_BASELINE como respaldo y siguiente punto de partida. Sin ZIP de dependencias, `node_modules`, SHA externo ni scripts .sh.

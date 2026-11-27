# LevelForge — LF-WATER-S03-G001_CORR-001 — Corrección lluvia e impactos

**Fecha:** 2026-10-25  
**Autorización literal:** `Listo. LF-WATER-S03-G001_CORR-001 autoriza comenzar`  
**Origen:** `LevelForge_WATER_S03_G001_SOURCE_BASELINE.zip`, 700 entradas (verificación ZIP CRC).  
**Estado:** cambios implementados, regresiones Node automatizadas PASS; **render WebGL, Editor/Player y hardware del usuario pendientes**.  
**Motivo:** la lluvia era una cortina de tiras GPU y las salpicaduras se generaban aleatoriamente sobre el suelo, sin correspondencia con primitivas.

## Contrato de la corrección (C01–C08)

- **C01 Gotas:** `world/fx.js` reutiliza las geometrías GPU y sus semillas. Las quads próximas y distantes son más cortas y estrechas; fragmento con perfil de gota elíptica y borde suave. La segunda capa deja de usar tiras de varios metros y decímetros de ancho.
- **C02 Impactos:** `world/rain-impact.js` comparte el mismo modelo de transformación de posición envolvente que el shader. PrecipFX muestrea hasta 384 de las 7000 gotas cercanas, con **máximo de 64 consultas de contacto por fotograma**, ignorando saltos de envoltura del volumen. `SceneGraph` consulta las primitivas/mallas/carreteras/texto visibles mediante el raycast Three.js ya existente, y el suelo real mediante `groundAt()`.
- **C03 Salpicaduras:** cada anillo nace **solo** de una intersección válida, con la normal de la cara impactada. No se recicla en posiciones aleatorias. Sus recursos se reutilizan; terminada su vida desaparecen, incluso tras cesar la lluvia.
- **C04 Cubiertas:** los contactos visibles se registran en la cara superior del obstáculo antes del terreno inferior. S02 sigue controlando por separado la exposición meteorológica real de las celdas; los efectos no asignan masa a la escena.
- **C05 Charcos:** con `uPhysicalCount > 0` (modo de agua física habilitado), el shader de terreno desactiva **globalmente** la máscara de charcos por ruido. El agua visible proviene del `WaterSurfaceView` asociado a las regiones WaterWorld. Se conserva el oscurecimiento/rugosidad de la tierra húmeda. Con física desactivada se conserva el efecto procedural heredado por compatibilidad.
- **C06 Autoridad:** `PrecipFX` **no llama a `WaterWorld.changeVolume()` ni a `queue()`**. S02 continúa contabilizando los aportes por intensidad en mm/h y exposición, sin duplicación por impactos. Cuando existe `WaterSurfaceView`, las salpicaduras de suelo consultan su superficie física.
- **C07 Coste:** no se crean cuerpos rígidos para gotas; lista de colisiones cacheada durante 300 ms, 384 trayectorias pequeñas y un máximo de 64 raycasts por fotograma. **Sin benchmark real Editor/WebGL no se declara objetivo de rendimiento alcanzado.**
- **C08 Compatibilidad:** proyectos sin `environment.waterSimulation.enabled` mantienen sus cuerpos y sus charcos heredados. No cambian API de WaterWorld, física de Water S01/S02, escenas ni guardados. `SceneGraph.loadScene()` limpia anillos y trayectorias. No se añaden dependencias.

## Limitaciones explícitas

1. **Los 7000 sprites de gotas no ejecutan raycasts individuales**: los impactos representados proceden de un subconjunto limitado de las *mismas* trayectorias GPU; no garantiza colisión individual visual-perfect de todas las gotas. El depth test y oclusión existente siguen trabajando con el resto.
2. **El agua física sigue siendo optativa por escena**, tal como se aprobó en S02/S03. Si no activas «Terreno → Agua física», el sistema heredado continúa creando charcos de ruido. En modo físico se suprimen los charcos inventados incluso fuera de las regiones: las regiones configuradas deben cubrir el área donde se quiera acumular agua real.
3. **No se crea agua acumulada sobre toda primitiva 3D**: un cubo recibe impactos/salpicaduras, pero un charco sobre su cara superior requiere modelar una superficie receptora de almacenamiento y drenaje distinta del fondo de Terrain. Esto excede la corrección aprobada.
4. **La oclusión por techo de la lluvia lejana sigue siendo aproximada**: las partículas no simulan choques individuales ni un corte exacto de cada una por geometría. Las salpicaduras deben registrarse en geometría sólida, no debajo de ella.
5. **Geometría no indexada para raycast:** se admiten mallas de tipos `primitive`, `mesh`, `road`, `text` visibles. Follaje, partículas y otros nodos FX no se tratan como superficies sólidas para lluvia. En el editor las transformaciones se consultan sobre la escena, no Jolt; S02 mantiene su uso de raycast físico para cubiertas en Play.

## Pruebas Node y evidencia

- `node --test scripts/test-water-s03-corr001.mjs`: 14 casos PASS, 0 FAIL.
- `node --test $(ls scripts/test-*.mjs | grep -v test-starcat.mjs)`: **757 PASS, 0 FAIL, 9 SKIP**, con dependencias no disponibles aquí. El último resultado autoritativo debe extraerse del log de empaquetado.
- `node --check` de todos los JS modificados: PASS.
- `npm run build`: **NO VERIFICADO**, `vite: not found` (127).
- `scripts/test-starcat.mjs`: NO EJECUTABLE en este entorno (módulo Three.js ausente); no atribuir PASS.
- Sin pruebas visuales de WebGL real, compilación, exportación Player ni benchmark en Intel UHD 605.

## Procedimiento local de QA

1. Respaldar cambios locales; colocar los dos ZIP en `~/Downloads`. Comparar los archivos afectados contra la fuente S03. Extraer **únicamente** CHANGE sobre `$HOME/ENGINES/lf-0.26.13/lf`.
2. Ejecutar `node --test scripts/test-water-s03-corr001.mjs`, suites Water S01/S02/S03 y de Render Pipe. Ejecutar `npm run build` y `npm run electron` con dependencias instaladas.
3. Crear escena con Terrain y una **primitiva cubo** sobre el terreno. Activar lluvia y vista viva. Comprobar: gotas más discretas, ausencia de cortina excesiva, anillos que aparecen sobre la **cara del cubo**, no siempre en el suelo debajo. Probar también una cara inclinada.
4. Activar **Terreno → Agua física**; poner profundidad inicial 0, configurar una depresión del terreno y activar lluvia durante Play Mode. Comprobar que el agua aparece al acumularse, que el terreno húmedo conserva su material y que **no surgen charcos por ruido en partes de la escena fuera de las regiones simuladas**.
5. Desactivar agua física y repetir para verificar el aspecto legado de charcos; los cuerpos clásicos de agua conservan sus mallas/olas/corrientes.
6. Colocar un tejado sobre el punto de prueba y observar que la lluvia no genera salpicaduras visuales sobre el suelo que queda bajo un impacto interceptado; corroborar las celdas cubiertas por S02 (sin acumulación directa).
7. Detener lluvia: últimas salpicaduras desaparecen sin renacer. Cambiar escenas: no quedan anillos viejos. Repetir en Player exportado y registrar rendimiento CPU/GPU antes de aprobar.

## Entrega

Exclusivamente `LF-WATER-S03-G001_CORR-001_CHANGE.zip` y `LevelForge_WATER_S03_G001_CORR-001_SOURCE_BASELINE.zip`; CHANGE es subconjunto exacto de fuente acumulada; sin SHA externo ni shell scripts añadidos.

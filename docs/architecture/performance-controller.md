# Controlador de presupuesto de Play y Player

`project.render.performanceAuto` activa por defecto un controlador local y determinista; `targetFps` define su objetivo (60 por defecto). Se configura en Ajustes → Render → Geometría y visibilidad. No requiere modelos de IA, API, red ni abrir Stats. El editor en reposo no ejecuta el controlador. La ruta nativa WebGPU conserva su autoridad y no recibe ajustes de este controlador WebGL.

## Medición y decisiones

Viewport mide el intervalo real entre frames, la CPU de los callbacks de simulación y la CPU completa del frame. PerfMonitor suma los draw calls de las pasadas y reutiliza GpuTimer. Con Stats cerrado solo abre una consulta GPU completa cada ocho dibujos, o cada dos por debajo de 20 FPS, con un máximo de ocho pendientes; no lee resultados hasta que están disponibles. Con Stats abierto comparte sus consultas exclusivas y no suma otra vez el agregado de AO. La GPU sin extensión de tiempo aparece como desconocida, nunca se reemplaza por un tiempo de CPU.

La política usa ventanas de al menos un segundo y doce muestras, media y p95. A pocos FPS permite cerrar con cuatro muestras si han pasado dos segundos. Ignora el calentamiento inicial y espera 1,5 segundos después de cada cambio. Dos ventanas con presión permiten una reducción; seis con margen permiten recuperar un paso. Una pestaña oculta, un contexto perdido, el final de Play o una nueva autoridad LOD reinician el presupuesto. Los frames de más de 250 ms siguen contando cuando la pestaña está visible: una GPU saturada no debe quedarse reiniciando el calentamiento. Intervalos de dos segundos o más se descartan como discontinuidades.

Los cuellos de botella se clasifican como indicios, no como una certeza universal: lógica CPU, GPU, CPU/envío de dibujos, ritmo de presentación o sin confirmar. Una lógica que ya consume el presupuesto se informa sin bajar gráficos. Sin tiempos GPU y sin un coste CPU que explique la caída, no se reduce calidad a ciegas. Un límite externo de presentación con CPU/GPU desocupadas tampoco causa degradación.

## Ajustes permitidos

| Subsistema existente | Máximo ajuste temporal |
| --- | --- |
| LOD de mallas, terreno y clústeres | Multiplicador de calidad de 1 hasta 0,5; conserva distancia de dibujado |
| GTAOPass | Targets propios a 75 % o 50 % por dimensión; conserva GTAO, intensidad y materiales |
| Cielo y nubes | Conserva los pasos del perfil; SkyVariants especializa ramas inactivas sin reducir muestras |
| Sonda de reflejos | Intervalo de actualización de 900 hasta 3600 ms |
| Sondas de irradiancia | Intervalos entre capturas y refrescos hasta cuatro veces mayores |
| Captura IBL del cielo cambiante | En presión respeta intervalos de hasta 6000 ms, incluso a pocos FPS; conserva las invalidaciones inmediatas y la respuesta del editor |

Estos ajustes tienen un coste visual posible: menos precisión de AO, mayor error geométrico permitido a distancia y reflejos menos recientes. No equivalen a una optimización gratuita ni aseguran una imagen idéntica. El perfil forward, el PBR, la exposición, las luces y la resolución interna y de salida conservan la configuración del proyecto. No activa TAA ni resolución dinámica retirados. Tampoco elimina objetos de gameplay, cambia frecuencias de física o scripts, altera colisiones, activa batching sobre objetos sin permiso ni modifica assets. Los sistemas de culling y batching existentes siguen operando con sus requisitos actuales; este cambio no añade un algoritmo nuevo de agrupación de draw calls.

Los ajustes se restauran al salir de Play o desactivar la opción. Cerrar Stats solo restaura sus experimentos; no desactiva el controlador. Stats → Más métricas muestra objetivo, estado, indicio de cuello de botella, p95 y niveles aplicados. Si no hay un ajuste aplicable o se agotan los límites, indica «Límite alcanzado».

## Validación y límites

`node --test scripts/test-performance-controller.mjs` verifica presión sostenida, recuperación, lógica lenta, presentación a 30 Hz, GPU desconocida, pausa, exclusión de subsistemas, coexistencia con Stats, límite de consultas y restauración.

`node --test scripts/test-performance-controller-electron.mjs` usa el renderer WebGL real con GTAO y LodManager. Inyecta telemetría de presión únicamente para verificar decisiones y actuadores. Los FPS de esa telemetría no constituyen un benchmark del hardware ni de un juego. Para certificar un objetivo hacen falta escenas representativas en el equipo de destino, con capturas A/B del aspecto, tiempos de CPU/GPU y p95 tras el calentamiento. Este controlador no garantiza 60 FPS en hardware arbitrario ni añade soporte de distribución para consolas.

# LF-WATER-LIQUID-CA-002 — Acoplamiento hidráulico y desplazamiento por sólidos

**Estado contractual:** APROBADO para el alcance del Gate `LF-LIQUID-WATERBODY-COUPLING-S09-G001` mediante autorización exacta `Listo. LF-LIQUID-WATERBODY-COUPLING-S09-G001 autoriza comenzar`.

**Parent:** `LF-WATER-LIQUID-CA-001`, WATER S01–S04 y LIQUID S05–S08. Este Amendment actúa prospectivamente, no altera los resultados históricos.

## Decisiones vinculantes

1. `WaterWorld` sigue siendo la única autoridad del volumen de agua. `WaterRegion` mantiene el solver de aguas someras; no se crea otro motor de agua ni se transforma un océano en una cuadrícula gigante.
2. Los cuerpos de agua anteriores son **fronteras externas no finitas**, excepto la representación física de una región compatible elegida expresamente para sustituir su superficie. El modo anterior permanece por defecto.
3. `environment.waterSimulation.couplings` es una lista de puertos hidráulicos explícitos. Cada puerto declara extremos, área de sección [m²], coeficiente adimensional, caudal máximo [m³/s] y sentido. No se deduce una conexión por proximidad gráfica.
4. Las conexiones entre regiones son operaciones internas y conservan masa. Una conexión con un cuerpo heredado es una **entrada o drenaje externo** que debe quedar identificado y contabilizado; no existe inventario físico finito del océano.
5. Se autoriza un caudal simplificado por diferencia de nivel: \(Q=\min(Q_{max},C_d A\sqrt{2g|\Delta H|})\), limitado por inventario del extremo finito. Es un modelo de orificio simplificado; NO resuelve una ecuación fluvial 1D o acoplamiento completo del momento en la frontera.
6. El desplazamiento de objetos dinámicos compatibles modifica el espacio ocupado por agua en las celdas del solver sin sumar líquido. Puede alterar nivel y presión; Jolt conserva la responsabilidad del empuje sobre el sólido.
7. Solo formas **simples, verificables**: caja alineada a ejes de mundo, esfera y cápsula vertical, con límites de tamaño y presupuesto. Formas compuestas, desplazadas o inclinadas no deben aproximarse silenciosamente. Las celdas de Terrain siguen limitadas por S02/S06.
8. La asociación visual opcional de un cuerpo `.water` con `physicalRegionId` oculta su malla anterior cuando la región física está activa. La visualización física y `WaterWorld.at` usan el mismo estado. No convertir cuerpos automáticamente ni sobrescribir escenas antiguas.
9. Snapshots v1–v4 siguen siendo aceptados; v5 registra configuración y contadores del acoplamiento y ocupación geométrica. Las transferencias físicas permanecen validadas, diferidas y reversibles cuando el solver falla.
10. La simulación de recipientes, café, chorros y mezclas queda para S10. El acoplamiento perfecto de momento, olas tridimensionales y estelas turbulentas no se declara como implementado.

## Invariantes

- Cada transferencia finita tiene origen y destino, y el balance `WaterWorld.liquidBalance().errorM3` permanece dentro de la tolerancia numérica documentada.
- `occupied` es geometría desplazadora, no masa líquida. `volume()` y `massKg` no incluyen la geometría del sólido.
- La física optativa NO altera el comportamiento de un proyecto sin `waterSimulation.couplings`, `waterSimulation.displacement.enabled` ni `physicalRegionId`.
- Una interfaz gráfica y una prueba Node no justifican declarar PASS en la simulación visual o exportada de Player sin QA local.

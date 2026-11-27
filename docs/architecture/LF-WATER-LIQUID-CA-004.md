# LF-WATER-LIQUID-CA-004 — Agua suspendida por fenómeno meteorológico

**APROBADO por autorización exacta:** `Listo. LF-WEATHER-TORNADO-DESTRUCTIVE-S12A-G001 autoriza comenzar`.
**Parent vinculante:** LF-WATER-LIQUID-CA-001/002/003; WATER S01–S04, LIQUID S05–S10 y WEATHER S11–S12.
**Aplicación prospectiva:** opt-in; no cambia los proyectos antiguos, ni las semánticas originales de regiones, recipientes y fronteras.

1. `WaterWorld` permanece como **única autoridad de agua**. Se autoriza un inventario `suspended` de paquetes físicos macroscópicos; las partículas VFX3D no poseen ni crean volumen.
2. `WaterRegion` puede entregar volumen a una reserva suspendida con un débito único en la celda fuente. La extracción se limita a la profundidad disponible, drenajes pendientes y presupuesto de 64 paquetes.
3. Un cuerpo de agua heredado (océano/lago/río tradicional) se tratará como **frontera abierta**. Levantar agua desde ese cuerpo se registra como `suspendedBoundaryInM3`, no se asume que tenga almacenamiento finito.
4. La reserva suspendida contiene identidad de paquete, posición mundial, volumen m³, edad y origen. La advección usa el mismo campo de tornado que la física; el transporte no añade ni elimina agua por sí mismo.
5. Al alcanzar una región física homogénea de agua, se deposita el paquete por una cola compatible de WaterRegion; en otro caso se contabiliza una salida explícita fuera del dominio. No se crea una segunda región simulada ni una salpicadura con masa ficticia.
6. `WaterWorld.liquidBalance()` y `liquidBalances()` incorporan el inventario suspendido y corrigen aportes/drenajes internos; la tolerancia de error se verifica mediante regresiones. El volumen suspendido en vuelo no es un charco ni reserva de suelo.
7. El snapshot **v7**, activado solo cuando hay suspensión, registra paquete, origen, posición, edad, serial y contadores de frontera; su restauración valida todo antes de mutar. Snapshots previos se mantienen para escenas sin suspensión.
8. El agua que alcanza una fuente de combustión puede enfriarla conforme al contrato térmico S12A. Esta transferencia energética **no crea ni consume volumen adicional** y no convierte VFX visuales en inventario.
9. No se autoriza un solver de gotitas 3D, mezclas con líquidos distintos del agua, evaporación atmosférica, erosión física de Terrain ni reducción instantánea de océanos enteros.

**Evidencia exigida:** pruebas de conservación para región finita, frontera oceánica, depósito, salida, snapshot v7, coexistencia con recipientes S10, agua sobre fuentes térmicas, y QA local real de Editor/Player.

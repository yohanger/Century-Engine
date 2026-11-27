# Restauración del sistema original de agua

## Alcance aplicado

1. Registrados los nodos existentes `water` y `fluidcontainer3d`; restaurados sus paneles y creación de recursos `.liquid`.
2. Restablecidos `WaterWorld`, los módulos históricos de hidrología y recipientes, los efectos y superficies del agua y la integración con Terrain.
3. Restablecidos los métodos de agua, líquidos y meteorología de Play, la API `game.water`, la vista previa de Editor y la conexión al ciclo de física existente sin añadir un segundo paso Jolt.
4. Recuperado el shader auxiliar histórico para la exportación Godot de agua; el exportador Godot sigue siendo obsoleto y no se extiende.
5. Desconectado `CenturyWaterRuntime` del arranque del Player y la física Jolt; eliminada la dependencia npm activa y la fase de compilación obligatoria de Century Fluids.
6. Conservada íntegra la copia de `vendor/century-fluids/` y los contratos históricos.

## Procedimiento de compatibilidad

Se partió del SOURCE_BASELINE CORR-002; se utilizó una fuente histórica previa al retiro. Los consumidores actuales se fusionaron selectivamente para preservar cambios posteriores en edición de mallas, nodos, escena, Jolt y UX. Los datos de escenas se mantienen sin migración.

## Limitaciones

El agua original vuelve como sistema **Deprecated**, no como sustituto físico universal de la nueva biblioteca. La equivalencia funcional exacta de todas las rutas solo puede acreditarse mediante QA de Editor/Play/Player con dependencias y GPU disponibles. La biblioteca independiente Century Fluids permanece **EN PAUSA**.

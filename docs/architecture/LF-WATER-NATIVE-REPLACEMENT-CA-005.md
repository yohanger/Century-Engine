# LF-WATER-NATIVE-REPLACEMENT-CA-005 — Amendment ratificado

**Ratificación:** usuario, 18 de noviembre de 2026, conforme a ocho decisiones propuestas.
**Autoridad:** altera únicamente las obligaciones incompatibles de `LF-WATER-LIQUID-CA-001..004` relativas a superficies heredadas optativas; no deroga el inventario ni las integraciones ya aprobadas.

1. **Sustitución prospectiva:** las superficies tradicionales dejan de ser la implementación visual obligatoria por defecto para los dominios de agua que se vayan evolucionando. No equivale a borrar la autoría de escenas existentes.
2. **Referencia:** Water Lab CORR-002 (`lf(2).zip`) aporta mecanismos de simulación y apariencia; no se integran su aplicación, su cámara, su renderer o un segundo ciclo de actualización.
3. **Autoridad única:** `WaterWorld` sigue gobernando estado físico, volumen, consultas y transferencias. Jolt gobierna los cuerpos rígidos.
4. **Dominios adecuados:** los nuevos nodos de agua usan física adaptada al dominio; la simulación superficial 2.5D no se declara simulación universal 3D.
5. **Interacciones:** verificar Terrain, Jolt, recipientes, clima y eventos antes de atribuir soporte; ninguna capacidad se deduce de una captura visual o del nombre de un nodo.
6. **Protección de trabajo:** preservar escenas y archivos actuales sin introducir una migración histórica general ni borrar datos experimentales.
7. **Retirada controlada:** retirar rutas visuales sustituidas solo tras auditar dependencias y acreditar Editor, Play y Player. No conservar dos vistas del mismo volumen simultáneamente.
8. **Presupuesto y QA:** medir memoria, CPU y GPU donde esté disponible, conservar referencias de rendimiento del hardware objetivo y exigir pruebas físicas y visuales.

## Aplicación incremental

- `LF-WATER-NATIVE-S01-G001`: Lago/rectángulo y Río con `WaterRegion` nativo. Superficies de Océano y círculo, solver 3D de recipientes, SPlisHSPlasH/WASM y retirada general de shaders **fuera de alcance**.
- Los documentos anteriores permanecen como historia normativa; las cláusulas de activación manual obligatoria para Lago/Río quedan **SUPERSEDIDAS exclusivamente para estos dominios**.
- Ninguna importación de librerías nuevas ni copia de Water Lab queda aprobada por este documento.

# Integridad de confirmación del campo numérico

Gate `CENTURY-EDITOR-STABILITY-S01-G001-CORR-001-NUMERIC-FIELD-COMMIT-INTEGRITY`, ratificado y autorizado literalmente.

Base: `CENTURY_EDITOR_STABILITY_S01_G001_SOURCE_BASELINE.zip` (3988 archivos, CRC verificado). No se dispone del árbol local del usuario; no se atribuye el fallo de Electron a una causa exacta sin reproducción. El Gate de estabilidad permanece abierto.

Extender NumberField y su fixture: edición por entrada, confirmación explícita mediante Enter, confirmación por blur, cancelación Escape, preservación de límites y de un único commit por cambio. Conservar las diez verificaciones originales y añadir cobertura con teclado nativo y trazabilidad. No modificar parser, contratos de persistencia, runtime, algoritmos ni dependencias. Reutilizar el protocolo de QA de teclado del runner, con preparación explícita opt-in. Sin debilitar assertions ni ampliar tiempos de espera.

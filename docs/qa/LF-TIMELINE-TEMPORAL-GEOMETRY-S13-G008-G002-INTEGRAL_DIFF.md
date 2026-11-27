# Diferencias S13-G008-G002 frente a G008-G001 CORR-003

**Producción modificada:** únicamente `src/components/TimelinePanel.vue`. Proyección compartida `timeToX/xToTime` y margen de 24 píxeles; regla, cabezal, clips, marcadores, Snap, zoom, puntero y selección proyectados sobre el mismo origen. Clips de duración conservan `duration × zoom` sin anchuras mínimas falsas; claves instantáneas siguen con tamaño de interacción fijo. Sin modificaciones persistentes.

**Tests existentes modificados:** 13 archivos con aserciones matemáticas/literales dependientes de origen cero sustituidas por el nuevo origen autorizado; sin eliminar pruebas ni desactivar fallos.

**Ledger modificado:** las seis hojas reciben entradas nuevas, incluyendo aprobación declarada de CORR-003, evidencia QA y 10 errores preexistentes de batería ampliada. No se modifican datos históricos ni las 12 tablas.

**Nuevos:** test focal GEO-01..24, fixture Electron de 43 comprobaciones, runner reutilizando la infraestructura existente, documentos e informes de evidencia.

**Sin cambios:** Player, `src/core/timeline/model.js`, Jolt, audio runtime, Cinematics, Assets, ScenePanel, InspectorDock, otros componentes y modelos de persistencia. No hay archivos eliminados.

**Evidencia:** focal 24 PASS; compatible 543 PASS/16 SKIP/0 FAIL; ampliada 601 PASS/18 SKIP/10 FAIL también reproducidos en baseline; Electron y build NO VERIFICADOS en preparación. No se presenta un resultado Node como PASS Electron.

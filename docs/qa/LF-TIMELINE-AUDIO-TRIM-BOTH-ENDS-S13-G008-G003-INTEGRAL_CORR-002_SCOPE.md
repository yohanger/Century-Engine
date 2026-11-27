# LF-TIMELINE-AUDIO-TRIM-BOTH-ENDS-S13-G008-G003-INTEGRAL_CORR-002 — Alcance autorizado

**Objetivo:** resolver aserciones Electron históricas incompatibles con la nueva geometría temporal y el dibujo PCM por ventanas visibles, conservando cobertura.

**Autorización literal del usuario:** `Listo. LF-TIMELINE-AUDIO-TRIM-BOTH-ENDS-S13-G008-G003-INTEGRAL_CORR-002 autoriza comenzar`.

**Prerrequisitos:** SOURCE_BASELINE G008-G003 CORR-001, geometría G008-G002, automatización y waveform previas, evidencia local de 46/46 PASS y dos fallos históricos.

**Medios indispensables:** fixtures Electron originales, generador de análisis PCM, pruebas Node, runner existente, ledger y documentación. No se requieren archivos runtime nuevos.

**Permitido:** dos fixtures Electron, Node de regresión, documentación y ledger. **Prohibido:** tocar producción, Player y audio DSP, debilitar pruebas o inventar PASS Electron.

**Evidencia:** 38 Node focal PASS, 176 Node dirigida PASS; Electron/build NO VERIFICADOS en entorno de preparación. Compilación y pruebas del usuario pendientes.

**Contradicciones:** ninguna contractual verificada; si falla la fixture contra PCM real en Electron, diagnosticar antes de tocar producción.

**Siguiente acción:** ejecutar dos Electron históricos y el principal; compilar Editor/Player; QA visual/sonoro; registrar evidencia y aprobación antes del cierre.

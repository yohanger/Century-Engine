# LevelForge · UPA-CA-004 — Operaciones editoriales y estructura excluidas de Timeline

**ID:** `LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-UPA-CA-004`  
**Autoridad:** ratificada por el usuario en la secuencia de CORR-003 del 2026-11-11. Incorporada en el SOURCE_BASELINE por el Gate autorizado `LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-CORR003-FINAL-COVERAGE-G001`.

## Enmienda al alcance universal

No se ofrecen llaves temporales para:

- **Combustión:** `Combustible` (alta/baja de fuente térmica) e `Ignición inicial` (evento/condición inicial). Se conservan humedad y umbral de ignición animados, sin alterar fuel/embers por inferencia.
- **Model:** iluminación global horneada (**GI**) y operaciones de generación editorial del modelo. No se sustituye ni regenera la geometría por fotograma.
- **Terrain:** generación, topología, pintura y remuestreo editorial del terreno. Permanecen los aplicadores temporales validados de propiedades no editoriales (p. ej., posición de piezas) y la física ya existente.
- **Node/Group:** propiedades estructurales del árbol; no se añaden canales propios ficticios para que aparezcan como completados.
- **Metadatos:** `Tags`, `Groups`, `Layers` y `DontDestroyOnLoad`, que no representan valores temporales de escena a reevaluar cada frame.

Continúan las exclusiones previamente contractuales: **Prefab** y **postprocesamiento de cámara**, reservado para un trabajo posterior. Las propiedades visuales, físicas y funcionales ya implementadas y dentro de alcance **no** se retiran.

## Límites

Esta enmienda no convierte automáticamente en «editorial» cualquier control que todavía carezca de llave. Las opciones de Luz, escalera y cualquier otro control potencialmente funcional no detallado deben revisarse contra sus propietarios y el coste temporal antes de prometer cobertura. Una restricción técnica pendiente se documenta como tal; no se maquilla como exclusión aprobada. No hay autorización para gestores globales, registradores paralelos ni reconstrucciones costosas de geometría por fotograma.

Las filas anteriores de CONT011/012 permanecen como historial. Los registros de FINAL-COVERAGE las reconcilian sin reescribir ni eliminar la evidencia original. **CA-004 no implica PASS de compilación o QA local ni cierre de CORR-003.**

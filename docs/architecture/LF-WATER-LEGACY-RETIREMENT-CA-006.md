# LF-WATER-LEGACY-RETIREMENT-CA-006 — Amendment ratificado

**Fecha de ratificación:** 19 de noviembre de 2026.  
**Ratificación literal del usuario:** «Ratifico LF-WATER-LEGACY-RETIREMENT-CA-006 conforme a las siete decisiones declaradas.»  
**Autoridad afectada:** `LF-WATER-NATIVE-REPLACEMENT-CA-005` y contratos anteriores del agua, **solo en sus obligaciones incompatibles de mantener operativa la implementación existente**. Se conserva toda la documentación anterior y su historia sin sobrescribirla.

## Siete decisiones normativas ratificadas

1. **Supersesión prospectiva:** queda supersedida la obligación de continuar la implementación antigua de `WaterWorld`, superficies y rutas de agua como base futura de Century. No supone negar el QA o los hitos anteriores.
2. **Retirada efectiva:** se autoriza desconectar el sistema anterior de Editor, Play y Player, incluidos nodos `water`, `game.water`, superficies, solvers, paneles y consumidores propios.
3. **Sin compatibilidad operativa:** no se exige reproducir ni simular comportamientos de nodos de agua antiguos. La ausencia del nodo en el registro de creación es intencional.
4. **Protección no destructiva:** se preservan escenas, prefabs, configuraciones, recursos `.liquid` y archivos presentes. Un nodo de agua heredado puede persistir como dato inerte; no se elimina al cargar/guardar. Ningún comando de migración o limpieza masiva está autorizado.
5. **Conservar subsistemas independientes:** terreno, física Jolt, lluvia, clima, rayos, nubes, tornados, render de materiales generales, eventos, audio y demás capacidades no se retiran por asociación temática con el agua. Las dependencias explícitas se desconectan antes de retirar un módulo exclusivo de agua.
6. **Sin diseño sustituto:** ni nuevo solver, ni biblioteca de fluidos, ni esquema definitivo, ni API futura se consideran aprobados. Los perfiles líquidos existentes se retienen como datos, sin declarar que constituyan una biblioteca física operativa.
7. **Historia y QA:** mantener contratos y pruebas previas como evidencia histórica. Las pruebas que exigían el agua retirada son **SUPERSEDIDAS**, no indicadores de regresión del contrato CA-006. El nuevo contrato exige validar compilación, Electron, Editor/Play/Player y persistencia con evidencias diferenciadas.

## Compatibilidad de autoridad

Este Amendment sustituye específicamente la cláusula 3 (autoridad operativa `WaterWorld`), la obligación de desarrollo en cláusulas 1, 4 y 5, y la exigencia de preservar la ejecución de las rutas antiguas en cláusula 7 de `LF-WATER-NATIVE-REPLACEMENT-CA-005`. Mantiene la protección del trabajo actual, la evidencia histórica y el principio de probar capacidades reales. No altera contratos independientes de Jolt, Timeline, cámara, clima o persistencia.

## Delimitación de `fluidcontainer3d` y `.liquid`

El nodo `fluidcontainer3d`, las herramientas de `liquidContainer` en Node3D/RigidBody3D y sus animaciones físicas dependen del sistema retirado y **no se ejecutan ni ofrecen para autoría nueva**. Los datos ya almacenados y los perfiles `.liquid` siguen siendo legibles y preservables. El hecho de conservar un parser de `.liquid` es soporte de conservación de datos, **no** una nueva simulación ni obligación de formatos definitivos.

## Estado de ejecución

Ratificación contractual: **RATIFICADO**. Gate de implementación: `LF-CENTURY-S00-G001-INTEGRAL-ENGINE-REBRANDING-AND-LEGACY-WATER-RETIREMENT`, autorizado literalmente el 19 de noviembre de 2026. Resultados de compilación/QA del Gate se consignan por separado; la ratificación no constituye aprobación técnica o cierre.

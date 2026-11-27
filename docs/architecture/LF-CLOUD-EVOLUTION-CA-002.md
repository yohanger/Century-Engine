# LF-CLOUD-EVOLUTION-CA-002 — Autoridad de evolución atmosférica

**Estado: RATIFICADO por decisión expresa del usuario el 17-11-2026.** Este archivo registra fielmente la autoridad posterior a G003. No pretende reconstruir el texto íntegro no recuperado de `LF-VOLUMETRIC-CLOUDS-REPLACEMENT-CA-001`; ese documento se conserva en el historial.

## Cláusulas ratificadas

- **CA-002-01.** World conserva la autoridad meteorológica exclusiva.
- **CA-002-02.** CloudField conserva la distribución e identidad espacial de las formaciones.
- **CA-002-03.** CloudVolume conserva la evolución volumétrica de condensado y vapor.
- **CA-002-04.** Las nubes evolucionan por características continuas; no se sustituyen modelos al cambiar su clasificación.
- **CA-002-05.** Se mantiene un único renderizador atmosférico y su integración con iluminación y geometría.
- **CA-002-06.** Edit Mode presenta un cielo meteorológicamente estático; PlayMode y Runtime ejecutan la evolución temporal.
- **CA-002-07.** Se preservan las integraciones de lluvia, relámpagos, tornados, viento, atmósfera y scripting.
- **CA-002-08.** La continuidad espacial, los teletransportes y la persistencia se resuelven sin duplicar simulaciones ni mantener todo el mundo en memoria.
- **CA-002-09.** Se prioriza extender la representación GPU existente. Nuevos canales o recursos exigen evidencia técnica y de rendimiento.
- **CA-002-10.** Se conservan archivos, proyectos y funciones actuales hasta que una sustitución específica esté autorizada y verificada.

**Precedencia ratificada:** CA-002 rige desde su ratificación únicamente las materias expresas, frente a incompatibilidades identificables. No declara ninguna supersesión global de acuerdos anteriores.

**Gates históricos:** S00-G001 VALIDATION aprobado con QA local 9 Node + 12 WebGL 2; S00-G002 ALGORITHM-DESIGN-AND-AUTHORITY-CONTRACT aprobado bajo CA-002, con decisiones GPU y residencia condicionadas a QA; S00-G003 AUTHORITY-RECOVERY-AND-CONTRACT-RECONCILIATION aprobado. Sus entregables y evidencia original permanecen en el SOURCE_BASELINE.

**Alcance de la autorización de S01-G001:** implementación integral concreta autorizada literalmente por el usuario. La ratificación de CA-002 no equivale por sí sola a cierre ni aprobación de este Gate de código.

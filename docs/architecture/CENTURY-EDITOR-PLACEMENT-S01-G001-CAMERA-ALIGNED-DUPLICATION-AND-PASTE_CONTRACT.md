# Colocación cardinal editorial

Autorización: `Listo. CENTURY-EDITOR-PLACEMENT-S01-G001-CAMERA-ALIGNED-DUPLICATION-AND-PASTE autoriza comenzar`.

- Ctrl+D y Alt+D: una traslación mundial común de 2 m en X/Z, conservando Y mundial y las transformaciones locales restantes. Dirección de la cámara proyectada al plano horizontal; en empate se prioriza X; para vista vertical se deriva el rumbo del eje derecho de cámara (si degenerado, −Z). Snap no interviene.
- Ctrl+V: la cámara en el momento de pegar define el rayo central. Se reutiliza el picking de superficies existente; se acepta un impacto finito a hasta 2 m del origen del rayo, sin modificar el cursor. El centro de las raíces copiadas se ancla al punto; no se ajusta automáticamente la base de la geometría ni la normal. Sin impacto cercano, el centro queda 2 m horizontalmente delante de la cámara en la dirección cardinal. Esta cota de proximidad y el desempate son decisiones de implementación de los criterios ratificados.
- La matriz inversa del padre convierte el vector mundial en desplazamiento local sin descomponer ni redondear la rotación/escala. Padres singulares o datos inválidos se rechazan. Los hijos se clonan sin desplazamiento adicional.
- Se mantienen `LF-NODE-SIGNALS-EDITOR-S06-G004_CONTRACT.md`, las reglas de malla compartida, los identificadores y el historial. Los valores de distancia históricos descritos en `LF-SCENE-CLIPBOARD-G001_QA.md` quedan supersedidos en esta operación por el alcance ratificado; no se reescribe esa evidencia. El comportamiento de pegado con padre externo desaparecido o cambiado sigue sujeto a la representación TRS existente.
- No se modifica la colocación de nodos nuevos, arrastre de recursos, Edit Mesh ni runtime.

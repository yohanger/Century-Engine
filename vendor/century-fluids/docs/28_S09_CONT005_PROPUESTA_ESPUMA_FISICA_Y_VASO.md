# Propuesta para espuma física y vaso en CONT-005

**Estado: autorizado para implementar.** El usuario respondió «Claro» a la solicitud expresa de autorización de la espuma física y el vaso. Esta propuesta amplía las capacidades del mismo S09 G001 CONT-005. CF-CA-005 sigue ratificado. S08 permanece en pausa y S10 sigue sin autorización. El cambio ya permitido en visualización retira la espuma de material y añade luz solar al playground.

## Espuma física del agua

La especificación original excluye la simulación multifase. Se propone autorizar **un modelo de aire atrapado específico para el agua**, acotado a la escala del playground. El aire atrapado en agua es una fase distinta. Los experimentos de Deane y Stokes documentan captación de aire por rotura de ola e impacto, por lo que la detección de simple velocidad elevada no acredita formación de espuma. [Estudio experimental](https://pubmed.ncbi.nlm.nih.gov/12192401/)

- El solver identifica episodios de captación en la interfaz libre, como el colapso de una ola o un chorro que reingresa al agua. Se exige contacto con la interfaz y un mecanismo de captación documentado. El reposo, la traslación uniforme y la agitación sumergida sin conexión con aire sirven de controles.
- La fracción subresuelta de aire y su evolución temporal pertenecen al estado del módulo de agua, asociadas a las partículas existentes y actualizadas por el paso físico vigente. Deben medirse generación, transporte con el agua, llegada a la superficie, duración y pérdida por liberación o colapso. La representación consume ese estado y muestra sus regiones o burbujas.
- Se mantiene un `ParticleStore` y se amplía la formulación del mismo solver. Se conserva la masa de agua y se contabiliza el saldo de aire atrapado por captación y liberación. La propuesta acepta una resolución subpartícula del aire. Cualquier efecto sobre la densidad de mezcla o el momento requiere justificación física, oráculos y verificación antes de habilitarlo; la espuma debe tener estado y evolución propios aun cuando ese acoplamiento quede fuera del primer perfil validado.
- Aceptación con agua quieta, traslación uniforme, perturbación sumergida y un impacto superficial repetible. El impacto debe producir aire localizado solo cuando se cumpla el criterio de captación. La espuma debe persistir tras el evento, desplazarse con el agua y disiparse en reposo. Fijar umbrales, duración y resolución contra datos de ensayo antes de calificar el resultado. Repetir balance de masa y momento, presión, estabilidad y perfil CPU/memoria/FPS con espuma activada y desactivada.

## Vaso manipulable con el ratón

El adaptador existente sincroniza una esfera o una caja por ID de Jolt. El recipiente abierto necesita varias paredes y un fondo que compartan pose y reacción. Se propone autorizar la extensión compatible del adaptador para un contorno compuesto en el playground.

- El vaso es un solo cuerpo Jolt con fondo, paredes y boca abierta. Cada superficie de contacto comparte la pose de ese cuerpo. Las reacciones lineales y los torques del fluido se combinan respecto al mismo centro de masa antes de entregarse a Jolt. El host conserva su único paso y registra como externalidad el trabajo introducido por el ratón al controlar el vaso.
- El usuario toma el vaso con el ratón, lo sumerge, lo levanta, lo desplaza y puede inclinarlo para verter. La entrada actualiza el objetivo durante el paso físico. Se valida velocidad lineal/angular frente a CFL y se fija un grosor y diámetro que el espaciado de las partículas pueda resolver. La cámara y el pulso sobre el agua conservan sus controles cuando el vaso está suelto.
- El agua capturada se calcula a partir de las partículas dentro del vaso. La prueba mide su masa al recoger, levantar, sostener, mover y verter; verifica que las partículas se mantienen dentro hasta salir por la boca, e incluye traslación e inclinación cerca de paredes. También mide penetraciones, impulsos, túnel, reinicio y rendimiento. El escenario de QA debe usar WASM real en Vite y Brave. La prueba visual de la interacción con el usuario es independiente.

La autorización del usuario cubre estas extensiones dentro de CONT-005. Los requisitos pendientes del solver y la aprobación integral del Gate conservan sus propios criterios.

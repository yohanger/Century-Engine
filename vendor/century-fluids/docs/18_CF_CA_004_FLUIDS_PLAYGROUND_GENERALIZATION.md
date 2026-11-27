# CF-CA-004 — FLUIDS PLAYGROUND GENERALIZATION

**Autoridad:** RATIFICADO por el usuario, 20-11-2026.  
**Gate de implementación autorizado:** `CENTURY-FLUIDS-S09-G001-INTEGRAL-PERFORMANCE-AND-STABILITY`.  
**Estado producto:** PRE-1.0, biblioteca TypeScript agnóstica. S08 permanece EN PAUSA.

## D01 — Playground de fluidos, no de agua

S09 implementa una **aplicación independiente de experimentación y QA de fluidos**, no un sistema exclusivo de agua. La aplicación no define un nuevo modelo físico ni se integra en Century.

## D02 — Agua como primera especialización funcional

El primer consumidor disponible es `@century/fluids/water`. No se crean gases, lava, nubes o simuladores ficticios. Las futuras especializaciones deberán cumplir sus propios contratos y su QA antes de mostrarse como funcionales.

## D03 — Autoridades y separación

Los controles de reproducción, escenas, medición, cámara y visualización pertenecen a `playground/`. El estado físico y la integración temporal pertenecen a `FluidWorld`; la superficie se extrae con `@century/fluids/surface` mediante la política de agua; la interacción con cuerpos pertenece al submódulo opcional Jolt. El playground no modifica ni sustituye sus algoritmos.

## D04 — Continuidad contractual

Se mantienen exactamente S00–S10, un Gate principal G001 por Sprint. S08 se mantiene pausado, sin sustitución por el playground. El proyecto no añade dependencias Three.js/Jolt/Vite a `@century/fluids`; están confinadas al consumidor. Cualquier descripción previa de S09 como **«playground de agua»** queda sustituida por **«playground de fluidos con agua como primera especialización»**, exclusivamente en la medida incompatible.

## Decisiones de entrega

El playground dispone de cuatro escenas (tanque, rotura de presa, obstáculo y flotación), sin jerarquías especulativas. Flotación **requiere Jolt WASM real**: si no se inicializa, la escena se bloquea explícitamente. La reconstrucción superficial se limita por presupuesto y frecuencia configurable, sin prometer 60 FPS. Las métricas de simulación, extracción, envío de render y FPS son separadas. El único reloj Jolt se ejecuta desde el host después del puente.

**No se autoriza reactivar S08 mediante este documento.**

# CF-PHYS-001 — Especificación numérica preliminar

**Estado:** INVESTIGACIÓN REALIZADA; ELECCIÓN DEFINITIVA DE SOLVER SUJETA A RATIFICACIÓN Y PRUEBAS S00. Los artículos científicos son referencia de principios, no código a copiar.

## Candidatos y alcance

- **DFSPH:** candidato principal para líquidos incompresibles 3D con partículas; propone control de densidad y divergencia. Requiere iteración de presión, vecindad y condiciones de contorno eficaces.
- **PBF:** alternativa de referencia orientada a estabilidad interactiva; su corrección posicional no demuestra por sí sola conservación cuantitativa de todas las magnitudes.
- **FLIP/APIC:** opción de comparación cuando la representación partícula-cuadrícula aporte ventaja medible; exige un sistema de interpolación y malla distinto.
- **SPH convencional:** baseline conceptual para validar mejoras, no selección automática para v1.0.

**Decisión propuesta D-PH-001:** usar DFSPH como formulación inicial de implementación en S03 tras ratificar contrato y tolerancias en S00. Un cambio de formulación que altere garantías requiere revisión contractual, no un segundo solver paralelo.

## Propiedades exigibles

Densidad de referencia, presión correctiva, aceleración por fuerzas externas, viscosidad documentada, manejo de fronteras, transporte de partículas, distribución espacial y paso fijo. Emisores y sumideros alteran deliberadamente la masa; cualquier auditoría de conservación debe descontar esas entradas y salidas.

## Escenarios de referencia

1. Volumen quieto: presión hidrostática y deriva de partículas cuantificada.
2. Colapso de columna: comparación de perfiles de movimiento y conservación.
3. Obstáculo estático y móvil: no penetración dentro de tolerancia y transferencia de momento.
4. Movimiento de cuerpo rígido en agua: fuerzas de fluido sobre sólido y reacción sobre fluido.
5. Emisión y drenaje: balance entre masa inicial, inyección y salida.
6. Paso temporal grande, parámetros inválidos y dominio extremo: errores controlados, sin NaN/Inf ocultos.

## Métricas y contratos de tolerancia

Error relativo de densidad, balance neto de masa, error de divergencia, error de penetración, iteraciones máximas, tiempo de paso y memoria pico. Las fórmulas, resoluciones de referencia, tolerancias numéricas y equipos deben ser congelados en **S00-G001 antes de implementar S03**; inventar un resultado de benchmark sería inválido. Se recomienda declarar límites de aceptación por clase de escena, no un FPS universal para cualquier cantidad de partículas.

## CF-PHYS-ACC-001 — Perfil de aceptación numérica propuesto (NO RATIFICADO)

Estos límites son **metas contractuales propuestas**, no valores medidos ni capacidades ya demostradas. Se congelarán después de la ratificación del usuario y ANTES de implementar el solver. Se aplican a escenarios de referencia con resolución inicial fija y datos de entrada publicados en tests.

| Indicador | Regla propuesta | Cómo se valida |
| --- | --- | --- |
| Estado finito | 0 NaN/Inf en todas las variables físicas y salida, para entradas válidas | aserciones por paso y scan de buffers |
| Masa cerrada | `abs(Mfinal - Minicial) / M_inicial <= 1e-5` | masa sumada sobre el conjunto sin emisores/sumideros; errores contabilizados |
| Masa con fuentes | `abs(Mfinal - (Minicial + M_inyectada - M_retirada)) / max(Minicial, Mfinal, epsilon) <= 1e-5` | auditoría de altas/bajas con masas idénticas a las usadas en el solver |
| Error medio de densidad | media de `abs(rho_i-rho0)/rho0 <= 0.01` en región interior y tras estabilización | evitar incluir puntos libres de superficie donde kernel truncado distorsiona densidad |
| Error alto de densidad | percentil 99 de `abs(rho_i-rho0)/rho0 <= 0.05` bajo el mismo criterio | no confundir percentil con cota máxima |
| Convergencia | solver devuelve OK solo si se satisfacen los criterios de densidad/divergencia configurados; si alcanza límite de iteraciones devuelve diagnóstico verificable | tests con casos convergentes y no convergentes; la divergencia se reporta en `1/s` |
| Contacto sólido | no penetración persistente mayor de `0.25 * separación_inicial` en los casos de referencia | medir distancia firmada respecto de fronteras; no sustituye pruebas de túnel |
| Comparación de consumidores Node/navegador (CF-CA-002) | tolerancia relativa `1e-4`, absoluta `1e-5` como propuesta de observables resumidos tras un paso de referencia | documentar plataforma y orden de reducciones; no exigir igualdad bit a bit |
| Temporalidad | `dt > 0` y finito; subpasos gobernados por estabilidad y límite explícito, nunca pérdida silenciosa de tiempo | entradas inválidas, paso 20/60/240 Hz y casos CFL forzado |

`rho0 = 1000 kg/m³` es **valor de configuración de referencia para agua**, no una constante universal ni un modelo térmico. SI (metros, kilogramos, segundos), eje Y vertical del adaptador Century auditado, pero el núcleo no presupone coordenadas del host. El timestep y tamaño de partícula de pruebas deben aparecer en cada fixture; no se inventan aquí resultados de FPS. Los objetivos de tiempo/RAM se medirán en S09 sobre una escena pequeña y una media, y solo podrán ratificarse con especificación de hardware, runtime y visualización.

## Precauciones físicas

- Nunca igualar renderización de superficie con conservación volumétrica.
- La función Jolt `ApplyBuoyancyImpulse` representa un mecanismo útil de flotabilidad basado en un plano de superficie, pero no demuestra acoplamiento de volumen líquido arbitrario. Para una interacción general se requieren muestreos/contactos físicos y reacción consistente a ambos lados.
- No afirmar determinismo entre host Node y navegador ni entre arquitecturas sin comparación de precisión, orden de reducción y plataforma. El antiguo requisito de paridad Rust/WASM está supersedido bajo CF-CA-002.
- Optimizar solo perfiles medidos tras disponer de referencias reproducibles.


> **Continuidad S07 / CF-CA-003 (19-11-2026):** Las referencias anteriores a presets de agua en el núcleo y a `new FluidWorld()` con parámetros implícitos son históricas y quedan sustituidas por `docs/16_CF_CA_003_SOLID_FLUID_ARCHITECTURE_AND_WATER_SPECIALIZATION.md` y `docs/17_S07_SURFACE_EXTRACTION_AND_QA.md`. Se mantienen para trazabilidad, sin exigir compatibilidad pre-1.0.

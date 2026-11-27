# Contract Amendment UPA-CA-001 — Alcance, autoridad y secuencia universal

**ID contractual:** `LF-TIMELINE-UNIVERSAL-PROPERTY-SCOPE-AUTHORITY-S13-G008-UPA-CA-001`  
**Gate documental productor:** `LF-TIMELINE-UNIVERSAL-PROPERTY-SCOPE-AUTHORITY-S13-G008-CA-G001` — autorizado por frase literal en esta conversación el 2026-11-10.  
**ESTADO DE ESTAS CLÁUSULAS:** **RATIFICADO POR EL USUARIO EL 2026-11-10** mediante mensaje literal `Ratifico LF-TIMELINE-UNIVERSAL-PROPERTY-SCOPE-AUTHORITY-S13-G008-UPA-CA-001`. La autorización técnica independiente de `LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-INTEGRAL` se recibió en el mismo mensaje.

**Padres vinculantes:** UA-CA-001 ratificado (UA-01..UA-12), G005 (TA-01..TA-12), CA-TB01-001 ratificado (autoridad, Jolt y snapshots), S15 Camera Orchestration, S05 Cinematics/FilmMaker, contratos de audio y pre-LTS. Cambios no enumerados permanecen sujetos a dichos contratos.

## 1. Intención vinculante ratificada

**Todas las propiedades funcionales editables de todos los tipos de nodo deben tener una vía temporal válida y verificable desde Timeline/Inspector antes de continuar la secuencia de funcionalidades posterior a la universalidad.** La infraestructura universal no garantiza que un tipo arbitrario ya sea interpolable. Su tratamiento puede ser continuo, discreto, cambio de recurso, evento o acción temporal válida que no comprometa los invariantes del proyecto. **Ninguna propiedad se certifica solo por mostrar una llave.**

## 2. UPA-01 a UPA-10

### UPA-01 — Cobertura vinculante
Todos los tipos de nodos y componentes, incluidos los futuros, participarán de una **única arquitectura** de animación. El inventario de campos editables del Inspector es la lista de obligaciones de implementación; una excepción debe quedar identificada y resuelta por semántica, propietario, contrato y evidencia. No se admiten exclusiones masivas por tipo de nodo.

### UPA-02 — Semántica temporal por propiedad
Cada propiedad funcional editable tendrá identificación, tipo, valor autoral, lector runtime, aplicador propietario, interpolación/discreto/evento, autoridad, validación, snapshots, persistencia y prueba de Player. Opciones que son acciones (p.ej., Crear prefab, Ajustar a geometría, Reset) no son campos de valor: se clasifican expresamente como comandos/eventos o como operaciones de editor no animables por semántica, sin convertirlas en números. Referencias/IDs, topología, recursos compartidos y acciones destructivas necesitan reglas específicas, nunca `eval`, setters arbitrarios o manipulación estructural por frame.

### UPA-03 — Autoría desde Inspector
**Mientras haya un recurso Timeline editable abierto, la llave de animación aparecerá junto a cada campo certificado y utilizable** usando los controles originales del Inspector. Su acción crea/reutiliza pista y actualiza clave al cabezal compartido con Undo/Redo. Timeline puede tener también controles directos; no se prohíben ni duplican modelos de autoría. La inserción desde ambos puntos debe producir la misma pista, clave y valoración. No Auto-Key. **Tras ratificación, esta decisión prevalece en la localización de llave frente a la afirmación de CORR-005 de mover exclusivamente la autoría a Timeline**, tanto si su ratificación histórica llega a probarse como si no. La aprobación visual del usuario conserva el diseño de Codex.

### UPA-04 — Fuente de verdad y reutilización
`registerNode/getDef`, controles Inspector, `PROPS`, Timeline model, Animation Clips y aplicadores existentes deben integrarse mediante descriptores del dueño, sin mantener listas conflictivas, managers globales ni estados paralelos. Cada pista conserva ID escena+nodo+propiedad/recurso y cada clave conserva su ID. Los canales incompletos no pueden aparecer como funcionales.

### UPA-05 — Secuenciación de familias especializadas
**Se autoriza reordenar** la certificación de propiedades especializadas para completar la animación universal **antes** de avanzar en nuevas funcionalidades no indispensables. Las integraciones de Canvas `.ui`, Camera3D, materiales, audio, VFX y demás propietarios deben ejecutarse en sus propios Gates autorizados con su QA; las funcionalidades nuevas independientes de G009–G012 NO se anticipan. Esta cláusula cambia PRIORIDAD, no ownership, y NO es autorización técnica transversal ni permiso general para refactorizar propietarios.

### UPA-06 — Autoridad TB01 y propietarios
CA-TB01-001 y reglas de Jolt, Camera Orchestration, Canvas/UI, materiales y Audio Mixer siguen íntegras. Un setter temporal debe pasar por el sistema real propietario. No último escritor gana, no acceso directo a `object3D` por atajo, no animación de rigidbody dinámico sin política física; la ruta `object3D` de G007 sigue NO CERTIFICADA y requiere Gate correctivo propio antes de habilitar canales afectados.

### UPA-07 — Tipos discretos y operaciones
Números, vectores, colores, bool, enums, strings, referencias y subrecursos requieren estrategias tipadas verificadas (continuas/discretas/eventos). La activación de métodos/eventos no se realiza en `seek` editorial. Los valores no válidos y destinos destruidos se rechazan/controlan determinísticamente; snapshots y restauración respetan los canales legados frente a nuevos según TB01.

### UPA-08 — Preservación de scripts, eventos, audio y legacy
Mantener pistas `method` (NodeScriptRuntime con args), `commands` (game.run), audio con clips, tomas explícitas y bake. Verificar PlayMode/Player con seek, loop, stop/skip, nodo eliminado, argumentos y errores. Cinematics consume FilmMaker sin duplicar su propiedad. **No borrar datos ni quitar reproducción actual de clips históricos de Cámara/Nodo** dentro de una simple limpieza de autoría.

### UPA-09 — Retirar únicamente autoría redundante de clips
Dentro de un Gate técnico posterior, retirar de `+ Pista`, menús y controles la **creación nueva** de clips para Cámara/Nodo que contradice las claves de propiedad y la jerarquía. Mantener pistas `node/camera` (keys) y las tomas globales explícitas. Conservar lectura/evaluación/restauración de clips de Camera/Nodo guardados, con prueba de no pérdida. No eliminar formato legado ni crear migraciones retrospectivas pre-LTS sin resolución contractual separada.

### UPA-10 — Certificación y cierre
La cobertura universal SOLO se declara completa con matriz real **nodo → Inspector → propiedad → tipo → lector → aplicador → evaluación → autoridad → snapshots → persistencia → Editor/Player QA**, con evidencias locales del usuario. Pruebas Node y builds no sustituyen QA visual/Player. Mantener estados independientes IMPLEMENTADO, TEST AUTOMATIZADO PASS, COMPILADO, QA LOCAL PASS, APROBADO y CERRADO, y sincronizar las seis hojas del ledger. Bloquear familias sin autoridad certificada, no añadir llaves decorativas.

## 3. Prelación, límites y contradicciones

- **UA-CA-001:** se mantiene; UPA-01..10 especifican el alcance y permiten reordenar únicamente las *dependencias de integración de propiedades* de UA-11 y los Gates G009/G010/G012. **NO se trasladan** todas las funciones de esos Gates al Sprint actual. G011 (Aspect Ratio/Letterbox) y G013/G014 (UX/QA de la secuencia) conservan su alcance, salvo reordenamiento documentado de pruebas indispensables para la universalidad.
- **UA-03/TA-03:** UPA-03 determina la ubicación contextual y el flujo de autoría desde Inspector, resolviendo expresamente el contraste con documentos Codex CORR-005. No invalida otros comportamientos de Timeline que sí sean compatibles.
- **TB01 y S15:** sin modificación. Cualquier conflicto de autoridad no cubierto de manera expresa queda BLOQUEADO y necesita Amendment, no excepciones dentro del código.
- **Pre-LTS:** preservar los datos/proyectos vigentes, sin migraciones retrospectivas ficticias; asegurar que los formatos reales actuales guardan y reproducen igual.
- **Procedencia Codex:** no se declara falsa ni verdadera la ratificación citada en el documento; permanece sin evidencia primaria. La ratificación UPA, si ocurre, constituye la instrucción vinculante más reciente sobre la ubicación de llaves, evitando el conflicto sin falsear el histórico.

## 4. Implementación posterior estrictamente limitada

Esta enmienda NO autoriza editar Inspector, Timeline, Player, Jolt, clips ni ledger de implementación. El siguiente Gate técnico necesita su propia frase exacta y deberá contener los medios de prueba y archivos imprescindibles. No se admite declarar un único Gate de cobertura universal si requiere propietarios no incluidos o autoridad bloqueada. Ver secuencia anexa.

## 5. Evidencia posterior de ratificación

**RATIFICADO el 2026-11-10** con la frase literal `Ratifico LF-TIMELINE-UNIVERSAL-PROPERTY-SCOPE-AUTHORITY-S13-G008-UPA-CA-001`.

En el mismo turno se autorizó el Gate `LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-INTEGRAL`. La ratificación prevalece respecto a la ubicación de llaves, pero **no certifica automáticamente G007, CORR-005, CORR-006 ni la cobertura universal**. Las condiciones TB01 y de autoridad siguen vigentes; la ejecución del Gate integral debe evidenciar sus resultados y registrar los bloqueos reales.

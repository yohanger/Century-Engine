# Solución de problemas

## El nodo no ejecuta su script

Verifica que el script esté en modo **Nodo**, asociado desde el Inspector y que estés en PlayMode. Los scripts no se ejecutan en Edit Mode. Abre Consola para ver excepciones.

## El cuerpo no colisiona

Comprueba que exista un cuerpo `StaticBody3D`, `RigidBody3D` o compatible y que tenga una forma Box/Sphere/Capsule hija directa, habilitada y de dimensiones válidas. Una malla visual no genera colisión automáticamente.

## Un comando de evento no avanza

Comprueba si el comando espera entrada, una señal o un recurso ausente. Revisa las condiciones de la página activa y los mensajes de consola.

## No encuentro una función de API

Busca por nombre en el portal, abre la interfaz correspondiente y confirma la firma publicada. Revisa las limitaciones del sistema y el contexto del script.

## No veo un nodo CollisionShape3D en el catálogo

Por diseño, el catálogo presenta sus variantes **BoxShape3D**, **SphereShape3D** y **CapsuleShape3D**; son recursos del tipo interno `collisionshape3d`.

## El Player no se comporta igual que PlayMode

Comprueba las escenas incluidas en la exportación, scripts, recursos y plataforma. Las suites Node no prueban render, Jolt WASM ni la interfaz Electron; utiliza un build real para el diagnóstico.

## Git no permite cambiar de rama o descargar cambios

Comprueba que el proyecto está guardado, que Git indica estado limpio y que no hay archivos nuevos sin registrar. Los Pull remotos solo admiten avance rápido; consulta [Solución de problemas Git](#/vcs-problemas).

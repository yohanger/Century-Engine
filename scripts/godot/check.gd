extends Node3D
# Carga el nivel exportado, cuenta nodos y guarda capturas: --shot=nombre:x,y,z,tx,ty,tz[;otra:...]  (salida en $LF_SHOTS)
func _ready() -> void:
	var ps: PackedScene = load("res://levels/isla/isla.tscn")
	if ps == null:
		print("CHECK_FAIL: no se pudo cargar isla.tscn"); get_tree().quit(1); return
	var inst := ps.instantiate()
	add_child(inst)
	var counts := {}
	_count(inst, counts)
	print("CHECK_NODES ", JSON.stringify(counts))
	var shots := ""
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shot="): shots = a.substr(7)
	if shots == "":
		print("CHECK_OK"); get_tree().quit(0); return
	var out := OS.get_environment("LF_SHOTS")
	if out == "": out = "/tmp/shots"
	var cam := Camera3D.new()
	cam.fov = 60.0
	cam.far = 4000.0
	add_child(cam)
	cam.current = true
	for s in shots.split(";"):
		var kv := s.split(":")
		var v := kv[1].split(",")
		cam.global_position = Vector3(float(v[0]), float(v[1]), float(v[2]))
		cam.look_at(Vector3(float(v[3]), float(v[4]), float(v[5])), Vector3.UP)
		for i in 8: await get_tree().process_frame
		get_viewport().get_texture().get_image().save_png("%s/%s.png" % [out, kv[0]])
	print("CHECK_OK")
	get_tree().quit(0)
func _count(n: Node, c: Dictionary) -> void:
	c[n.get_class()] = int(c.get(n.get_class(), 0)) + 1
	for k in n.get_children(): _count(k, c)

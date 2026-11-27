from pathlib import Path
import ctypes as C, os, json, math, time, hashlib
from PIL import Image,ImageDraw,ImageFont
os.environ['EGL_PLATFORM']='surfaceless';os.environ['LIBGL_ALWAYS_SOFTWARE']='1'
root=Path(__file__).resolve().parents[1];e=C.CDLL('libEGL.so.1');g=C.CDLL('libGL.so.1');P=C.c_void_p;I=C.c_int;U=C.c_uint;F=C.c_float;B=C.c_ubyte

def bind(lib,name,restype,args):
 f=getattr(lib,name);f.restype=restype;f.argtypes=args;return f
getdisplay=bind(e,'eglGetDisplay',P,[P]);init=bind(e,'eglInitialize',I,[P,C.POINTER(I),C.POINTER(I)]);api=bind(e,'eglBindAPI',I,[U]);choose=bind(e,'eglChooseConfig',I,[P,C.POINTER(I),C.POINTER(P),I,C.POINTER(I)]);surf=bind(e,'eglCreatePbufferSurface',P,[P,P,C.POINTER(I)]);ctx=bind(e,'eglCreateContext',P,[P,P,P,C.POINTER(I)]);current=bind(e,'eglMakeCurrent',I,[P,P,P,P]);d=getdisplay(None);a=I();b=I();assert init(d,C.byref(a),C.byref(b));assert api(0x30A2)
attrs=(I*13)(0x3033,1,0x3040,8,0x3024,8,0x3023,8,0x3022,8,0x3021,8,0x3038);config=P();n=I();assert choose(d,attrs,C.byref(config),1,C.byref(n)) and n.value
W,H=320,240;s=surf(d,config,(I*5)(0x3057,W,0x3056,H,0x3038));c=ctx(d,config,None,(I*5)(0x3098,3,0x30fb,3,0x3038));assert s and c and current(d,s,s,c)
fn=lambda name,ret,*args:bind(g,name,ret,list(args));getstr=fn('glGetString',C.c_char_p,U);print('renderer',getstr(0x1F01).decode(),'version',getstr(0x1F02).decode())
create=fn('glCreateShader',U,U);source=fn('glShaderSource',None,U,I,C.POINTER(C.c_char_p),C.POINTER(I));compile=fn('glCompileShader',None,U);status=fn('glGetShaderiv',None,U,U,C.POINTER(I));slog=fn('glGetShaderInfoLog',None,U,I,C.POINTER(I),C.c_char_p)
p=(root/'src/engine/runtime/render/pbr.js').read_text();block=p.split('.replace(\'#include <project_vertex>\', `#include <project_vertex>')[1].split('`)')[0];vertex='#version 330 core\nlayout(location=0) in vec4 aPosition; layout(location=1) in vec2 aUV; out vec2 uv; uniform vec2 uLfPsxSize; uniform float uLfPsxStep; uniform vec2 uLfPsxPhase;\nvoid main() {uv=aUV;gl_Position=aPosition;'+block+'\n}';fragment='#version 330 core\nin vec2 uv;out vec4 color;void main(){float f=mod(floor(uv.x*14.0)+floor(uv.y*12.0),2.0);color=vec4(mix(vec3(.12,.34,.45),vec3(.88,.83,.68),f),1.0);}'
def shader(typ,src):
 x=create(typ);data=C.c_char_p(src.encode());source(x,1,C.byref(data),None);compile(x);ok=I();status(x,0x8B81,C.byref(ok));buf=C.create_string_buffer(8192);slog(x,len(buf),None,buf);assert ok.value,buf.value;return x
program=fn('glCreateProgram',U)();attach=fn('glAttachShader',None,U,U);attach(program,shader(0x8B31,vertex));attach(program,shader(0x8B30,fragment));fn('glLinkProgram',None,U)(program);ok=I();fn('glGetProgramiv',None,U,U,C.POINTER(I))(program,0x8B82,C.byref(ok));assert ok.value;fn('glUseProgram',None,U)(program)
vao=U();fn('glGenVertexArrays',None,I,C.POINTER(U))(1,C.byref(vao));fn('glBindVertexArray',None,U)(vao);vbo=U();fn('glGenBuffers',None,I,C.POINTER(U))(1,C.byref(vbo));fn('glBindBuffer',None,U,U)(0x8892,vbo);pts=[(-.72,-.61,1,0,0),(.61,-.72,1,1,0),(.43,.71,1.4,1,1),(-.63,.49,1.2,0,1)];data=[]
for i in [0,1,2,0,2,3]:
 x,y,w,u,v=pts[i];data.extend([x*w,y*w,0,w,u,v])
a=(F*len(data))(*data);fn('glBufferData',None,U,C.c_ssize_t,P,U)(0x8892,C.sizeof(a),C.cast(a,P),0x88E4);enable=fn('glEnableVertexAttribArray',None,U);attrib=fn('glVertexAttribPointer',None,U,I,U,B,I,P)
for i,n,o in [(0,4,0),(1,2,16)]:enable(i);attrib(i,n,0x1406,0,24,P(o))
location=fn('glGetUniformLocation',I,U,C.c_char_p);us,ut,up=[location(program,x.encode()) for x in ['uLfPsxSize','uLfPsxStep','uLfPsxPhase']];uniform2=fn('glUniform2f',None,I,F,F);uniform1=fn('glUniform1f',None,I,F);uniform2(us,W,H);fn('glViewport',None,I,I,I,I)(0,0,W,H);fn('glClearColor',None,F,F,F,F)(.07,.1,.15,1);clear=fn('glClear',None,U);draw=fn('glDrawArrays',None,U,I,I);read=fn('glReadPixels',None,I,I,I,I,U,U,P);finish=fn('glFinish',None);err=fn('glGetError',U)
# Obtain the phase progression constants from the actual production method.
import re
vp=(root/'src/engine/runtime/render/viewport.js').read_text();dx,dy=map(float,re.search(r'phase\.set\(\(phase\.x \+ ([\d.]+)\) % 1, \(phase\.y \+ ([\d.]+)\) % 1\)',vp).groups());phase=(0,0)
def frame(step,on,readback=True):
 global phase
 if on and step>0:phase=((phase[0]+dx)%1,(phase[1]+dy)%1)
 else:phase=(0,0)
 uniform1(ut,step);uniform2(up,*phase);clear(0x4000);draw(4,0,6)
 if readback:
  buf=(B*(W*H*4))();read(0,0,W,H,0x1908,0x1401,C.cast(buf,P));return bytes(buf)
checks=[];shots=[]
def check(name,condition):
 checks.append({'check':name,'pass':bool(condition)});assert condition,name
for step in range(5):
 off=frame(step,False);check(f'{step}: stable off',off==frame(step,False));on=[frame(step,True) for _ in range(8)];check(f'{step}: temporal',len(set(on))==(1 if step==0 else len(set(on))) and (step==0 or len(set(on))>1));check(f'{step}: restore',off==frame(step,False));
 if step==4:shots=[off,*on[:2]]
check('OpenGL no error',err()==0)
metrics=[]
for on in [False,True]:
 finish();t=time.perf_counter();
 for _ in range(300):frame(4,on,False)
 finish();metrics.append({'temporal':on,'software_wall_ms_per_frame':(time.perf_counter()-t)*1000/300,'frames':300})
report={'renderer':getstr(0x1F01).decode(),'gl':getstr(0x1F02).decode(),'scope':'Isolated production GLSL quantization with fixed clip coordinates. EGL software rasterizer, not Three.js/Electron; no hardware GPU measurement.','checks':checks,'metrics':metrics};print(json.dumps(report,ensure_ascii=False,indent=2))
img=Image.new('RGB',(1050,345),'#151c29');dr=ImageDraw.Draw(img);font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';dr.text((20,15),'Century · PSX temporal — prueba aislada Mesa/EGL',font=ImageFont.truetype(font,22),fill='#f4f6fb');dr.text((20,47),'Coordenadas fijas · 4 px · shader GLSL de producción · renderizado por software',font=ImageFont.truetype(font,13),fill='#bbcbdc')
for i,(buf,label) in enumerate(zip(shots,['Desactivado','Activado · fotograma 1','Activado · fotograma 2'])):
 x=20+i*345;im=Image.frombytes('RGBA',(W,H),buf).transpose(Image.Transpose.FLIP_TOP_BOTTOM);img.paste(im.convert('RGB'),(x,72));dr.text((x,316),label,font=ImageFont.truetype(font,15),fill='#f4f6fb')
img.save(os.environ.get('PSX_EGL_OUTPUT', 'psx-egl.png'))

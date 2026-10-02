import os,json,shutil,subprocess,hashlib,math,struct,wave
registry=json.load(open('/registry.json'));matrix=registry['matrix'];priority=['vtracer','resvg','libheif','libjxl','vips','libreoffice','pandoc','calibre','ffmpeg','imagemagick','graphicsmagick'];generated=[]
def save(ext,path,source):
 target='/generated/input.'+ext;shutil.copyfile(path,target);generated.append({'input':ext,'source':source,'sha256':hashlib.sha256(open(target,'rb').read()).hexdigest(),'bytes':os.stat(target).st_size})
seeds={'png':'/seeds/logo.png','mp4':'/seeds/short.mp4','woff2':'/seeds/font.woff2'}
for ext,content in {'html':'<html><head><title>Wase matrix fixture</title></head><body><h1>Wase</h1><p>Real conversion fixture 123.</p></body></html>','txt':'Wase Download real conversion fixture 123.','csv':'name,value\nWase,123\n','json':'{"name":"Wase","value":123}','xml':'<?xml version="1.0"?><root><name>Wase</name><value>123</value></root>','obj':'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n','stl':'solid Wase\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid Wase\n','svg':'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><path fill="red" d="M2 2h28v28H2z"/></svg>'}.items():
 path='/tmp/seed.'+ext;open(path,'w').write(content);seeds[ext]=path
with wave.open('/tmp/seed.wav','wb')as w:w.setparams((1,2,16000,0,'NONE','not compressed'));w.writeframes(b''.join(struct.pack('<h',int(12000*math.sin(i*2*math.pi*440/16000)))for i in range(1600)))
seeds['wav']='/tmp/seed.wav'
for ext,path in seeds.items():save(ext,path,'wase-generated-fixture')
families={'png':['jpg','jpeg','webp','gif','bmp','ico','tif','tiff','avif','jxl','heic','heif','ppm','pgm','pbm'],'html':['doc','docx','odt','rtf','pdf','epub','fb2','pptx','odp','markdown','rst','latex'],'wav':['mp3','flac','aac','ogg','opus','m4a','aiff','au'],'mp4':['webm','mov','avi','mkv'],'woff2':['ttf','otf','woff'],'obj':['ply','3ds','fbx']}
for source,targets in families.items():
 for target in targets:
  choices=matrix.get(source,{}).get(target,[])
  order=[e for e in priority if e in choices]+[e for e in choices if e not in priority]
  for engine in order[:3]:
   for f in os.listdir('/job'):
    path='/job/'+f
    if os.path.isdir(path)and not os.path.islink(path):shutil.rmtree(path)
    else:os.unlink(path)
   shutil.copyfile(seeds[source],'/job/input.'+source)
   p=subprocess.run(['timeout','-k','1','15','bun','/engine.mjs',source,target,engine],capture_output=True)
   matches=[f for f in os.listdir('/job')if f.endswith('.'+target)and f!='input.'+source and os.path.isfile('/job/'+f)]
   if p.returncode==0 and matches:
    save(target,'/job/'+matches[0],'wase-generated-fixture: '+source+' → '+target+' ('+engine+')');print(source,'→',target,'generated',flush=True);break
  else:print(source,'→',target,'could not generate',flush=True)
json.dump(generated,open('/generated/manifest.json','w'),indent=2)

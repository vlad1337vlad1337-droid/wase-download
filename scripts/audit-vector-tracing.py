"""Run in the isolated converter image with /engine.mjs and /output-validation.py.

Use --init, no network, read-only root, .25 CPU, 768 MiB, 128 PIDs,
256 MiB /job tmpfs, and a writable /report mount. This is a sequential
regression test, never a production load test. All samples are generated.
"""
import glob,json,os,shutil,signal,subprocess,time,hashlib,struct,xml.etree.ElementTree as ET

os.makedirs('/report',exist_ok=True)
os.makedirs('/tmp/vector-fixtures',exist_ok=True)
fixtures='/tmp/vector-fixtures'
def command(args,timeout=60):
 process=subprocess.Popen(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
 try:
  out,err=process.communicate(timeout=timeout)
  return process.returncode,out,err
 except subprocess.TimeoutExpired:
  try:os.killpg(process.pid,signal.SIGKILL)
  except ProcessLookupError:pass
  out,err=process.communicate()
  return 124,out,err
 finally:
  try:os.killpg(process.pid,signal.SIGKILL)
  except ProcessLookupError:pass

def generate(args):
 code,out,err=command(['magick',*args])
 if code:raise RuntimeError(err.decode('utf8','replace'))

generate(['-size','256x192','xc:white','-fill','#7e63e8','-draw','rectangle 20,20 100,100','-fill','#0babc3','-draw','circle 175,110 175,60',fixtures+'/rgb.jpg'])
generate([fixtures+'/rgb.jpg','-interlace','Plane',fixtures+'/progressive.jpeg'])
generate([fixtures+'/rgb.jpg','-colorspace','CMYK',fixtures+'/cmyk.jpg'])
rgb=open(fixtures+'/rgb.jpg','rb').read()
exif=b'Exif\0\0'+b'II'+struct.pack('<H',42)+struct.pack('<I',8)+struct.pack('<H',1)+struct.pack('<HHI',0x112,3,1)+struct.pack('<H',6)+b'\0\0'+struct.pack('<I',0)
open(fixtures+'/rotated.jpg','wb').write(rgb[:2]+b'\xff\xe1'+struct.pack('>H',len(exif)+2)+exif+rgb[2:])
generate(['-size','64x64','xc:none',fixtures+'/transparent.png'])
for extension in ['png','webp','bmp','gif','tiff','avif','ico']:
 generate([fixtures+'/rgb.jpg',fixtures+'/regular.'+extension])
if os.environ.get('VECTOR_LARGE_JPEG'):shutil.copyfile(os.environ['VECTOR_LARGE_JPEG'],fixtures+'/large-photo.jpg')
else:generate(['-seed','20261003','-size','2048x1536','plasma:fractal','-quality','95',fixtures+'/large-photo.jpg'])
open(fixtures+'/broken.jpg','wb').write(b'not a valid JPEG')
cases=[('rgb.jpg','jpg','vtracer'),('rgb.jpg','jpeg','vtracer'),('progressive.jpeg','jpeg','vtracer'),('cmyk.jpg','jpg','vtracer'),('rotated.jpg','jpeg','vtracer')]
cases += [('regular.'+ext,ext,'vtracer' if ext in ('png','webp','bmp','gif','tiff') else 'imagemagick')for ext in ['png','webp','bmp','gif','tiff','avif','ico']]
cases += [('transparent.png','png','vtracer')]
cases += [('large-photo.jpg','jpeg','vtracer'),('rgb.jpg','jpg','imagemagick'),('broken.jpg','jpg','vtracer'),('broken.jpg','jpg','imagemagick')]
rows=[]
for name,extension,engine in cases:
 for path in glob.glob('/job/*'):
  if os.path.isdir(path):shutil.rmtree(path)
  else:os.unlink(path)
 source=fixtures+'/'+name;shutil.copyfile(source,'/job/input.'+extension)
 start=time.monotonic();code,out,err=command(['bun','/engine.mjs',extension,'svg',engine],60)
 row={'sample':name,'input':extension,'output':'svg','engine':engine,'sourceSHA256':hashlib.sha256(open(source,'rb').read()).hexdigest(),'exit':code,'seconds':round(time.monotonic()-start,3),'passed':False}
 if name=='broken.jpg':row['passed']=code!=0
 elif code==0:
  root=ET.parse('/job/output.svg').getroot();paths=root.findall('{http://www.w3.org/2000/svg}path')
  row.update({'width':root.get('width'),'height':root.get('height'),'viewBox':root.get('viewBox'),'paths':len(paths),'outputBytes':os.stat('/job/output.svg').st_size,'outputSHA256':hashlib.sha256(open('/job/output.svg','rb').read()).hexdigest()})
  row['passed']=root.tag=='{http://www.w3.org/2000/svg}svg'and (len(paths)==0 if name=='transparent.png'else len(paths)>0)
  if name=='large-photo.jpg':row['passed']=row['passed']and row['width']=='2048'and row['height']=='1536'and len(paths)>10 and row['seconds']<60
  if name=='rotated.jpg':row['passed']=row['passed']and row['width']=='192'and row['height']=='256'and row['viewBox']=='0 0 192 256'
 else:row['error']=err.decode('utf8','replace')[-1500:]
 rows.append(row);json.dump({'cpu':0.25,'memoryMiB':768,'pids':128,'cases':rows},open('/report/vector-tracing.json','w'),indent=2);print(json.dumps(row),flush=True)
 if name=='large-photo.jpg'and code==0:shutil.copyfile('/job/output.svg','/report/large-photo.svg')
if not all(row['passed']for row in rows):raise SystemExit(1)

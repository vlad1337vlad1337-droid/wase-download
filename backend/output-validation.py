import os,json,subprocess,struct,zipfile
def validate(ext,path):
 b=open(path,'rb').read(8192)
 if not b:raise ValueError('Empty output')
 if ext=='png':assert b.startswith(b'\x89PNG\r\n\x1a\n')
 elif ext in ('jpg','jpeg'):assert b.startswith(b'\xff\xd8')
 elif ext=='webp':assert b[:4]==b'RIFF' and b[8:12]==b'WEBP'
 elif ext=='gif':assert b.startswith((b'GIF87a',b'GIF89a'))
 elif ext=='bmp':assert b[:2]==b'BM'
 elif ext in ('tif','tiff'):assert b[:4] in (b'II*\0',b'MM\0*')
 elif ext=='svg':
  import xml.etree.ElementTree as ET
  assert ET.parse(path).getroot().tag in ('svg','{http://www.w3.org/2000/svg}svg')
 elif ext=='dzi':
  import xml.etree.ElementTree as ET
  root=ET.parse(path).getroot();assert root.tag.endswith('Image');assert root.attrib.get('Format') in ('jpeg','jpg','png','webp');size=list(root)[0];assert int(size.attrib['Width'])>0 and int(size.attrib['Height'])>0
 elif ext=='pdf':assert b[:5]==b'%PDF-'
 elif ext in ('mp3','wav','flac','aac','ogg','opus','m4a','mp4','mov','webm'):
  p=subprocess.run(['ffprobe','-v','error','-show_streams','-of','json',path],capture_output=True,timeout=5)
  assert p.returncode==0 and json.loads(p.stdout).get('streams')
 elif ext in ('docx','odt','epub','pptx','odp','zip'):
  with zipfile.ZipFile(path)as z:
   assert z.namelist();assert z.testzip() is None
   if ext=='docx':assert 'word/document.xml' in z.namelist()
   if ext=='pptx':assert 'ppt/presentation.xml' in z.namelist()
   if ext=='epub':assert z.read('mimetype')==b'application/epub+zip'
 elif ext in ('tar','tar.gz','tgz','tar.bz2','tar.xz'):
  import tarfile
  with tarfile.open(path) as archive:assert archive.getmembers()
 elif ext in ('avif','jxl','heic','heif'):
  p=subprocess.run(['vipsheader',path],capture_output=True,timeout=5)
  if p.returncode!=0 and ext=='jxl':p=subprocess.run(['djxl',path,'/tmp/validate.png'],capture_output=True,timeout=5)
  assert p.returncode==0
 elif ext in ('ttf','otf','woff','woff2'):
  from fontTools.ttLib import TTFont
  with TTFont(path) as font:assert font.getBestCmap()
 elif ext=='doc':assert b.startswith(bytes.fromhex('d0cf11e0a1b11ae1'))
 elif ext=='json':json.load(open(path))
 elif ext=='xml':
  import xml.etree.ElementTree as ET
  ET.parse(path)
 elif ext=='rtf':assert b.lstrip().startswith(b'{\\rtf')
 elif ext=='html':assert any(token in b.lower() for token in (b'<html',b'<!doctype html',b'<p',b'<h1'))
 elif ext in ('txt','csv'):assert len(b.strip())>0
 elif ext in ('stl','obj','ply','fbx','3ds'):
  p=subprocess.run(['assimp','info',path],capture_output=True,timeout=5);assert p.returncode==0
 else:
  aliases={'jpe':'jpeg','jpg':'jpeg','tif':'tiff','svgz':'svg','pnm':'ppm','mpg':'mpeg','mpegvideo':'mpegvideo','m2v':'mpegvideo','aif':'aiff','mka':'matroska','mkv':'matroska','h264.mp4':'mp4','h265.mp4':'mp4','av1.mp4':'mp4','av1.mkv':'matroska','h265.mkv':'matroska'}
  expected=aliases.get(ext,ext).lower()
  try:
   p=subprocess.run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',path],capture_output=True,timeout=3)
   if p.returncode==0:
    data=json.loads(p.stdout)
    if data.get('streams') and expected in data.get('format',{}).get('format_name','').lower().split(','):return 'passed'
  except Exception:pass
  try:
   p=subprocess.run(['magick','identify','-ping','-format','%m',path],capture_output=True,timeout=3)
   if p.returncode==0 and p.stdout.decode('ascii','ignore').lower()==expected:return 'passed'
  except Exception:pass
  return 'produced-unvalidated' 
 return 'passed'

if __name__=='__main__':
 import sys
 ext,root,source=sys.argv[1:]
 files=[root+'/'+f for f in os.listdir(root) if f!='input.'+source and f.endswith('.'+ext) and os.path.isfile(root+'/'+f) and not os.path.islink(root+'/'+f)]
 known={'png','jpg','jpeg','webp','gif','bmp','tif','tiff','svg','pdf','mp3','wav','flac','aac','ogg','opus','m4a','mp4','mov','webm','docx','odt','epub','pptx','odp','zip','tar','tar.gz','tgz','tar.bz2','tar.xz','dzi','avif','jxl','heic','heif','ttf','otf','woff','woff2','doc','json','xml','rtf','html','txt','csv','stl','obj','ply','fbx','3ds'}
 if ext in known and not files:raise ValueError('No output with requested file type')
 if not files:raise ValueError('No file with requested output type')
 for path in files:
  if validate(ext,path)!='passed':raise ValueError('Could not validate requested output format')

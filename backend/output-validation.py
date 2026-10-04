import os,json,subprocess,struct,zipfile,zlib,mmap,re,math

def validate_text(path,limit=8*1024*1024):
 # Markdown is plain UTF-8 text, not a uniquely identifiable binary type.
 # A bounded complete read rejects binary control bytes and invalid UTF-8.
 if os.path.getsize(path)>limit:raise ValueError('Text output exceeds validation limits')
 with open(path,'rb') as source:text=source.read().decode('utf-8-sig')
 if not text.strip() or any(ord(c)<32 and c not in '\t\n\r\f' for c in text):raise ValueError('Invalid text output')
 return text

def validate_ffmetadata(path):
 text=validate_text(path);lines=text.splitlines()
 if not lines or lines[0]!=';FFMETADATA1':raise ValueError('Invalid FFmetadata header')
 pending=''
 for line in lines[1:]:
  line=pending+line;slashes=len(line)-len(line.rstrip('\\'))
  if slashes%2:pending=line[:-1];continue
  pending=''
  if not line or line.startswith((';','#')) or re.fullmatch(r'\[[A-Z_]+\]',line):continue
  if not re.fullmatch(r'(?:\\.|[^=\\])+=(?:\\.|[^\\])*',line):raise ValueError('Invalid FFmetadata entry')
 if pending:raise ValueError('Truncated FFmetadata escape')

def validate_csljson(path):
 # Bibliographies are arrays of CSL records, not arbitrary JSON. The fields
 # follow https://resource.citationstyles.org/schema/v1.0/input/json/csl-data.json.
 # Also require content: an empty bibliography is not a successful conversion.
 def unique(pairs):
  result={}
  for key,value in pairs:
   if key in result:raise ValueError('Duplicate CSL JSON key')
   result[key]=value
  return result
 def invalid_constant(value):raise ValueError('Non-finite CSL JSON number')
 data=json.loads(validate_text(path),object_pairs_hook=unique,parse_constant=invalid_constant)
 if not isinstance(data,list) or not data or len(data)>20000:raise ValueError('Invalid CSL bibliography')
 types=set('article article-journal article-magazine article-newspaper bill book broadcast chapter classic collection dataset document entry entry-dictionary entry-encyclopedia event figure graphic hearing interview legal_case legislation manuscript map motion_picture musical_score pamphlet paper-conference patent performance periodical personal_communication post post-weblog regulation report review review-book software song speech standard thesis treaty webpage'.split())
 names=set('author chair collection-editor compiler composer container-author contributor curator director editor editorial-director executive-producer guest host interviewer illustrator narrator organizer original-author performer producer recipient reviewed-author script-writer series-creator translator'.split())
 dates=set('accessed available-date event-date issued original-date submitted'.split())
 numbers=set('chapter-number citation-number collection-number edition first-reference-note-number issue locator number number-of-pages number-of-volumes page page-first part printing supplement volume'.split())
 strings=set('citation-key language journalAbbreviation shortTitle abstract annote archive archive_collection archive_location archive-place authority call-number citation-label collection-title container-title container-title-short dimensions division DOI event event-title event-place genre ISBN ISSN jurisdiction keyword medium note original-publisher original-publisher-place original-title part-title PMCID PMID publisher publisher-place references reviewed-genre reviewed-title scale section source status title title-short URL version volume-title volume-title-short year-suffix'.split())
 name_strings=set('family given dropping-particle non-dropping-particle suffix literal'.split());name_flags={'comma-suffix','static-ordering','parse-names'}
 def scalar(value,boolean=False):return isinstance(value,str) or type(value) in (int,float) and math.isfinite(value) or boolean and type(value)is bool
 def text(value):return isinstance(value,str) and bool(value.strip())
 ids=set()
 for item in data:
  if not isinstance(item,dict) or not scalar(item.get('id')) or not str(item['id']).strip() or item.get('type') not in types:raise ValueError('Invalid CSL record identity')
  ident=str(item['id'])
  if ident in ids:raise ValueError('Duplicate CSL record identity')
  ids.add(ident);content=False
  for key,value in item.items():
   if key in ('id','type'):continue
   if key in strings:
    if not isinstance(value,str):raise ValueError('Invalid CSL text field')
    content|=text(value)
   elif key in numbers:
    if not scalar(value):raise ValueError('Invalid CSL number field')
    content|=str(value).strip()!=''
   elif key in names:
    if not isinstance(value,list):raise ValueError('Invalid CSL name list')
    for person in value:
     if not isinstance(person,dict) or set(person)-name_strings-name_flags:raise ValueError('Invalid CSL name')
     if any(not isinstance(v,str) if k in name_strings else not scalar(v,True) for k,v in person.items()):raise ValueError('Invalid CSL name field')
     content|=any(text(person.get(k)) for k in ('family','given','literal'))
   elif key in dates:
    if not isinstance(value,dict) or set(value)-{'date-parts','season','circa','literal','raw'}:raise ValueError('Invalid CSL date')
    for field,part in value.items():
     if field=='date-parts':
      if not isinstance(part,list) or not 1<=len(part)<=2 or any(not isinstance(p,list) or not 1<=len(p)<=3 or any(not scalar(n) for n in p) for p in part):raise ValueError('Invalid CSL date parts')
      content=True
     elif field in ('literal','raw'):
      if not isinstance(part,str):raise ValueError('Invalid CSL date text')
      content|=text(part)
     elif not scalar(part,field=='circa'):raise ValueError('Invalid CSL date flag')
   elif key=='categories':
    if not isinstance(value,list) or any(not isinstance(v,str) for v in value):raise ValueError('Invalid CSL categories')
   elif key=='custom':
    if not isinstance(value,dict):raise ValueError('Invalid CSL custom data')
   else:raise ValueError('Unknown CSL field')
  if not content:raise ValueError('Empty CSL record')

def validate_beamer(path):
 # Accept Pandoc's frame fragments as well as standalone documents. This is
 # TeX structure validation; it neither executes macros nor claims compilation.
 text=validate_text(path);text=re.sub(r'(?<!\\)%[^\n]*','',text)
 stack=[];frames=0
 for action,kind in re.findall(r'\\(begin|end)\{([\w*]+)\}',text):
  if action=='begin':stack.append(kind);frames+=kind=='frame'
  elif not stack or stack.pop()!=kind:raise ValueError('Unbalanced Beamer environment')
 if stack or not frames:raise ValueError('No complete Beamer frame')

def validate_3mf(path):
 import xml.etree.ElementTree as ET
 core='{http://schemas.microsoft.com/3dmanufacturing/core/2015/02}'
 types='{http://schemas.openxmlformats.org/package/2006/content-types}'
 rels='{http://schemas.openxmlformats.org/package/2006/relationships}'
 mime='application/vnd.ms-package.3dmanufacturing-3dmodel+xml'
 with zipfile.ZipFile(path) as archive:
  entries=archive.infolist();names=[entry.filename for entry in entries]
  if len(entries)>5000 or len(names)!=len(set(names)) or sum(e.file_size for e in entries)>200*1024*1024 or any(e.flag_bits&1 or e.compress_type not in (0,8) for e in entries):raise ValueError('3MF package exceeds validation limits')
  if any(n.startswith('/') or '\\' in n or '..' in n.split('/') for n in names):raise ValueError('Unsafe 3MF part name')
  def xml(name,limit):
   if archive.getinfo(name).file_size>limit:raise ValueError('3MF XML exceeds validation limits')
   data=archive.read(name)
   if re.search(br'<!DOCTYPE|<!ENTITY',data,re.I):raise ValueError('Unsafe 3MF XML')
   return ET.fromstring(data)
  content=xml('[Content_Types].xml',1024*1024);relationships=xml('_rels/.rels',1024*1024)
  if content.tag!=types+'Types' or relationships.tag!=rels+'Relationships':raise ValueError('Invalid 3MF package metadata')
  starts=[e for e in relationships if e.tag==rels+'Relationship' and e.get('Type')=='http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel']
  if len(starts)!=1 or starts[0].get('TargetMode','Internal')!='Internal':raise ValueError('Invalid 3MF model relationship')
  part=starts[0].get('Target','').lstrip('/')
  if not part or part not in names:raise ValueError('Missing 3MF model part')
  if not any((e.tag==types+'Override' and e.get('PartName')=='/'+part or e.tag==types+'Default' and e.get('Extension')==part.rsplit('.',1)[-1]) and e.get('ContentType')==mime for e in content):raise ValueError('Incorrect 3MF model content type')
  model=xml(part,16*1024*1024)
  if model.tag!=core+'model':raise ValueError('Invalid 3MF model root')
  resources=model.find(core+'resources');build=model.find(core+'build')
  if resources is None or build is None:raise ValueError('Incomplete 3MF model')
  objects={};meshes=0
  for obj in resources.findall(core+'object'):
   ident=obj.get('id','')
   if not ident.isdigit() or int(ident)<1 or ident in objects:raise ValueError('Invalid 3MF object ID')
   objects[ident]=obj
  for obj in objects.values():
   mesh=obj.find(core+'mesh');components=obj.find(core+'components')
   if (mesh is None)==(components is None):raise ValueError('Invalid 3MF object geometry')
   if mesh is not None:
    vertices=mesh.find(core+'vertices');triangles=mesh.find(core+'triangles')
    if vertices is None or triangles is None or not len(vertices) or not len(triangles):raise ValueError('Empty 3MF mesh')
    for vertex in vertices:
     if vertex.tag!=core+'vertex' or not all(math.isfinite(float(vertex.attrib[k])) for k in ('x','y','z')):raise ValueError('Invalid 3MF vertex')
    for triangle in triangles:
     if triangle.tag!=core+'triangle' or not all(triangle.get(k,'').isdigit() and int(triangle.get(k))<len(vertices) for k in ('v1','v2','v3')):raise ValueError('Invalid 3MF triangle')
    meshes+=1
   elif not len(components) or any(e.tag!=core+'component' or e.get('objectid') not in objects for e in components):raise ValueError('Invalid 3MF components')
  if not meshes or not len(build) or any(e.tag!=core+'item' or e.get('objectid') not in objects for e in build):raise ValueError('No buildable 3MF mesh')
  if archive.testzip() is not None:raise ValueError('Corrupt 3MF package')

def validate_png(path):
 # Check the entire stream, not only its eight-byte signature. Stream chunk
 # CRCs so a large output does not require another full-size memory copy.
 size=os.path.getsize(path);seen=set();idat=False;after_idat=False;image_bytes=0
 with open(path,'rb') as source:
  if source.read(8)!=b'\x89PNG\r\n\x1a\n':raise ValueError('Invalid PNG signature')
  while source.tell()<size:
   header=source.read(8)
   if len(header)!=8:raise ValueError('Truncated PNG chunk')
   length,kind=struct.unpack('>I4s',header)
   if length>0x7fffffff or length+4>size-source.tell():raise ValueError('Truncated PNG data')
   if not all(65<=v<=90 or 97<=v<=122 for v in kind):raise ValueError('Invalid PNG chunk name')
   if not seen and kind!=b'IHDR':raise ValueError('Missing PNG header')
   if kind in (b'IHDR',b'PLTE',b'IEND') and kind in seen:raise ValueError('Duplicate PNG chunk')
   if kind[0]<97 and kind not in (b'IHDR',b'PLTE',b'IDAT',b'IEND'):raise ValueError('Unknown critical PNG chunk')
   if kind==b'IHDR' and length!=13:raise ValueError('Invalid PNG header length')
   if kind==b'PLTE' and (idat or not length or length>768 or length%3):raise ValueError('Invalid PNG palette')
   if kind==b'IDAT':
    if after_idat or color==3 and b'PLTE' not in seen:raise ValueError('Invalid PNG image-data order')
    idat=True;image_bytes+=length
   elif idat:after_idat=True
   crc=zlib.crc32(kind);remaining=length;data=b''
   while remaining:
    block=source.read(min(remaining,65536))
    if not block:raise ValueError('Truncated PNG data')
    remaining-=len(block);crc=zlib.crc32(block,crc)
    if kind==b'IHDR':data+=block
   expected=source.read(4)
   if len(expected)!=4 or struct.unpack('>I',expected)[0]!=(crc&0xffffffff):raise ValueError('Invalid PNG CRC')
   if kind==b'IHDR':
    width,height,depth,color,compression,filtering,interlace=struct.unpack('>IIBBBBB',data)
    if not width or not height or width>0x7fffffff or height>0x7fffffff or depth not in {0:(1,2,4,8,16),2:(8,16),3:(1,2,4,8),4:(8,16),6:(8,16)}.get(color,()) or compression or filtering or interlace not in (0,1):raise ValueError('Invalid PNG image header')
   if kind==b'PLTE' and color in (0,4):raise ValueError('Unexpected grayscale palette')
   seen.add(kind)
   if kind==b'IEND':
    if length or not image_bytes or source.tell()!=size:raise ValueError('Invalid PNG end')
    return
 raise ValueError('Missing PNG end')

def validate_jpeg(path):
 # JPEG entropy bytes are escaped with FF00; restart markers are standalone.
 # Walk every segment/scan through EOI, including progressive multi-scan JPEG.
 # This is bounded structural validation, not a claim of visual fidelity.
 with open(path,'rb') as source:
  if os.fstat(source.fileno()).st_size<4:raise ValueError('Truncated JPEG')
  with mmap.mmap(source.fileno(),0,access=mmap.ACCESS_READ) as data:
   if data[:2]!=b'\xff\xd8':raise ValueError('Invalid JPEG signature')
   offset=2;frame=False;scan=False;entropy=False
   while offset<len(data):
    if entropy:
     marker=data.find(b'\xff',offset)
     if marker<0:raise ValueError('Truncated JPEG scan')
     end=marker+1
     while end<len(data) and data[end]==255:end+=1
     if end==len(data):raise ValueError('Truncated JPEG marker')
     if data[end]==0 or 0xd0<=data[end]<=0xd7:offset=end+1;continue
     offset=marker;entropy=False
    if data[offset]!=255:raise ValueError('Invalid JPEG marker')
    while offset<len(data) and data[offset]==255:offset+=1
    if offset==len(data):raise ValueError('Truncated JPEG marker')
    marker=data[offset];offset+=1
    if marker==0xd9:
     if not frame or not scan:raise ValueError('Missing JPEG image or scan')
     return
    if marker in (0,0xd8) or 0xd0<=marker<=0xd7:raise ValueError('Unexpected JPEG marker')
    if marker==1:continue
    if offset+2>len(data):raise ValueError('Truncated JPEG segment')
    length=struct.unpack('>H',data[offset:offset+2])[0]
    if length<2 or offset+length>len(data):raise ValueError('Invalid JPEG segment length')
    segment=data[offset+2:offset+length];offset+=length
    if 0xc0<=marker<=0xcf and marker not in (0xc4,0xc8,0xcc):
     if len(segment)<6 or len(segment)!=6+3*segment[5] or not segment[5] or not struct.unpack('>H',segment[3:5])[0]:raise ValueError('Invalid JPEG frame')
     frame=True
    if marker==0xda:
     if not frame or len(segment)<4 or len(segment)!=4+2*segment[0] or not segment[0] or offset>=len(data) or data[offset:offset+2]==b'\xff\xd9':raise ValueError('Invalid JPEG scan')
     scan=True;entropy=True
 raise ValueError('Missing JPEG end')

def validate_odf(ext,path):
 import xml.etree.ElementTree as ET
 expected={'odt':b'application/vnd.oasis.opendocument.text','odp':b'application/vnd.oasis.opendocument.presentation'}[ext]
 namespace='{urn:oasis:names:tc:opendocument:xmlns:office:1.0}'
 with zipfile.ZipFile(path) as archive:
  entries=archive.infolist();names=[entry.filename for entry in entries]
  if len(entries)>5000 or len(set(names))!=len(names) or sum(entry.file_size for entry in entries)>200*1024*1024 or any(entry.flag_bits&1 for entry in entries):raise ValueError('ODF package exceeds validation limits')
  if archive.getinfo('mimetype').file_size>256 or archive.read('mimetype')!=expected:raise ValueError('Incorrect ODF mimetype')
  content=archive.getinfo('content.xml')
  root=None;body=False;kind=False;parents=[]
  with archive.open(content) as stream:
   for event,element in ET.iterparse(stream,events=('start','end')):
    if root is None:
     root=element.tag
     if root!=namespace+'document-content':raise ValueError('Invalid ODF document root')
    if event=='start':
     if parents==[namespace+'document-content'] and element.tag==namespace+'body':body=True
     if parents==[namespace+'document-content',namespace+'body'] and element.tag==namespace+('text' if ext=='odt' else 'presentation'):kind=True
     parents.append(element.tag)
    else:parents.pop();element.clear()
  if not body or not kind:raise ValueError('Incorrect ODF document kind')
  if archive.testzip() is not None:raise ValueError('Corrupt ODF package')

def validate(ext,path):
 with open(path,'rb') as source:b=source.read(8192)
 if not b:raise ValueError('Empty output')
 if ext=='png':validate_png(path)
 elif ext in ('jpg','jpeg'):validate_jpeg(path)
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
 elif ext in ('odt','odp'):validate_odf(ext,path)
 elif ext in ('docx','epub','pptx','zip'):
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
  with TTFont(path) as font:
   if font.flavor!=(ext if ext in ('woff','woff2') else None):raise ValueError('Incorrect font container')
   # OpenType permits TrueType outlines in .otf too. Do not reject a valid
   # unwrapped font merely because it uses glyf rather than CFF/CFF2 outlines.
   assert font.getBestCmap()
 elif ext=='doc':assert b.startswith(bytes.fromhex('d0cf11e0a1b11ae1'))
 elif ext=='json':json.load(open(path))
 elif ext=='csljson':validate_csljson(path)
 elif ext=='xml':
  import xml.etree.ElementTree as ET
  ET.parse(path)
 elif ext=='rtf':assert b.lstrip().startswith(b'{\\rtf')
 elif ext=='html':assert any(token in b.lower() for token in (b'<html',b'<!doctype html',b'<p',b'<h1'))
 elif ext=='md':validate_text(path)
 elif ext in ('ffmeta','ffmetadata'):validate_ffmetadata(path)
 elif ext=='beamer':validate_beamer(path)
 elif ext=='3mf':validate_3mf(path)
 elif ext in ('txt','csv'):assert len(b.strip())>0
 elif ext in ('stl','obj','ply','fbx','3ds'):
  p=subprocess.run(['assimp','info',path],capture_output=True,timeout=5);assert p.returncode==0
 else:
  aliases={'adts':'aac','jpe':'jpeg','jpg':'jpeg','tif':'tiff','svgz':'svg','pnm':'ppm','mpg':'mpeg','mpegvideo':'mpegvideo','m2v':'mpegvideo','aif':'aiff','mka':'matroska','mkv':'matroska','h264.mp4':'mp4','h265.mp4':'mp4','av1.mp4':'mp4','av1.mkv':'matroska','h265.mkv':'matroska'}
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

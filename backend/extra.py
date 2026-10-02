"""Bounded archive repacking and real outline/web-font conversion."""
import sys,pathlib,zipfile,tarfile,io,subprocess
engine,source,target=sys.argv[1:];root=pathlib.Path(__import__('os').environ.get('WASE_TEST_JOB','/job'));input=root/('input.'+source);output=root/('output.'+target)
if engine=='wasefont':
 from fontTools.ttLib import TTFont
 font=TTFont(input)
 if target in ('woff','woff2'):
  font.flavor=target;font.save(output)
 else:
  font.flavor=None;normal=root/('normal.otf' if font.sfntVersion=='OTTO' else 'normal.ttf');font.save(normal)
  subprocess.run(['fontforge','-lang=ff','-c','Open($1);Generate($2)',str(normal),str(output)],check=True,timeout=160,stdout=subprocess.DEVNULL)
  normal.unlink()
else:
 limit=150*1024*1024;count=0;total=0;entries=[]
 def add(name,size,reader):
  global count,total
  path=pathlib.PurePosixPath(name.replace('\\','/'))
  if path.is_absolute() or '..' in path.parts or not str(path) or '\x00' in name:raise ValueError('Unsafe archive path')
  count+=1;total+=size
  if count>5000 or size<0 or total>limit:raise ValueError('Archive exceeds extraction budget')
  data=reader.read(size+1)
  if len(data)!=size:raise ValueError('Invalid archive entry size')
  if any(existing==str(path) for existing,_ in entries):raise ValueError('Duplicate archive path')
  entries.append((str(path),data))
 if source=='zip':
  with zipfile.ZipFile(input) as archive:
   for item in archive.infolist():
    if item.is_dir():continue
    if (item.external_attr>>16)&0o170000==0o120000:raise ValueError('Symlink unsupported')
    if item.flag_bits&1:raise ValueError('Encrypted archive unsupported')
    with archive.open(item) as reader:add(item.filename,item.file_size,reader)
 else:
  with tarfile.open(input,'r:*') as archive:
   for item in archive:
    if item.isdir():continue
    if not item.isfile():raise ValueError('Special archive entry unsupported')
    with archive.extractfile(item) as reader:add(item.name,item.size,reader)
 if not entries:raise ValueError('Empty archive')
 if target=='zip':
  with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=3) as archive:
   for name,data in entries:archive.writestr(name,data)
 else:
  mode={'tar':'w','tar.gz':'w:gz','tar.bz2':'w:bz2','tar.xz':'w:xz'}[target]
  with tarfile.open(output,mode) as archive:
   for name,data in entries:
    item=tarfile.TarInfo(name);item.size=len(data);item.mode=0o644;archive.addfile(item,io.BytesIO(data))

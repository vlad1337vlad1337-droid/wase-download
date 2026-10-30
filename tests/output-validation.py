"""Small structural format regressions, without Docker or network access."""
import importlib.util,tempfile,struct,zlib,zipfile,unittest,json
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('validation',Path(__file__).resolve().parents[1]/'backend/output-validation.py')
validation=importlib.util.module_from_spec(spec);spec.loader.exec_module(validation)

def chunk(kind,data=b''):
 return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
def png(depth=8,color=6,interlace=0,extra=b''):
 header=chunk(b'IHDR',struct.pack('>IIBBBBB',1,1,depth,color,0,0,interlace))
 pixels=b'\0'+(b'\0' if color==3 else b'\0\0\0\xff')
 palette=chunk(b'PLTE',b'\0\0\0') if color==3 else b''
 return b'\x89PNG\r\n\x1a\n'+header+palette+extra+chunk(b'IDAT',zlib.compress(pixels))+chunk(b'IEND')
def odf(path,kind='text',mimetype=None,content=None):
 if mimetype is None:mimetype='application/vnd.oasis.opendocument.'+kind
 if content is None:content=f'<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"><office:body><office:{kind}/></office:body></office:document-content>'
 with zipfile.ZipFile(path,'w',compression=zipfile.ZIP_DEFLATED) as archive:
  archive.writestr('mimetype',mimetype,compress_type=zipfile.ZIP_STORED);archive.writestr('content.xml',content)

class OutputValidation(unittest.TestCase):
 def setUp(self):
  self.folder=tempfile.TemporaryDirectory();self.addCleanup(self.folder.cleanup)
 def file(self,ext,data):
  path=Path(self.folder.name)/('result.'+ext);path.write_bytes(data);return str(path)
 def reject(self,ext,data):
  with self.assertRaises(Exception):validation.validate(ext,self.file(ext,data))
 def test_svg_document_type(self):
  self.reject('svg',b'%!PS EPS mislabeled as SVG')
  self.assertEqual(validation.validate('svg',self.file('svg',b'<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>')),'passed')
 def test_png_signature_is_not_a_complete_image(self):
  self.reject('png',b'\x89PNG\r\n\x1a\n')
 def test_valid_png_variants_and_ancillary_chunks(self):
  for image in [png(),png(color=3,depth=1),png(interlace=1),png(extra=chunk(b'tEXt',b'Creator\0Wase Download'))]:
   self.assertEqual(validation.validate('png',self.file('png',image)),'passed')
 def test_png_crc_truncation_and_required_chunks(self):
  image=png()
  for broken in [image[:-1],image[:-12],image[:33]+chunk(b'IEND'),image[:29]+b'\0\0\0\0'+image[33:],image+b'trailing']:self.reject('png',broken)
 def test_png_header_and_palette(self):
  self.reject('png',png(color=1))
  image=png(color=3);start=image.index(b'PLTE')-4;self.reject('png',image[:start]+image[start+15:])
 def test_jpeg_signature_is_not_a_complete_image(self):
  for image in [b'\xff\xd8',b'\xff\xd8\xff\xd9',b'\xff\xd8\xff\xe0\x00\x10too-short']:self.reject('jpg',image)
 def test_jpeg_real_encoder_fixtures(self):
  # Self-generated FFmpeg/vips corpus fixtures. These are real JPEGs, not
  # fabricated SOI/EOI byte sequences; this test checks structure, not pixels.
  for name in ['baseline.jpg','vips.jpg']:
   path=Path(__file__).parent/'fixtures'/name
   self.assertEqual(validation.validate('jpg',str(path)),'passed');self.reject('jpg',path.read_bytes()[:-2])
 def test_jpeg_missing_scan(self):
  frame=b'\x08\0\x01\0\x01\x01\x01\x11\0'
  self.reject('jpg',b'\xff\xd8\xff\xc0'+struct.pack('>H',len(frame)+2)+frame+b'\xff\xd9')
 def test_odf_text_and_presentation(self):
  for ext,kind in [('odt','text'),('odp','presentation')]:
   path=str(Path(self.folder.name)/('correct.'+ext));odf(path,kind);self.assertEqual(validation.validate(ext,path),'passed')
 def test_plain_zip_is_not_an_odf_document(self):
  path=Path(self.folder.name)/'wrong.odt'
  with zipfile.ZipFile(path,'w') as archive:archive.writestr('unrelated.txt','not an ODF document')
  for ext in ['odt','odp']:
   with self.assertRaises(Exception):validation.validate(ext,str(path))
 def test_odf_wrong_mimetype_body_and_xml(self):
  path=str(Path(self.folder.name)/'wrong.odt');ns='urn:oasis:names:tc:opendocument:xmlns:office:1.0'
  for options in [{'mimetype':'application/vnd.oasis.opendocument.presentation'},{'kind':'presentation','mimetype':'application/vnd.oasis.opendocument.text'},{'content':'<broken'},{'content':'<document-content><body><text/></body></document-content>'},{'content':f'<office:document-content xmlns:office="{ns}"><office:body/><office:text/></office:document-content>'}]:
   odf(path,**options)
   with self.assertRaises(Exception):validation.validate('odt',path)
 def test_odf_bomb_is_rejected_before_decompression(self):
  path=str(Path(self.folder.name)/'bomb.odt');odf(path);original=zipfile.ZipFile.infolist
  def bomb(archive):
   entries=original(archive);entries[-1].file_size=201*1024*1024;return entries
  with patch.object(zipfile.ZipFile,'infolist',bomb),patch.object(zipfile.ZipFile,'open',side_effect=AssertionError('must not decompress')):
   with self.assertRaisesRegex(ValueError,'validation limits'):validation.validate('odt',path)
 def test_odf_duplicate_entries_are_rejected(self):
  path=str(Path(self.folder.name)/'duplicate.odt');odf(path)
  import warnings
  with warnings.catch_warnings():
   warnings.simplefilter('ignore')
   with zipfile.ZipFile(path,'a') as archive:archive.writestr('content.xml','ignored duplicate')
  with self.assertRaisesRegex(ValueError,'validation limits'):validation.validate('odt',path)
 def test_markdown_is_complete_utf8_text_not_a_binary_claim(self):
  for text in ['# Привет\n\nSmall **document**.', 'Plain text is valid Markdown too.']:
   self.assertEqual(validation.validate('md',self.file('md',text.encode())),'passed')
  for bad in [b'\xff\xfeinvalid',b'binary\0payload',b'\x01control',b'  \n']:self.reject('md',bad)
  path=self.file('md',b'valid')
  with patch.object(validation.os.path,'getsize',return_value=8*1024*1024+1),patch('builtins.open',side_effect=AssertionError('must not read oversized text')):
   with self.assertRaisesRegex(ValueError,'validation limits'):validation.validate_text(path)
 def test_ffmetadata_header_entries_and_escaping(self):
  for text in [';FFMETADATA1\nencoder=Lavf62.12.102\n',';FFMETADATA1\n; Comment\n[CHAPTER]\nTIMEBASE=1/1000\ntitle=One\\\ntwo\n',';FFMETADATA1\nkey\\=part=value\\\\\n']:
   self.assertEqual(validation.validate('ffmeta',self.file('ffmeta',text.encode())),'passed')
  for bad in [b'arbitrary text',b';FFMETADATA1\nbroken entry\n',b';FFMETADATA1\nkey=value\\',b';FFMETADATA1\nkey=\0binary']:self.reject('ffmeta',bad)
 def test_csljson_bibliographic_records(self):
  records=[{'id':'book-1','type':'book','title':'A real reference','author':[{'family':'Example','given':'Alex'}],'issued':{'date-parts':[[2026,10,4]]}}, {'id':2,'type':'article-journal','title':'Other reference','DOI':'10.1234/example','volume':12,'page':'1-4','editor':[{'literal':'Editorial Board'}],'accessed':{'literal':'October 2026'},'custom':{'reviewed':True}}]
  self.assertEqual(validation.validate('csljson',self.file('csljson',json.dumps(records).encode())),'passed')
 def test_csljson_rejects_empty_arbitrary_and_malformed_bibliographies(self):
  base={'id':'ref-1','type':'book','title':'A real reference'}
  bad=[{},[],[{}],['text'],[{'id':'x','type':'book'}],[{'id':True,'type':'book','title':'X'}],[dict(base,type='unknown')],[dict(base,title=['wrong'])],[dict(base,author='Example')],[dict(base,author=[{'family':12}])],[dict(base,issued={'date-parts':[[2026,1,2,3]]})],[dict(base,issued={'date-parts':[]})],[dict(base,issued={'date-parts':[[True]]})],[dict(base,unrelated='data')],[base,base]]
  for value in bad:self.reject('csljson',json.dumps(value).encode())
  for value in [b'[{"id":"x","type":"book","title":"One","title":"Two"}]',b'[{"id":NaN,"type":"book","title":"X"}]',b'[{"id":"x","type":"book","title":"X"}']:
   self.reject('csljson',value)
 def test_beamer_frame_fragments_and_standalone_documents(self):
  for text in ['\\begin{frame}\n\\end{frame}\n','\\documentclass{beamer}\n\\begin{document}\n\\begin{frame}{Title}\nText\\end{frame}\\end{document}']:
   self.assertEqual(validation.validate('beamer',self.file('beamer',text.encode())),'passed')
  for bad in [b'plain text',b'\\begin{frame}',b'\\begin{frame}\\end{document}',b'% \\begin{frame}\\end{frame}\ntext']:self.reject('beamer',bad)
 def test_adts_uses_aac_probe_alias_without_accepting_other_containers(self):
  import subprocess,json
  path=self.file('adts',b'fixture bytes; probing is mocked in this unit test')
  for container,status in [('aac','passed'),('mp3','produced-unvalidated')]:
   probe=subprocess.CompletedProcess([],0,json.dumps({'streams':[{'codec_type':'audio','codec_name':'aac'}],'format':{'format_name':container}}).encode(),b'')
   def run(command,**kwargs):
    if command[0]=='ffprobe':return probe
    return subprocess.CompletedProcess(command,1,b'',b'not an image')
   with patch.object(validation.subprocess,'run',side_effect=run):self.assertEqual(validation.validate('adts',path),status)
 def test_actual_self_generated_3mf_mesh(self):
  path=Path(__file__).parent/'fixtures/triangle.3mf'
  self.assertEqual(validation.validate('3mf',str(path)),'passed')
  self.reject('3mf',path.read_bytes()[:-20])
 def test_3mf_rejects_plain_zip_empty_model_bad_indices_and_wrong_mimetype(self):
  fixture=Path(__file__).parent/'fixtures/triangle.3mf'
  with zipfile.ZipFile(fixture) as source:parts={name:source.read(name)for name in source.namelist()}
  model=next(name for name in parts if name.endswith('.model'));path=Path(self.folder.name)/'invalid.3mf'
  cases=[{'other.txt':b'not a model'},dict(parts,**{'[Content_Types].xml':parts['[Content_Types].xml'].replace(b'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',b'application/octet-stream')}),dict(parts,**{model:parts[model].replace(b'v1="0"',b'v1="999999"')}),dict(parts,**{model:b'<model xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources/><build/></model>'})]
  for entries in cases:
   with zipfile.ZipFile(path,'w') as archive:
    for name,data in entries.items():archive.writestr(name,data)
   with self.assertRaises(Exception):validation.validate('3mf',str(path))
 def test_3mf_bomb_is_rejected_before_xml_decompression(self):
  path=Path(__file__).parent/'fixtures/triangle.3mf';original=zipfile.ZipFile.infolist
  def bomb(archive):
   entries=original(archive);entries[-1].file_size=201*1024*1024;return entries
  with patch.object(zipfile.ZipFile,'infolist',bomb),patch.object(zipfile.ZipFile,'open',side_effect=AssertionError('must not decompress')):
   with self.assertRaisesRegex(ValueError,'validation limits'):validation.validate('3mf',str(path))

def package(path,entries):
 with zipfile.ZipFile(path,'w',compression=zipfile.ZIP_DEFLATED) as archive:
  for name,data in entries.items():archive.writestr(name,data,compress_type=zipfile.ZIP_STORED if name=='mimetype' else zipfile.ZIP_DEFLATED)
def ooxml(main_type,part='xl/workbook.xml'):
 return {'[Content_Types].xml':f'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/{part}" ContentType="application/vnd.openxmlformats-officedocument.{main_type}"/></Types>','_rels/.rels':'<Relationships/>',part:'<workbook/>'}

class ConverterOutputCoverage(unittest.TestCase):
 """Validators for outputs that previously always failed with 422 (evidence run 2026-10-30)."""
 def setUp(self):
  self.folder=tempfile.TemporaryDirectory();self.addCleanup(self.folder.cleanup)
 def file(self,name,data):
  path=Path(self.folder.name)/name;path.write_bytes(data if isinstance(data,bytes) else data.encode());return str(path)
 def ok(self,ext,data,name=None):self.assertEqual(validation.validate(ext,self.file(name or 'out.'+ext,data)),'passed')
 def bad(self,ext,data,name=None):
  with self.assertRaises(Exception):
   if validation.validate(ext,self.file(name or 'out.'+ext,data))!='passed':raise ValueError('not validated')
 def zipped(self,ext,entries):
  path=str(Path(self.folder.name)/('pkg.'+ext));package(path,entries);return path
 def test_office_open_xml_checks_the_declared_main_part(self):
  self.assertEqual(validation.validate('xlsx',self.zipped('xlsx',ooxml('spreadsheetml.sheet.main+xml'))),'passed')
  self.assertEqual(validation.validate('docm',self.zipped('docm',ooxml('wordprocessingml.document.macroEnabled.main+xml','word/document.xml'))),'passed')
  # LibreOffice labels a macro-free template .dotm; Office rejects that file.
  for ext,entries in [('dotm',ooxml('wordprocessingml.template.main+xml','word/document.xml')),('xlsx',{'other.txt':'x'}),('xlsx',ooxml('spreadsheetml.sheet.main+xml','xl/other.xml'))]:
   with self.assertRaises(Exception):validation.validate(ext,self.zipped(ext,entries))
 def test_open_document_spreadsheets_templates_and_drawings(self):
  ns='urn:oasis:names:tc:opendocument:xmlns:office:1.0'
  content=lambda kind:f'<office:document-content xmlns:office="{ns}"><office:body><office:{kind}/></office:body></office:document-content>'
  self.assertEqual(validation.validate('ods',self.zipped('ods',{'mimetype':'application/vnd.oasis.opendocument.spreadsheet','content.xml':content('spreadsheet')})),'passed')
  self.assertEqual(validation.validate('ott',self.zipped('ott',{'mimetype':'application/vnd.oasis.opendocument.text-template','content.xml':content('text')})),'passed')
  manifest=lambda kind:f'<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"><manifest:file-entry manifest:media-type="application/vnd.oasis.opendocument.{kind}" manifest:full-path="/"/></manifest:manifest>'
  self.assertEqual(validation.validate('odg',self.zipped('odg',{'META-INF/manifest.xml':manifest('graphics'),'content.xml':content('drawing')})),'passed')
  for ext,entries in [('ods',{'mimetype':'application/vnd.oasis.opendocument.text','content.xml':content('spreadsheet')}),('odg',{'META-INF/manifest.xml':manifest('text'),'content.xml':content('drawing')})]:
   with self.assertRaises(Exception):validation.validate(ext,self.zipped(ext,entries))
 def test_epub_variants_and_calibre_zip_books(self):
  for ext in ['epub3','kepub.epub']:self.assertEqual(validation.validate(ext,self.zipped(ext,{'mimetype':'application/epub+zip','OEBPS/content.opf':'<package/>'})),'passed')
  self.assertEqual(validation.validate('htmlz',self.zipped('htmlz',{'index.html':'<p>x</p>'})),'passed')
  with self.assertRaises(Exception):validation.validate('epub2',self.zipped('epub2',{'mimetype':'application/zip'}))
  with self.assertRaises(Exception):validation.validate('txtz',self.zipped('txtz',{'index.html':'x'}))
 def test_binary_ebook_3d_and_vector_signatures(self):
  mobi=b'Unknown'.ljust(60,b'\0')+b'BOOKMOBI'+b'\0'*32
  self.ok('mobi',mobi);self.ok('azw3',mobi);self.bad('mobi',b'\0'*60+b'TEXtREAd')
  self.ok('lit',b'ITOLITLS'+b'\0'*40);self.ok('x',b'xof 0303txt 0032\n');self.ok('stp',b'ISO-10303-21;\nHEADER;')
  self.bad('x',b'\x89PNG\r\n\x1a\n'+b'\0'*20)  # GraphicsMagick's mislabeled ".x"
  emf=struct.pack('<II',1,88)+b'\0'*32+b' EMF'+b'\0'*44
  self.ok('emf',emf);self.bad('emf',b'\0'*88)
  self.ok('wmf',b'\xd7\xcd\xc6\x9a'+b'\0'*18+struct.pack('<HH',1,9)+b'\0'*14);self.bad('wmf',b'not a metafile'*3)
  self.ok('dxf','999\nDXF\n0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n');self.bad('dxf','0\nSECTION\n')
  self.ok('dxf','0\nSECTION\n2\nENTITIES\n'+'0\nLINE\n8\n0\n'*300000+'0\nENDSEC\n0\nEOF\n\n\n\n')  # > 2 MiB, trailing blank lines
  self.ok('stlb',b'\0'*80+struct.pack('<I',1)+b'\0'*50);self.bad('stlb',b'\0'*80+struct.pack('<I',2)+b'\0'*50)
  self.ok('mat',b'MATLAB 5.0 MAT-file, Platform: x'.ljust(128,b' '));self.bad('mat',b'3 4\n0 0 0\n')  # vips matrix text
 def test_glb_and_gltf_require_version_two(self):
  body=b'{"asset":{"version":"2.0"}}  '
  def glb(version,extra=0):return b'glTF'+struct.pack('<II',version,20+len(body)+extra)+struct.pack('<I',len(body))+b'JSON'+body
  self.ok('glb',glb(2));self.bad('glb',glb(1));self.bad('glb',glb(2,4))
  self.ok('gltf','{"asset":{"version":"2.0"},"meshes":[]}');self.bad('gltf','{"asset":{"version":"1.0"}}');self.bad('gltf2','{"meshes":[]}')
 def test_text_markup_and_data_formats(self):
  for ext in ['rst','latex','asciidoc','org','yaml','tsv','typst']:self.ok(ext,'Заголовок\n=========\n\nText.\n')
  for ext in ['rst','yaml']:
   self.bad(ext,b'binary\0data');self.bad(ext,b'\xff\xfe\xfa');self.bad(ext,b'  \n')
  self.ok('docbook','<section xml:id="a"><title>A</title></section><section/>')
  self.ok('opendocument','<text:h text:outline-level="1">A</text:h>')
  self.bad('jats','Plain text without elements')
  self.ok('html5','<h1 id="x">A</h1><p>b</p>');self.ok('revealjs','<section id="a"><h1>A</h1></section>');self.bad('html4','no markup')
  self.ok('fb2','<?xml version="1.0"?><FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><body/></FictionBook>')
  self.bad('fb2','<?xml version="1.0"?><html/>');self.bad('fb2','<!DOCTYPE x [<!ENTITY a "b">]><FictionBook/>')
  self.bad('fb2','<!--'+'x'*70000+'--><!DOCTYPE x [<!ENTITY a "b">]><FictionBook/>')  # entity hidden past the first 64 KiB
  self.ok('toml','title = "x"\n[owner]\nname = "y"\n');self.bad('toml',"[{name = 'alpha'}]\n")  # Dasel's CSV array export is not TOML
  self.ok('ipynb','{"cells":[],"nbformat":4}');self.bad('ipynb','{"cells":{}}')
  self.ok('geojson','{"type":"FeatureCollection","features":[]}');self.bad('assjson','[1,2]')
 def test_large_text_is_checked_on_a_bounded_prefix(self):
  path=self.file('big.latex','é'*(1024*1024+7))
  self.assertEqual(validation.validate('latex',path),'passed')
 def test_ffprobe_aliases_use_real_demuxer_names(self):
  import subprocess
  def probe(name):
   result=subprocess.CompletedProcess([],0,json.dumps({'streams':[{'codec_type':'video'}],'format':{'format_name':name}}).encode(),b'')
   return lambda command,**kwargs:result if command[0]=='ffprobe' else subprocess.CompletedProcess(command,1,b'',b'')
  for ext,name,status in [('ts','mpegts','passed'),('vob','mpeg','passed'),('wma','asf','passed'),('m4b','mov,mp4,m4a,3gp,3g2,mj2','passed'),('264','h264','passed'),('al','alaw','passed'),('ts','mp3','produced-unvalidated'),('al','gsm','produced-unvalidated')]:
   with patch.object(validation.subprocess,'run',side_effect=probe(name)):self.assertEqual(validation.validate(ext,self.file('out.'+ext,b'data')),status,ext)
 def test_imagemagick_multi_frame_output_uses_first_frame_coder(self):
  import subprocess
  def run(command,**kwargs):
   if command[0]=='ffprobe':return subprocess.CompletedProcess(command,1,b'',b'')
   return subprocess.CompletedProcess(command,0,b'PSD\nPSD\n',b'')
  with patch.object(validation.subprocess,'run',side_effect=run):
   self.assertEqual(validation.validate('psd',self.file('out.psd',b'8BPS')),'passed')
   self.assertEqual(validation.validate('png24',self.file('out.png24',b'8BPS')),'produced-unvalidated')

if __name__=='__main__':unittest.main()

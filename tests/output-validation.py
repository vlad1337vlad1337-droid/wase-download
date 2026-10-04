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

if __name__=='__main__':unittest.main()

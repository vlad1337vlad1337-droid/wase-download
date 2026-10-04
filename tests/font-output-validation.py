"""Small synthetic-font regressions; run in the existing converter image.

Requires its existing fontTools and Brotli dependencies. Every test glyph is
generated here from our own rectangle, with no third-party font asset.
"""
import importlib.util,tempfile,unittest,subprocess,os,sys,shutil
from pathlib import Path
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.ttLib import TTFont

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('validation',ROOT/'backend/output-validation.py')
validation=importlib.util.module_from_spec(spec);spec.loader.exec_module(validation)

def draw(pen):
 pen.moveTo((100,0));pen.lineTo((500,0));pen.lineTo((500,700));pen.lineTo((100,700));pen.closePath()
def build(path,truetype):
 builder=FontBuilder(1000,isTTF=truetype);builder.setupGlyphOrder(['.notdef','A']);builder.setupCharacterMap({65:'A'})
 builder.setupHorizontalMetrics({'.notdef':(600,0),'A':(600,0)})
 builder.setupHorizontalHeader(ascent=800,descent=-200)
 builder.setupNameTable({'familyName':'Wase Test','styleName':'Regular','uniqueFontIdentifier':'Wase Test Regular','fullName':'Wase Test Regular','psName':'WaseTest-Regular'})
 builder.setupOS2(sTypoAscender=800,sTypoDescender=-200,usWinAscent=800,usWinDescent=200)
 builder.setupPost()
 if truetype:
  glyphs={}
  for name in ['.notdef','A']:
   pen=TTGlyphPen(None);draw(pen);glyphs[name]=pen.glyph()
  builder.setupGlyf(glyphs)
 else:
  glyphs={}
  for name in ['.notdef','A']:
   pen=T2CharStringPen(600,None);draw(pen);glyphs[name]=pen.getCharString()
  builder.setupCFF('WaseTest-Regular',{},glyphs,{})
 builder.setupMaxp();builder.save(path)

class FontOutputValidation(unittest.TestCase):
 def setUp(self):
  self.folder=tempfile.TemporaryDirectory();self.addCleanup(self.folder.cleanup);self.root=Path(self.folder.name)
  self.ttf=self.root/'test.ttf';self.otf=self.root/'test.otf';build(self.ttf,True);build(self.otf,False)
  self.web={}
  for source in [self.ttf,self.otf]:
   for flavor in ['woff','woff2']:
    path=self.root/(source.stem+'-'+source.suffix[1:]+'.'+flavor)
    with TTFont(source) as font:font.flavor=flavor;font.save(path)
    self.web[(source.suffix,flavor)]=path
 def test_unwrapped_truetype_and_cff(self):
  for path in [self.ttf,self.otf]:
   for ext in ['ttf','otf']:self.assertEqual(validation.validate(ext,str(path)),'passed')
 def test_both_outline_types_in_both_web_containers(self):
  for (_,flavor),path in self.web.items():self.assertEqual(validation.validate(flavor,str(path)),'passed')
 def test_web_wrappers_are_not_outline_files(self):
  for path in self.web.values():
   for ext in ['ttf','otf']:
    with self.assertRaisesRegex(ValueError,'Incorrect font container'):validation.validate(ext,str(path))
 def test_plain_fonts_and_other_web_flavors_are_rejected(self):
  for ext in ['woff','woff2']:
   for path in [self.ttf,self.otf,self.web[('.ttf','woff2' if ext=='woff' else 'woff')]]:
    with self.assertRaisesRegex(ValueError,'Incorrect font container'):validation.validate(ext,str(path))
 def test_all_twelve_real_font_worker_directions(self):
  sources={'ttf':self.ttf,'otf':self.otf,'woff':self.web[('.ttf','woff')],'woff2':self.web[('.ttf','woff2')]}
  for source,path in sources.items():
   for target in sources:
    if source==target:continue
    with tempfile.TemporaryDirectory() as folder:
     job=Path(folder);shutil.copyfile(path,job/('input.'+source))
     process=subprocess.run([sys.executable,str(ROOT/'backend/extra.py'),'wasefont',source,target],env={**os.environ,'WASE_TEST_JOB':str(job)},capture_output=True,timeout=30)
     self.assertEqual(process.returncode,0,process.stderr.decode(errors='replace')[-500:])
     result=job/('output.'+target);self.assertEqual(validation.validate(target,str(result)),'passed')
     with TTFont(result) as font:
      self.assertEqual(font.getBestCmap(),{65:'A'})
      if target=='otf':self.assertIn('CFF ',font)
      if target=='ttf':self.assertIn('glyf',font)

if __name__=='__main__':unittest.main()

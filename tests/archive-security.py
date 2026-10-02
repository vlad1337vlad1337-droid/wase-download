import pathlib,tempfile,subprocess,os,zipfile,tarfile,io,unittest
engine=pathlib.Path(__file__).resolve().parents[1]/'backend/extra.py'
class Archives(unittest.TestCase):
 def run_job(self,source,target,create,ok):
  with tempfile.TemporaryDirectory() as d:
   root=pathlib.Path(d);create(root/('input.'+source))
   result=subprocess.run(['python3',str(engine),'wasearchive',source,target],env={**os.environ,'WASE_TEST_JOB':d},capture_output=True,timeout=10)
   self.assertEqual(result.returncode==0,ok,result.stderr.decode())
   if ok:return (root/('output.'+target)).read_bytes()
   self.assertFalse((root/('output.'+target)).exists())
 def zip(self,items):
  def make(p):
   with zipfile.ZipFile(p,'w') as z:
    for name,data in items:z.writestr(name,data)
  return make
 def test_real_roundtrip(self):
  data=self.run_job('zip','tar.gz',self.zip([('folder/a.txt',b'hello'),('b.txt',b'world')]),True)
  def create(p):p.write_bytes(data)
  result=self.run_job('tar.gz','zip',create,True)
  with zipfile.ZipFile(io.BytesIO(result)) as z:self.assertEqual(z.read('folder/a.txt'),b'hello');self.assertEqual(z.read('b.txt'),b'world')
 def test_traversal(self):self.run_job('zip','tar',self.zip([('../escape.txt',b'bad')]),False)
 def test_absolute(self):self.run_job('zip','tar',self.zip([('/tmp/escape.txt',b'bad')]),False)
 def test_windows_traversal(self):self.run_job('zip','tar',self.zip([('..\\escape.txt',b'bad')]),False)
 def test_duplicate(self):self.run_job('zip','tar',self.zip([('same.txt',b'1'),('same.txt',b'2')]),False)
 def test_zip_symlink(self):
  def make(p):
   with zipfile.ZipFile(p,'w') as z:
    i=zipfile.ZipInfo('link');i.external_attr=(0o120777<<16);z.writestr(i,'/etc/passwd')
  self.run_job('zip','tar',make,False)
 def test_tar_symlink(self):
  def make(p):
   with tarfile.open(p,'w') as z:i=tarfile.TarInfo('link');i.type=tarfile.SYMTYPE;i.linkname='/etc/passwd';z.addfile(i)
  self.run_job('tar','zip',make,False)
 def test_tar_bomb(self):
  def make(p):
   i=tarfile.TarInfo('bomb');i.size=200*1024*1024;p.write_bytes(i.tobuf()+b'\0'*1024)
  self.run_job('tar','zip',make,False)
 def test_entry_limit(self):self.run_job('zip','tar',self.zip([(str(i),b'') for i in range(5001)]),False)
 def test_invalid(self):self.run_job('zip','tar',lambda p:p.write_bytes(b'broken'),False)
if __name__=='__main__':unittest.main()

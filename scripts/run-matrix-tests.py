"""Run inside a networkless read-only converter container. Reports failures, never assumes success."""
import os,json,shutil,subprocess,time,hashlib,struct,zipfile
plan=json.load(open(os.environ.get('MATRIX_PLAN','/corpus/plan.json'))); report='/report/results.jsonl'
completed=set()
if os.path.exists(report):
 for line in open(report):
  v=json.loads(line);completed.add((v['input'],v['output']))
import importlib.util
module=importlib.util.spec_from_file_location('validation','/output-validation.py');validator=importlib.util.module_from_spec(module);module.loader.exec_module(validator);validate=validator.validate
for i,case in enumerate(plan['cases']):
 key=(case['input'],case['output'])
 if key in completed:continue
 started=time.monotonic();result={'input':case['input'],'output':case['output'],'fixture':case['fixture'].split('/')[-1],'attempts':[],'status':'failed'}
 for engine in case['engines'][:3]:
  for f in os.listdir('/job'):
   path='/job/'+f
   if os.path.isdir(path)and not os.path.islink(path):shutil.rmtree(path)
   else:os.unlink(path)
  shutil.copyfile(case['fixture'],'/job/input.'+case['input'])
  p=subprocess.run(['timeout','-k','1','12','bun','/engine.mjs',case['input'],case['output'],engine],capture_output=True)
  attempt={'engine':engine,'exit':p.returncode};result['attempts'].append(attempt)
  if p.returncode!=0:attempt['error']=p.stderr.decode('utf8','replace')[-500:];continue
  outputs=[f for f in os.listdir('/job')if f!='input.'+case['input'] and os.path.isfile('/job/'+f)and not os.path.islink('/job/'+f)]
  if not outputs:attempt['error']='No regular output files';continue
  try:
   matches=[f for f in outputs if f.endswith('.'+case['output'])]
   if not matches:raise ValueError('No file with expected extension')
   statuses=[validate(case['output'],'/job/'+f) for f in matches]
   path='/job/'+matches[0];result['status']='passed' if all(v=='passed' for v in statuses) else 'produced-unvalidated';result['outputFiles']=len(outputs);result['engine']=engine;result['bytes']=os.stat(path).st_size;result['sha256']=hashlib.sha256(open(path,'rb').read()).hexdigest()
   if result['bytes']>2*1024*1024:raise ValueError('Test output budget exceeded')
   break
  except Exception as e:attempt['error']='Invalid output: '+str(e);result['status']='failed'
 result['seconds']=round(time.monotonic()-started,3)
 with open(report,'a')as f:f.write(json.dumps(result)+'\n')
 print(f"{i+1}/{len(plan['cases'])}: {key[0]} → {key[1]}: {result['status']} ({result['seconds']}s)",flush=True)

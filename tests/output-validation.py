import importlib.util,tempfile,os
spec=importlib.util.spec_from_file_location('validation','backend/output-validation.py');validation=importlib.util.module_from_spec(spec);spec.loader.exec_module(validation)
with tempfile.TemporaryDirectory()as d:
 bad=d+'/wrong.svg';open(bad,'w').write('%!PS EPS mislabeled as SVG')
 try:validation.validate('svg',bad)
 except Exception:pass
 else:raise AssertionError('EPS accepted as SVG')
 good=d+'/correct.svg';open(good,'w').write('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');assert validation.validate('svg',good)=='passed'
 bad=d+'/wrong.png';open(bad,'wb').write(b'not a PNG')
 try:validation.validate('png',bad)
 except Exception:pass
 else:raise AssertionError('Bad PNG accepted')
print('Output type rejection checks passed')

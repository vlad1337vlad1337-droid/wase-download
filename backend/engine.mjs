import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import { readdir,lstat,chmod } from 'node:fs/promises';
const dir='/app/dist/src/converters';
const engines={};
for(const f of await readdir(dir)){if(!f.endsWith('.js')||['main.js','types.js'].includes(f))continue;try{const m=await import(`${dir}/${f}`);if(m.properties&&m.convert)engines[f.slice(0,-3)]=m;}catch{}}
const catalog={};
for(const [engine,m] of Object.entries(engines))for(const [category,inputs] of Object.entries(m.properties.from)){const outputs=m.properties.to[category]||[];for(const input of inputs){catalog[input]??={};for(const output of outputs){catalog[input][output]??=[];catalog[input][output].push(engine);}}}
if(process.argv[2]==='catalog'){console.log(JSON.stringify(catalog));process.exit(0);}
const [input,output,engine]=process.argv.slice(2);
if(!catalog[input]?.[output]?.includes(engine))throw new Error('Unsupported conversion');
if(engine==='vips'&&output==='dzi')await promisify(execFile)('vips',['dzsave',`/job/input.${input}`,'/job/output']);else await engines[engine].convert(`/job/input.${input}`,input,output,`/job/output.${output}`);

const outputs=(await readdir('/job')).filter(f=>f!==`input.${input}`);if(!outputs.length)throw new Error('No output files');

async function permissions(folder){await chmod(folder,0o777);for(const file of await readdir(folder)){const p=folder+'/'+file,s=await lstat(p);if(s.isSymbolicLink())throw new Error('Unsafe output');if(s.isDirectory())await permissions(p);else if(s.isFile())await chmod(p,0o644);}}await permissions('/job');

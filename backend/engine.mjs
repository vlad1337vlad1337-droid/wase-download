import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import { readdir,lstat,chmod,rm } from 'node:fs/promises';
const dir='/app/dist/src/converters';
const engines={};
for(const f of await readdir(dir)){if(!f.endsWith('.js')||['main.js','types.js'].includes(f))continue;try{const m=await import(`${dir}/${f}`);if(m.properties&&m.convert)engines[f.slice(0,-3)]=m;}catch{}}
const catalog={},categories={};
for(const [engine,m] of Object.entries(engines))for(const [category,inputs] of Object.entries(m.properties.from)){const outputs=m.properties.to[category]||[];for(const input of inputs){categories[input]??=engine==='calibre'?'ebook':category==='object'?'cad':category==='audio'?'audio':category==='video'?'video':category==='image'?'image':category.includes('presentation')?'presentation':'document';catalog[input]??={};for(const output of outputs){categories[output]??=categories[input];catalog[input][output]??=[];catalog[input][output].push(engine);}}}
for(const ext of ['png','jpg','jpeg','webp','gif','bmp','avif','heic','heif','tif','tiff','ico'])categories[ext]='image';for(const ext of ['mp3','wav','flac','aac','ogg','m4a','opus'])categories[ext]='audio';for(const ext of ['mp4','webm','mov','avi','mkv','m4v','wmv'])categories[ext]='video';for(const ext of ['svg','eps','ai','ps','emf','wmf'])categories[ext]='vector';for(const ext of ['ppt','pptx','odp','pot','potx'])categories[ext]='presentation';for(const ext of ['epub','fb2','mobi','azw','azw3'])categories[ext]='ebook';
for(const ext of ['ttf','otf','woff','woff2']){catalog[ext]={};for(const to of ['ttf','otf','woff','woff2'])if(ext!==to)catalog[ext][to]=['wasefont'];categories[ext]='font';}
for(const ext of ['zip','tar','tar.gz','tgz','tar.bz2','tar.xz']){catalog[ext]={};for(const to of ['zip','tar','tar.gz','tar.bz2','tar.xz'])if(ext!==to)catalog[ext][to]=['wasearchive'];categories[ext]='archive';}
for(const ext of ['ppt','pptx','pptm','pps','ppsx','pot','potx','odp','fodp']){catalog[ext]??={};for(const to of ['pdf','pptx','odp'])if(ext!==to)catalog[ext][to]=['wasepresentation'];categories[ext]='presentation';}
if(process.argv[2]==='catalog'){console.log(JSON.stringify({matrix:catalog,categories}));process.exit(0);}
const [input,output,engine]=process.argv.slice(2);
if(!catalog[input]?.[output]?.includes(engine))throw new Error('Unsupported conversion');
if(engine==='wasepresentation'){const filters={pdf:'impress_pdf_Export',pptx:'Impress MS PowerPoint 2007 XML',odp:'impress8'};await promisify(execFile)('soffice',['--headless','-env:UserInstallation=file:///tmp/wase-impress','--convert-to',output+':'+filters[output],'--outdir','/job',`/job/input.${input}`],{timeout:160000});}else if(engine==='wasefont'||engine==='wasearchive')await promisify(execFile)('python3',['/extra.py',engine,input,output],{timeout:170000});else if(output==='avif')await promisify(execFile)('ffmpeg',['-nostdin','-y','-threads','1','-i',`/job/input.${input}`,'-frames:v','1','-c:v','libaom-av1','-cpu-used','8','-crf','30','-still-picture','1','-threads','1','/job/output.avif'],{timeout:50000});else if(output==='svg'&&['avif','heic','heif','jxl'].includes(input)){await engines.vips.convert(`/job/input.${input}`,input,'png','/job/normalized.png');await engines.vtracer.convert('/job/normalized.png','png','svg','/job/output.svg');await rm('/job/normalized.png');}else if(engine==='vips'&&output==='dzi')await promisify(execFile)('vips',['dzsave',`/job/input.${input}`,'/job/output']);else await engines[engine].convert(`/job/input.${input}`,input,output,`/job/output.${output}`);

const outputs=(await readdir('/job')).filter(f=>f!==`input.${input}`);if(!outputs.length)throw new Error('No output files');

// The broker owns the mounted root and input; only converter-created outputs belong to this UID.
async function permissions(folder){if(folder!=='/job')await chmod(folder,0o777);for(const file of await readdir(folder)){if(folder==='/job'&&file===`input.${input}`)continue;const p=folder+'/'+file,s=await lstat(p);if(s.isSymbolicLink())throw new Error('Unsafe output');if(s.isDirectory())await permissions(p);else if(s.isFile())await chmod(p,0o644);}}await permissions('/job');

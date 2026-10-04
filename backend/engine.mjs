import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import { readdir,lstat,chmod,rm,readFile,writeFile } from 'node:fs/promises';
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
const traceInputs=new Set(['jpg','jpeg','jpe','png','bmp','gif','webp','tif','tiff','ico','avif','heic','heif','jxl']);
// Full-resolution photographs can exceed the ordinary 60-second engine budget.
// Normalize codecs/colors/orientation, keep the original SVG canvas, and bound
// tracing detail rather than increasing the worker's production CPU allowance.
async function traceRaster(){
 const started=performance.now(),source=`/job/input.${input}`,normalized='/job/normalized.png';
 const call=(program,args,budget)=>{const remaining=120000-(performance.now()-started);if(remaining<=0)throw new Error('Vector tracing deadline exceeded');return promisify(execFile)(program,args,{timeout:Math.max(1,Math.floor(Math.min(budget,remaining))),maxBuffer:65536,env:{...process.env,VIPS_CONCURRENCY:'1'}});};
 const metadata=await call('vipsheader',['-a',source],5000);
 const width=Number(metadata.stdout.match(/^width:\s*(\d+)/m)?.[1]),height=Number(metadata.stdout.match(/^height:\s*(\d+)/m)?.[1]);
 if(!width||!height)throw new Error('Could not read raster dimensions');
 const orientation=Number(metadata.stdout.match(/^orientation:\s*(\d+)/m)?.[1]);
 const rotated=orientation>=5&&orientation<=8,canvasWidth=rotated?height:width,canvasHeight=rotated?width:height;
 const detailed=width*height<=1024*1024&&Math.max(width,height)<=1536;
 let failure;
 try{
  // Complex photos start at the useful trace resolution instead of spending
  // most of the budget on a 1536-pixel attempt that slow workers cannot finish.
  const edges=detailed?[1536,1024]:[1024,768];
  for(const [index,edge]of edges.entries()){
   try{
    await rm('/job/output.svg',{force:true});await rm(normalized,{force:true});
    await call('vips',['thumbnail',source,normalized,String(edge),'--height',String(edge),'--size','down'],10000);
    const dimensions=await call('vipsheader',['-a',normalized],5000);
    const tracedWidth=Number(dimensions.stdout.match(/^width:\s*(\d+)/m)?.[1]),tracedHeight=Number(dimensions.stdout.match(/^height:\s*(\d+)/m)?.[1]);
    const bands=Number(dimensions.stdout.match(/^bands:\s*(\d+)/m)?.[1]),space=dimensions.stdout.match(/^interpretation:\s*(\S+)/m)?.[1];
    let alphaMask='';
    // VTracer 0.6.4 panics when every pixel is transparent. Its correct vector
    // representation is an empty canvas, rather than a rejected valid image.
    if((bands===4&&space==='srgb')||(bands===2&&space==='b-w')){
     await call('vips',['extract_band',normalized,'/tmp/wase-alpha.v',String(bands-1)],5000);
     const alpha=await call('vips',['max','/tmp/wase-alpha.v'],5000);
     if(Number(alpha.stdout.trim())===0){await writeFile('/job/output.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}"/>`);return;}
     const minimum=await call('vips',['min','/tmp/wase-alpha.v'],5000);
     if(Number(minimum.stdout.trim())<255){
      // VTracer traces colours but discards partial opacity. Trace the alpha
      // plane separately into vector paths; never disguise a bitmap as SVG.
      // This allowance is part of the existing whole-pipeline deadline.
      await call('vips',['copy','/tmp/wase-alpha.v','/tmp/wase-alpha.png'],5000);
      await call('vtracer',['--input','/tmp/wase-alpha.png','--output','/tmp/wase-alpha.svg','--colormode','color','--hierarchical','cutout','--color_precision','8','--gradient_step','1','--filter_speckle','0','--mode','polygon'],15000);
      const mask=await readFile('/tmp/wase-alpha.svg','utf8');
      const maskBody=mask.match(/<svg\b[^>]*>([\s\S]*?)<\/svg>/)?.[1];
      if(!maskBody?.trim())throw new Error('Could not preserve raster transparency');
      alphaMask=maskBody.replace(/fill="#([0-9a-f]{2})\1\1"/gi,(_match,channel)=>`fill="#fff" fill-opacity="${(parseInt(channel,16)/255).toFixed(5)}"`);
      if(/fill="(?!#fff")/.test(alphaMask))throw new Error('Unsupported alpha mask colour');
     }
    }
    const traceBudget=index===0?(detailed?60000:85000):(detailed?45000:25000);
    await call('vtracer',['--input',normalized,'--output','/job/output.svg',...(!detailed||index>0?['--preset','poster']:[]),...(!detailed?['--mode','polygon']:[])],traceBudget);
    const svg=await readFile('/job/output.svg','utf8');
    // A fully transparent source can legitimately produce an empty SVG.
    if(!/<svg\b/.test(svg))throw new Error('No SVG document produced');
    let result=svg.replace(/<svg\b([^>]*)>/,(_match,attributes)=>'<svg'+attributes.replace(/\s(?:width|height|viewBox)="[^"]*"/g,'')+` width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${tracedWidth} ${tracedHeight}">`);
    if(alphaMask)result=result.replace(/(<svg\b[^>]*>)([\s\S]*?)(<\/svg>)/,(_match,start,body,end)=>`${start}<defs><mask id="wase-alpha" x="0" y="0" width="100%" height="100%">${alphaMask}</mask></defs><g mask="url(#wase-alpha)">${body}</g>${end}`);
    await writeFile('/job/output.svg',result);return;
   }catch(error){failure=error;if(performance.now()-started>=120000)break;}
  }
  throw failure||new Error('Could not trace raster image');
 }finally{await rm(normalized,{force:true});}
}
let conversionError;try{
if(output==='svg'&&traceInputs.has(input))await traceRaster();else if(engine==='wasepresentation'){const filters={pdf:'impress_pdf_Export',pptx:'Impress MS PowerPoint 2007 XML',odp:'impress8'};await promisify(execFile)('soffice',['--headless','-env:UserInstallation=file:///tmp/wase-impress','--convert-to',output+':'+filters[output],'--outdir','/job',`/job/input.${input}`],{timeout:160000});}else if(engine==='wasefont'||engine==='wasearchive')await promisify(execFile)('python3',['/extra.py',engine,input,output],{timeout:170000});else if(output==='avif')await promisify(execFile)('ffmpeg',['-nostdin','-y','-threads','1','-i',`/job/input.${input}`,'-frames:v','1','-c:v','libaom-av1','-cpu-used','8','-crf','30','-still-picture','1','-threads','1','/job/output.avif'],{timeout:50000});else if(engine==='ffmpeg'&&['3gp','3g2'].includes(output)){
 // The 3G2 muxer defaults to AMR, whose encoder is absent in the pinned
 // image. Encode supported streams explicitly and retain the real muxer.
 await promisify(execFile)('ffmpeg',['-nostdin','-y','-threads','1','-i',`/job/input.${input}`,'-map','0:v:0?','-map','0:a:0?','-sn','-dn','-c:v','mpeg4','-q:v','5','-pix_fmt','yuv420p','-vf','scale=ceil(iw/2)*2:ceil(ih/2)*2','-c:a','aac','-b:a','128k','-threads','1','-f',output,`/job/output.${output}`],{timeout:60000});
}else if(engine==='ffmpeg'&&['png','jpg','jpeg','bmp','ico','tif','tiff'].includes(output))await promisify(execFile)('ffmpeg',['-nostdin','-y','-threads','1','-i',`/job/input.${input}`,...(output==='ico'?['-vf','scale=256:256:force_original_aspect_ratio=decrease']:[]),'-frames:v','1','-threads','1',`/job/output.${output}`],{timeout:60000});else if(engine==='vips'&&output==='dzi')await promisify(execFile)('vips',['dzsave',`/job/input.${input}`,'/job/output']);else await engines[engine].convert(`/job/input.${input}`,engine==='pandoc'&&input==='pandoc native'?'native':input,output,`/job/output.${output}`);

}catch(error){conversionError=error;}

const outputs=(await readdir('/job')).filter(f=>f!==`input.${input}`);

// The broker owns the mounted root and input; only converter-created outputs belong to this UID.
async function permissions(folder){if(folder!=='/job')await chmod(folder,0o777);for(const file of await readdir(folder)){if(folder==='/job'&&file===`input.${input}`)continue;const p=folder+'/'+file,s=await lstat(p);if(s.isSymbolicLink())throw new Error('Unsafe output');if(s.isDirectory())await permissions(p);else if(s.isFile())await chmod(p,0o644);}}await permissions('/job');

if(conversionError)throw conversionError;
// Reject invalid or mislabeled common outputs before accepting an engine attempt.
await promisify(execFile)('python3',['/output-validation.py',output,'/job',input],{timeout:10000});

if(!outputs.length)throw new Error('No output files');

// Docker tmpfs disappears on stop; the broker copies output before removing us.
if(process.argv[5]==='hold'){console.log('\nWASE_OUTPUT_READY');await new Promise(()=>{setTimeout(()=>process.exit(0),180000);});}

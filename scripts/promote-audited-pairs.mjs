// SPDX-License-Identifier: MIT
// Merge only explicitly reviewed, current-worker and downloaded-HTTP evidence.
// Usage: node scripts/promote-audited-pairs.mjs --semantic review.json
//   --worker final-0.jsonl --worker final-1.jsonl --http validated.jsonl
//   --revision <64-character source digest> [--report report.json] [--apply]
// Without --apply this command cannot change published pair or receipt files.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {pairs as baseline} from '../site/src/strings.js';
import {publicCatalogue} from '../backend/conversion-policy.mjs';

const digest=/^[a-f0-9]{64}$/;
// These duplicate spellings/encoder variants remain usable in the converter;
// this gate only avoids adding redundant canonical search landing pages.
const aliasIdentifiers=new Set('jpeg jpe pjpeg tif htm 264 avc 265 h265 png00 png8 png24 png32 png48 png64 icon bie jbg icb vda vst'.split(' '));
const metadataIdentifiers=new Set(['ffmeta','ffmetadata']);
const heldPairs=new Set(['bvh:stl','csljson:beamer']);
const keyOf=value=>`${String(value.input).toLowerCase()}:${String(value.output).toLowerCase()}`;
const slugPart=value=>value.toLowerCase().replace(/[^a-z0-9.-]+/g,'-');
const nonempty=value=>typeof value==='string'&&value.trim().length>0;
const positive=value=>Number.isSafeInteger(value)&&value>0;
const describedCheck=value=>nonempty(value)||(value&&typeof value==='object'&&!Array.isArray(value)&&nonempty(value.check)&&value.passed!==false&&value.status!=='failed');

function recordMap(records,label){
 if(!Array.isArray(records))throw new TypeError(`${label} must be an array`);
 const map=new Map();
 for(const record of records){
  if(!record||!nonempty(record.input)||!nonempty(record.output))throw new TypeError(`${label} record lacks input/output`);
  const key=keyOf(record);if(map.has(key))throw new Error(`Duplicate ${label} evidence for ${key}`);
  map.set(key,record);
 }
 return map;
}
function validFiles(files,output){
 // OBJ has a legitimate MTL companion. It is not itself the requested mesh:
 // require a primary OBJ and still hash every narrowly allowed companion.
 const extensions=output==='obj'?['obj','mtl']:[output];
 return Array.isArray(files)&&files.length>0&&files.some(file=>typeof file.name==='string'&&file.name.toLowerCase().endsWith('.'+output))&&new Set(files.map(f=>f.name)).size===files.length&&files.every(file=>
  nonempty(file.name)&&!/[\\/]/.test(file.name)&&extensions.some(ext=>file.name.toLowerCase().endsWith('.'+ext))&&positive(file.bytes)&&digest.test(file.sha256));
}

export function mergeAuditedPairs({existingPairs,existingReceipts,baselinePairs=baseline,catalogue,semanticReview,workerResults,httpResults,revision}){
 if(!digest.test(revision))throw new TypeError('An exact final source revision SHA256 is required');
 if(!existingPairs||Array.isArray(existingPairs)||typeof existingPairs!=='object'||!Array.isArray(existingReceipts))throw new TypeError('Invalid existing pair/receipt data');
 if(semanticReview?.schemaVersion!==1||!Array.isArray(semanticReview.cases))throw new TypeError('Explicit schemaVersion 1 semantic review is required');
 const review=recordMap(semanticReview.cases,'semantic'),workers=recordMap(workerResults,'worker'),http=recordMap(httpResults,'HTTP');
 const pairs={...existingPairs},receipts=[...existingReceipts],added=[],excluded=[],rejected=[],existing=[];
 const publishedByKey=new Map(Object.entries({...baselinePairs,...existingPairs}).map(([slug,pair])=>[pair.map(v=>v.toLowerCase()).join(':'),slug]));
 for(const [key,candidate]of review){
  const input=candidate.input.toLowerCase(),output=candidate.output.toLowerCase();
  if(candidate.decision!=='candidate-after-final-worker-http-content-checks'){
   excluded.push({input,output,reason:candidate.reason||'Not explicitly approved for evidence checks'});continue;
  }
  if(publishedByKey.has(key)){existing.push({input,output,slug:publishedByKey.get(key)});continue;}
  const worker=workers.get(key),receipt=http.get(key),reasons=[];
  const require=(valid,reason)=>{if(!valid)reasons.push(reason);};
  require(input!==output,'Same-format rewrite');
  require(![input,output].some(value=>aliasIdentifiers.has(value)),'Canonical alias or PNG encoder variant');
  require(![input,output].some(value=>metadataIdentifiers.has(value)),'Metadata-only direction');
  require(!heldPairs.has(key),'Ambiguous content transformation is held for dedicated content evidence');
  require(nonempty(candidate.reason),'Missing semantic review reason');
  require(catalogue.groups[catalogue.inputs[input]]?.includes(output),'Pair absent from current public catalogue');
  require(digest.test(candidate.sourceSHA256),'Missing reviewed fixture SHA256');
  require(worker?.status==='passed','Final worker did not pass');
  require(worker?.revision===revision,'Worker revision differs from final source digest');
  require(worker?.sourceSHA256===candidate.sourceSHA256,'Worker fixture differs from reviewed fixture');
  require(nonempty(worker?.engine)&&nonempty(worker?.fixture),'Worker lacks engine/fixture evidence');
  require(validFiles(worker?.files,output),'Worker lacks complete requested-format/allowed-companion output hashes');
  require(!(output==='txt'&&['imagemagick','graphicsmagick'].includes(worker?.engine)),'ImageMagick TXT pixel enumeration is not document text');
  require(receipt?.status==='passed'&&receipt?.http===200,'HTTP conversion did not pass with status 200');
  require(receipt?.revision===revision,'HTTP revision differs from final source digest');
  require(receipt?.fixtureSHA256===candidate.sourceSHA256,'HTTP fixture differs from reviewed fixture');
  require(nonempty(receipt?.fixtureSource),'Missing HTTP fixture provenance');
  require(positive(receipt?.bytes)&&digest.test(receipt?.sha256),'Missing downloaded HTTP payload hash/size');
  require(validFiles(receipt?.outputFiles,output),'HTTP lacks validated requested-format/allowed-companion payload hashes');
  const validation=receipt?.validation;
  require(validation?.status==='passed'&&validation?.requestedFormat===output&&validation?.contentChecked===true,'Downloaded requested-format content was not validated');
  require(Array.isArray(validation?.checks)&&validation.checks.length>0&&validation.checks.every(describedCheck),'Missing or failed downloaded content-check descriptions');
  require(Array.isArray(validation?.limitations)&&validation.limitations.length>0&&validation.limitations.every(nonempty),'Missing explicit content-validation limitations');
  if(reasons.length){rejected.push({input,output,reasons});continue;}
  const slug=`${slugPart(input)}-to-${slugPart(output)}`;
  if(Object.hasOwn(pairs,slug)||Object.hasOwn(baselinePairs,slug))throw new Error(`Pair slug collision: ${slug}`);
  pairs[slug]=[input.toUpperCase(),output.toUpperCase()];publishedByKey.set(key,slug);
  receipts.push({...worker,input,output,bytes:receipt.bytes,sha256:receipt.sha256,fixtureSHA256:candidate.sourceSHA256,fixtureSource:receipt.fixtureSource,httpVerification:receipt,admission:{sourceRevision:revision,scope:'Representative fixture, current worker and downloaded HTTP output validation; not arbitrary-file or full-fidelity certification',semanticReason:candidate.reason,semanticNotes:candidate.semanticNotes||[]}});
  added.push({input,output,slug});
 }
 return {pairs,receipts,report:{sourceRevision:revision,reviewed:review.size,added,excluded,rejected,existing,previousPairCount:Object.keys(existingPairs).length,resultPairCount:Object.keys(pairs).length,previousReceiptCount:existingReceipts.length,resultReceiptCount:receipts.length}};
}

function readRecords(file){
 const text=fs.readFileSync(file,'utf8').trim();if(!text)return [];
 let parsed;try{parsed=JSON.parse(text);}catch{return text.split(/\r?\n/).filter(Boolean).map(JSON.parse);}
 if(Array.isArray(parsed))return parsed;
 if(Array.isArray(parsed.results))return parsed.results;
 return [parsed];
}
function applyMerge(files){
 // Validate/write everything before either public file is replaced. Restore the
 // old bytes if a second rename fails, preserving all historical evidence.
 const token=randomUUID(),pending=[];let replaced=0;
 try{
  for(const file of files){if(fs.readFileSync(file.path,'utf8')!==file.original)throw new Error(`Concurrent modification: ${file.path}`);const temporary=file.path+'.'+token+'.tmp';fs.writeFileSync(temporary,file.next,{flag:'wx'});pending.push({...file,temporary});}
  for(const file of pending){if(fs.readFileSync(file.path,'utf8')!==file.original)throw new Error(`Concurrent modification: ${file.path}`);fs.renameSync(file.temporary,file.path);replaced++;}
 }catch(error){for(const file of pending.slice(0,replaced)){const restore=file.path+'.'+token+'.restore';fs.writeFileSync(restore,file.original);fs.renameSync(restore,file.path);}throw error;
 }finally{for(const file of pending)fs.rmSync(file.temporary,{force:true});}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const options={worker:[],http:[],apply:false};
 for(let i=2;i<process.argv.length;i++){
  const name=process.argv[i];if(name==='--apply'){options.apply=true;continue;}
  if(!['--semantic','--worker','--http','--revision','--report'].includes(name)||!process.argv[i+1]||process.argv[i+1].startsWith('--'))throw new Error('Usage: --semantic review.json --worker final.jsonl [--worker ...] --http validated.jsonl --revision SHA256 [--report report.json] [--apply]');
  const key=name.slice(2),value=process.argv[++i];if(key==='worker'||key==='http')options[key].push(value);else if(options[key])throw new Error('Repeated option '+name);else options[key]=value;
 }
 if(!options.semantic||!options.worker.length||!options.http.length||!options.revision)throw new Error('Semantic review, worker results, validated HTTP results and exact revision are required');
 const repo=fileURLToPath(new URL('../',import.meta.url)),pairFile=path.join(repo,'site/data/verified-pairs.json'),receiptFile=path.join(repo,'deploy/seo/verified-receipts.json');
 if(options.report&&[pairFile,receiptFile,options.semantic,...options.worker,...options.http].some(file=>path.resolve(file)===path.resolve(options.report)))throw new Error('The report must not overwrite published data or source evidence');
 const pairRaw=fs.readFileSync(pairFile,'utf8'),receiptRaw=fs.readFileSync(receiptFile,'utf8');
 const result=mergeAuditedPairs({existingPairs:JSON.parse(pairRaw),existingReceipts:JSON.parse(receiptRaw),catalogue:publicCatalogue(JSON.parse(fs.readFileSync(path.join(repo,'site/data/catalog.json'),'utf8'))),semanticReview:JSON.parse(fs.readFileSync(options.semantic,'utf8')),workerResults:options.worker.flatMap(readRecords),httpResults:options.http.flatMap(readRecords),revision:options.revision});
 const report={generatedAtUTC:new Date().toISOString(),applied:options.apply,...result.report};
 if(options.apply){
  if(!result.report.added.length)throw new Error('No complete, eligible new evidence to apply');
  applyMerge([{path:pairFile,original:pairRaw,next:JSON.stringify(result.pairs,null,2)+'\n'},{path:receiptFile,original:receiptRaw,next:JSON.stringify(result.receipts,null,2)+'\n'}]);
 }
 if(options.report)fs.writeFileSync(options.report,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({applied:options.apply,reviewed:report.reviewed,added:report.added.length,excluded:report.excluded.length,rejected:report.rejected.length,existing:report.existing.length,sourceRevision:report.sourceRevision},null,2));
}

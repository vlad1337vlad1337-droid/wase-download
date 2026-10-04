import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergeAuditedPairs} from '../scripts/promote-audited-pairs.mjs';
const revision='a'.repeat(64),fixtureSHA256='b'.repeat(64),sha256='c'.repeat(64);
function data(input='heic',output='png'){
 const file={name:'output.'+output,bytes:128,sha256};
 return {existingPairs:{'svg-to-png':['SVG','PNG']},existingReceipts:[{input:'svg',output:'png',historical:'must remain identical'}],baselinePairs:{},catalogue:{inputs:{[input]:0},groups:[[output]]},semanticReview:{schemaVersion:1,cases:[{input,output,decision:'candidate-after-final-worker-http-content-checks',reason:'Distinct file transformation',sourceSHA256:fixtureSHA256,semanticNotes:['Representative fixture only']}]},workerResults:[{input,output,revision,sourceSHA256:fixtureSHA256,fixture:'fixtures/example.'+input,engine:'libheif',status:'passed',files:[file]}],httpResults:[{input,output,status:'passed',http:200,bytes:128,sha256,fixtureSHA256,fixtureSource:'wase-generated-fixture',revision,outputFiles:[file],validation:{status:'passed',requestedFormat:output,contentChecked:true,checks:['PNG decoded; nonzero dimensions'],limitations:['No arbitrary-file or visual-fidelity guarantee']}}],revision};
}
test('merge preserves historical evidence and only adds matching final worker + downloaded HTTP proof',()=>{
 const args=data(),before=structuredClone(args),result=mergeAuditedPairs(args);
 assert.deepEqual(args,before);assert.deepEqual(result.pairs,{'svg-to-png':['SVG','PNG'],'heic-to-png':['HEIC','PNG']});assert.deepEqual(result.receipts[0],before.existingReceipts[0]);assert.equal(result.receipts[1].admission.sourceRevision,revision);assert.equal(result.report.added.length,1);assert.deepEqual(result.report.rejected,[]);
 const again=mergeAuditedPairs({...args,existingPairs:result.pairs,existingReceipts:result.receipts});assert.equal(again.report.added.length,0);assert.equal(again.receipts.length,2);
});
test('rejects missing, stale, mismatched or merely HTTP-200 evidence',()=>{
 for(const corrupt of [
  d=>d.workerResults=[],d=>d.workerResults[0].status='failed',d=>d.workerResults[0].revision='d'.repeat(64),d=>d.workerResults[0].sourceSHA256='d'.repeat(64),
  d=>d.workerResults[0].files[0].sha256='bad',d=>d.httpResults=[],d=>d.httpResults[0].http=422,d=>d.httpResults[0].revision='d'.repeat(64),
  d=>d.httpResults[0].fixtureSHA256='d'.repeat(64),d=>d.httpResults[0].bytes=0,d=>d.httpResults[0].sha256='bad',d=>d.httpResults[0].fixtureSource='',
  d=>d.httpResults[0].validation.contentChecked=false,d=>d.httpResults[0].validation.requestedFormat='jpg',d=>d.httpResults[0].validation.checks=[],d=>d.httpResults[0].validation.limitations=[],
  d=>d.httpResults[0].validation.checks=[{}],d=>d.httpResults[0].validation.checks=[{check:'decode',passed:false}],
  d=>d.httpResults[0].outputFiles=[{name:'output.zip',bytes:128,sha256}],d=>d.catalogue.groups[0]=[],d=>d.semanticReview.cases[0].sourceSHA256='bad'
 ]){const args=data();corrupt(args);const result=mergeAuditedPairs(args);assert.equal(result.report.added.length,0,String(corrupt));assert.equal(result.report.rejected.length,1,String(corrupt));assert.deepEqual(result.pairs,args.existingPairs);}
});
test('hard gates stop aliases, metadata, noops, encoder duplicates and pixel dumps despite false semantic approval',()=>{
 for(const [input,output]of [['ass','ass'],['aqt','ffmeta'],['jpeg','png'],['png24','png'],['264','png'],['bvh','stl'],['csljson','beamer'],['3g2','txt']]){
  const args=data(input,output);if(output==='txt')args.workerResults[0].engine='imagemagick';
  assert.equal(mergeAuditedPairs(args).report.added.length,0,input+':'+output);
 }
 const unreviewed=data();unreviewed.semanticReview.cases[0].decision='exclude';assert.equal(mergeAuditedPairs(unreviewed).report.excluded.length,1);
});
test('rejects ambiguous duplicate evidence and slug collisions instead of silently overwriting',()=>{
 const duplicate=data();duplicate.httpResults.push(structuredClone(duplicate.httpResults[0]));assert.throws(()=>mergeAuditedPairs(duplicate),/Duplicate HTTP/);
 const collision=data();collision.existingPairs['heic-to-png']=['TXT','PDF'];assert.throws(()=>mergeAuditedPairs(collision),/slug collision/);
 assert.throws(()=>mergeAuditedPairs({...data(),revision:'unknown'}),/SHA256/);
});

test('allows hashed OBJ material companions but requires a real primary mesh',()=>{
 const args=data('x3d','obj'),material={name:'output.mtl',bytes:23,sha256};
 args.workerResults[0].files.push(material);args.httpResults[0].outputFiles.push(material);
 assert.equal(mergeAuditedPairs(args).report.added.length,1);
 args.workerResults[0].files=[material];args.httpResults[0].outputFiles=[material];
 assert.equal(mergeAuditedPairs(args).report.added.length,0);
});

test('retains structured decoder evidence with dimensions and explicit limitations',()=>{
 const args=data();args.httpResults[0].validation.checks=[{check:'requested-format-validator',passed:true},{check:'full-pixel-decode',width:4,height:4,mean:12.4,standardDeviation:4.3}];
 const result=mergeAuditedPairs(args);assert.equal(result.report.added.length,1);assert.deepEqual(result.receipts[1].httpVerification.validation.checks,args.httpResults[0].validation.checks);
});

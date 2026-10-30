import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

// The ExecStartPre script runs against a local Docker double: no daemon is used.
async function setup(){
 const dir=await mkdtemp(join(tmpdir(),'wase-prestart-')),bin=join(dir,'bin'),jobs=join(dir,'jobs'),state=join(dir,'state');
 await mkdir(bin);await mkdir(join(jobs,'wase-job-Ab12Cd'),{recursive:true});await mkdir(join(jobs,'keep-me'));await writeFile(join(jobs,'wase-job-Ab12Cd','input.png'),'x');
 await writeFile(state,['container:wase-wase-job-Ab12Cd-1','container:postgres','container:wase-wase-job-../x-1','volume:wase-wase-job-Ab12Cd-1','volume:unrelated'].join('\n'));
 await writeFile(join(bin,'docker'),`#!/bin/sh
state="$FAKE_STATE"
case "$1" in
 ps) grep '^container:' "$state" | sed 's/^container://';;
 rm) [ -n "$FAKE_FAIL" ] && { echo "permission denied" >&2; exit 1; }; shift 2; for n in "$@"; do grep -vx "container:$n" "$state" > "$state.tmp"; mv "$state.tmp" "$state"; done;;
 volume) if [ "$2" = ls ]; then grep '^volume:' "$state" | sed 's/^volume://'; else shift 2; for n in "$@"; do grep -vx "volume:$n" "$state" > "$state.tmp"; mv "$state.tmp" "$state"; done; fi;;
esac
`,{mode:0o755});
 return {dir,bin,jobs,state};
}
const run=(ctx,extra={})=>spawnSync('sh',[resolve('backend/cleanup-stale-jobs.sh')],{env:{...process.env,PATH:ctx.bin+':'+process.env.PATH,FAKE_STATE:ctx.state,JOB_ROOT:ctx.jobs,FORCE:'1',...extra},encoding:'utf8'});

test('pre-start cleanup removes only Wase job containers, volumes and directories',async()=>{
 const ctx=await setup();
 try{
  const result=run(ctx);assert.equal(result.status,0,result.stderr);
  assert.deepEqual((await readFile(ctx.state,'utf8')).trim().split('\n').sort(),['container:postgres','container:wase-wase-job-../x-1','volume:unrelated']);
  assert.deepEqual(await readdir(ctx.jobs),['keep-me']);
  assert.match(result.stdout,/1 container\(s\), 1 volume\(s\) processed; status 0/);
 }finally{await rm(ctx.dir,{recursive:true,force:true});}
});

test('pre-start cleanup reports a failure instead of claiming a clean state',async()=>{
 const ctx=await setup();
 try{const result=run(ctx,{FAKE_FAIL:'1'});assert.equal(result.status,1);assert.match(result.stderr,/could not remove container\(s\): wase-wase-job-Ab12Cd-1/);}
 finally{await rm(ctx.dir,{recursive:true,force:true});}
});

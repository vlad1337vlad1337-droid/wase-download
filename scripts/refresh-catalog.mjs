// SPDX-License-Identifier: MIT
// Rebuild site/data/catalog.json, the build's snapshot of GET /api/formats,
// from the converter image's raw engine declarations and the current policy:
//   docker run --rm -i --network none --entrypoint sh wase-converter:20261002 \
//     -c 'cat > /tmp/engine.mjs && cd /tmp && bun /tmp/engine.mjs catalog' < backend/engine.mjs > raw-catalog.json
//   node scripts/refresh-catalog.mjs raw-catalog.json
import {readFileSync,writeFileSync} from 'node:fs';
import {publicRegistry,catalogueResponse} from '../backend/conversion-policy.mjs';
const [source,target='site/data/catalog.json']=process.argv.slice(2);
if(!source)throw new Error('Usage: node scripts/refresh-catalog.mjs raw-catalog.json [catalog.json]');
const previous=JSON.parse(readFileSync(target,'utf8')),raw=JSON.parse(readFileSync(source,'utf8'));
// Discovery order assigns categories differently per host; keep the published
// categories so only declarations and policy change the snapshot.
raw.categories={...raw.categories,...previous.categories};
const next=catalogueResponse(publicRegistry(raw),previous.limits);
const count=data=>Object.values(data.inputs).reduce((sum,index)=>sum+data.groups[index].length,0);
writeFileSync(target,JSON.stringify(next));
console.log(`${target}: ${Object.keys(previous.inputs).length} -> ${Object.keys(next.inputs).length} inputs, ${count(previous)} -> ${count(next)} pairs`);

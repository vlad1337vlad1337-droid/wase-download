// SPDX-License-Identifier: MIT
import {publicCatalogue} from '../../backend/conversion-policy.mjs';
const key='wase-formats-v3',maxAge=24*60*60*1000;
export function validCatalog(data){
 if(!data||!Array.isArray(data.groups)||!data.groups.length||data.groups.length>2000||!data.inputs||typeof data.inputs!=='object'||Array.isArray(data.inputs))return false;
 const inputs=Object.entries(data.inputs);
 return inputs.length>0&&inputs.length<=3000&&data.groups.every(group=>Array.isArray(group)&&group.length<=3000&&group.every(value=>typeof value==='string'&&value.length>0&&value.length<=128))&&inputs.every(([name,index])=>name.length>0&&name.length<=128&&Number.isInteger(index)&&index>=0&&index<data.groups.length);
}
// A new frontend can be served while the previous API is draining jobs.
// Apply the same admission policy before displaying or caching either response.
export function prepareCatalog(data){
 if(!validCatalog(data))throw new Error('Invalid catalogue');
 const result=publicCatalogue(data);
 if(!validCatalog(result))throw new Error('Empty catalogue');
 return result;
}
export function readFormatCache(storage,now=Date.now()){
 try{const raw=storage.getItem(key);if(!raw||raw.length>2000000)return null;const entry=JSON.parse(raw);return entry.version===3&&Number.isFinite(entry.savedAt)&&now>=entry.savedAt&&now-entry.savedAt<maxAge?prepareCatalog(entry.data):null;}catch{return null;}
}
export function writeFormatCache(storage,data,now=Date.now()){
 try{storage.setItem(key,JSON.stringify({version:3,savedAt:now,data:prepareCatalog(data)}));}catch{}
}

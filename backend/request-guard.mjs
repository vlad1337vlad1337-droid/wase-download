import {isIP} from 'node:net';

// Never evict a live bucket: rotating client identities cannot reset limits.
export function rateLimit({limit,windowMs=60000,maxKeys=4096,globalLimit=600,now=Date.now}){
 const clients=new Map();let globalStart=now(),globalCount=0;
 return {get size(){return clients.size;},allow(key){
  const time=now();if(time-globalStart>=windowMs){clients.clear();globalStart=time;globalCount=0;}
  if(globalCount>=globalLimit)return false;
  let count=clients.get(key);if(count===undefined&&clients.size>=maxKeys)return false;
  if((count||0)>=limit)return false;
  clients.set(key,(count||0)+1);globalCount++;return true;
 }};
}
export function clientIP(req){
 const peer=req.socket.remoteAddress;
 // The API binds to loopback. Only the local reverse proxy may supply this header.
 const forwarded=req.headers['x-real-ip'];
 return ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer)&&typeof forwarded==='string'&&isIP(forwarded)?forwarded:peer||'unknown';
}
export function matchesETag(header,etag){
 return typeof header==='string'&&header.split(',').some(value=>{const tag=value.trim();return tag==='*'||tag.replace(/^W\//,'')===etag.replace(/^W\//,'');});
}
export function reject(req,res,status,message=''){
 if(res.destroyed)return;
 res.setHeader('Connection','close');
 if(status===429)res.setHeader('Retry-After','60');
 res.writeHead(status).end(message);
 // Do not drain an unbounded upload after rejecting it; close after the response.
 res.once('finish',()=>{if(!req.complete)req.destroy();});
}
// Conversion errors are JSON {code,message}; the UI translates by code.
export function fail(req,res,status,code,message){
 if(res.destroyed||res.headersSent)return false;
 res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
 if(status===503)res.setHeader('Retry-After','60');
 reject(req,res,status,JSON.stringify({code,message}));return true;
}
export function occupancy({perClient=2,total=9}={}){
 const clients=new Map();let active=0;
 return {enter(key){const count=clients.get(key)||0;if(count>=perClient||active>=total)return null;clients.set(key,count+1);active++;let released=false;return ()=>{if(released)return;released=true;active--;const next=clients.get(key)-1;if(next)clients.set(key,next);else clients.delete(key);};},get active(){return active;}};
}
// onTimeout may answer before the sockets close; return true when it did.
export function deadline(req,res,controller,ms,onTimeout){
 const timer=setTimeout(()=>{controller.abort();if(onTimeout?.()){setTimeout(()=>{req.destroy();res.destroy();},5000).unref();return;}req.destroy();res.destroy();},ms);timer.unref();return ()=>clearTimeout(timer);
}

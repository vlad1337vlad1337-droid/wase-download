import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {discoveryHandler} from '../backend/discovery.mjs';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
test('official MCP client reads formats, pair metadata and rejects unknown tools',async()=>{
 const handler=discoveryHandler({matrix:{png:{svg:['vtracer']},txt:{pdf:['libreoffice']}},categories:{png:'image',txt:'document'}},new Set(['https://wase.download']),100);
 const server=http.createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=new URL(`http://127.0.0.1:${server.address().port}/api/mcp`);const client=new Client({name:'wase-audit',version:'1.0.0'});
 try{await client.connect(new StreamableHTTPClientTransport(url));const list=await client.listTools();assert.equal(list.tools.length,2);assert.equal(list.tools.every(t=>t.annotations.readOnlyHint),true);const formats=await client.callTool({name:'list_formats',arguments:{category:'image'}});assert.equal(formats.structuredContent.formats[0].from,'png');const info=await client.callTool({name:'conversion_info',arguments:{from:'png',to:'svg'}});assert.equal(info.structuredContent.declared,true);await assert.rejects(client.callTool({name:'execute',arguments:{}}));await assert.rejects(client.callTool({name:'list_formats',arguments:{limit:10000}}));const forbidden=await fetch(url,{method:'POST',headers:{Origin:'https://other.example','Content-Type':'application/json'},body:'{}'});assert.equal(forbidden.status,403);const oversized=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'a'.repeat(17000)});assert.equal(oversized.status,413);}finally{await client.close();await new Promise(r=>server.close(r));}
});

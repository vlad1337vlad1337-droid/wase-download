export function discoveryHandler(registry,origins,maxFileMB){
 const tools=[{name:'list_formats',description:'Browse declared input formats. This reads metadata only; it does not upload or convert files.',annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},inputSchema:{type:'object',properties:{category:{type:'string'},query:{type:'string',maxLength:32},offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:100}},additionalProperties:false}},
 {name:'conversion_info',description:'Get declared output formats and operational limits for one input, or check one pair. Engine declarations are not a guarantee for every file.',annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},inputSchema:{type:'object',properties:{from:{type:'string',maxLength:32},to:{type:'string',maxLength:32}},required:['from'],additionalProperties:false}}];
 const matrix=registry.matrix,categories=registry.categories||{},inputs=Object.keys(matrix).sort();const visits=new Map();
 const limits={fileMB:maxFileMB,batch:20,activeJobs:1,readOnlyDiscovery:true};
 const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 return async(req,res)=>{
  if(req.headers.origin&&!origins.has(req.headers.origin)){res.writeHead(403).end();return;}
  if(req.method!=='POST'){res.writeHead(405,{Allow:'POST'}).end();return;}
  if(!String(req.headers['content-type']||'').startsWith('application/json')){res.writeHead(415).end();return;}
  const key=String(req.headers['x-real-ip']||req.socket.remoteAddress),now=Date.now();for(const[k,v]of visits)if(now-v.start>60000)visits.delete(k);const visit=visits.get(key)||{start:now,count:0};visits.set(key,visit);if(++visit.count>90){res.writeHead(429,{'Retry-After':'60'}).end();return;}
  let request;try{let data='',size=0;for await(const chunk of req){size+=chunk.length;if(size>16384){res.writeHead(413).end();return;}data+=chunk;}request=JSON.parse(data);}catch{json(res,400,{jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON'}});return;}
  if(!request||Array.isArray(request)||request.jsonrpc!=='2.0'||typeof request.method!=='string'){json(res,400,{jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid request'}});return;}
  if(request.id===undefined){res.writeHead(202).end();return;}
  const reply=result=>json(res,200,{jsonrpc:'2.0',id:request.id,result});const error=(code,message)=>json(res,200,{jsonrpc:'2.0',id:request.id,error:{code,message}});
  const text=value=>({content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value});
  if(request.method==='initialize'){const version=request.params?.protocolVersion;reply({protocolVersion:['2025-06-18','2025-03-26','2024-11-05'].includes(version)?version:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'wase-download',version:'1.1.0'},instructions:'Read-only format discovery. Convert files explicitly through the documented HTTP upload API; no remote URL fetching. Listed formats are engine declarations.'});return;}
  if(request.method==='ping'){reply({});return;}
  if(request.method==='tools/list'){reply({tools});return;}
  if(request.method!=='tools/call'){error(-32601,'Method not found');return;}
  const name=request.params?.name,args=request.params?.arguments||{};
  if(!args||Array.isArray(args)||typeof args!=='object'){error(-32602,'Invalid arguments');return;}
  if(name==='list_formats'){
   if(Object.keys(args).some(k=>!['category','query','offset','limit'].includes(k))||(args.query!==undefined&&(typeof args.query!=='string'||args.query.length>32))||(args.category!==undefined&&typeof args.category!=='string')||(args.offset!==undefined&&(!Number.isInteger(args.offset)||args.offset<0))||(args.limit!==undefined&&(!Number.isInteger(args.limit)||args.limit<1||args.limit>100))){error(-32602,'Invalid arguments');return;}
   const matches=inputs.filter(f=>(!args.category||categories[f]===args.category)&&(!args.query||f.includes(args.query.toLowerCase()))),offset=args.offset||0,limit=args.limit||40;
   reply(text({total:matches.length,formats:matches.slice(offset,offset+limit).map(from=>({from,category:categories[from],outputs:Object.keys(matrix[from]).length})),nextOffset:offset+limit<matches.length?offset+limit:null,limits}));return;
  }
  if(name==='conversion_info'){
   if(Object.keys(args).some(k=>!['from','to'].includes(k))||typeof args.from!=='string'||args.from.length>32||(args.to!==undefined&&(typeof args.to!=='string'||args.to.length>32))){error(-32602,'Invalid arguments');return;}
   const from=args.from.toLowerCase(),to=args.to?.toLowerCase(),outputs=Object.keys(matrix[from]||{}).sort();reply(text({from,category:categories[from]||null,declared:to?outputs.includes(to):outputs.length>0,outputs:to?undefined:outputs,limits,url:'https://wase.download/en/formats/'}));return;
  }
  error(-32602,'Unknown tool');
 };
}

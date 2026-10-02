// Shared by static generation and tests. Keep unsafe engine names out of paths.
export function formatRoutes(catalogue){
 const routes={},used=new Set();
 for(const input of Object.keys(catalogue.inputs).sort()){
  let slug=input.toLowerCase().replace(/[^a-z0-9.-]+/g,'-').replace(/^[-.]+|[-.]+$/g,'')||'format';
  if(used.has(slug))slug+='-'+Array.from(new TextEncoder().encode(input),v=>v.toString(16).padStart(2,'0')).join('');
  used.add(slug);routes[input]=`formats/${slug}`;
 }
 return routes;
}

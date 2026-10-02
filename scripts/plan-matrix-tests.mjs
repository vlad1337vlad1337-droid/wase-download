import fs from 'node:fs';
import {engineOrder} from '../backend/engine-order.mjs';
const registry=JSON.parse(fs.readFileSync('../work/conversion-corpus/registry.json'));
const fixtures=JSON.parse(fs.readFileSync('../work/conversion-corpus/manifest.json'));
const byInput=Object.fromEntries(fixtures.map(v=>[v.input,v]));
for(const [alias,from]of Object.entries({jpeg:'jpg',tiff:'tif'}))if(!byInput[alias]&&byInput[from])byInput[alias]={...byInput[from],input:alias};
const priority=['vtracer','resvg','libheif','libjxl','vips','libreoffice','pandoc','calibre','ffmpeg','imagemagick','graphicsmagick'];
const cases=[];
const all=process.argv.includes('--all-pairs');
for(const [input,targets]of Object.entries(registry.matrix)){
 if(!byInput[input])continue;
 let preferences=['txt','pdf','png'];const cat=registry.categories[input];
 if(cat==='image'||cat==='vector')preferences=['png','jpg','svg'];
 else if(cat==='cad')preferences=['stl','obj','ply'];
 else if(cat==='audio')preferences=['wav','mp3'];
 else if(cat==='video')preferences=['webm','mp4'];
 else if(cat==='archive')preferences=['zip','tar.gz'];
 else if(cat==='font')preferences=['ttf','woff2'];
 else if(cat==='ebook')preferences=['epub','txt','pdf'];
 if(Object.values(targets).some(v=>v.includes('assimp')))preferences=['stl','obj','ply'];
 const output=preferences.find(x=>x!==input&&targets[x]);
 if(!output)continue;const choices=targets[output],preferred=priority.find(v=>choices.includes(v))||choices[0];
 cases.push({input,output,engine:preferred,engines:engineOrder(choices),fixture:'/corpus/'+byInput[input].path.split('/').pop()});
}
const core=['png','jpg','jpeg','webp','gif','bmp','svg','tif','tiff','avif','heic','jxl','html','txt','doc','docx','rtf','odt','pdf','epub','csv','json','xml','mp3','wav','flac','aac','ogg','opus','m4a','mp4','webm','mov','zip','tar','tgz','obj','stl','ply','fbx','3ds'];
for(const input of all?Object.keys(byInput):core){if(!byInput[input])continue;for(const output of all?Object.keys(registry.matrix[input]||{}):core){if(input===output||!registry.matrix[input]?.[output]||cases.some(v=>v.input===input&&v.output===output))continue;
 const inCat=registry.categories[input],outCat=registry.categories[output];
 const same=inCat===outCat||(['image','vector'].includes(inCat)&&['image','vector'].includes(outCat))||(['document','ebook'].includes(inCat)&&['document','ebook'].includes(outCat));if(!all&&!same)continue;
 const choices=registry.matrix[input][output],preferred=priority.find(v=>choices.includes(v))||choices[0];cases.push({input,output,engine:preferred,engines:engineOrder(choices),fixture:'/corpus/'+byInput[input].path.split('/').pop()});
}}
fs.writeFileSync('../work/conversion-corpus/plan.json',JSON.stringify({inputs:Object.keys(registry.matrix),fixtures:Object.keys(byInput),cases},null,2));console.log('Cases:',cases.length,'inputs with fixtures:',Object.keys(byInput).length,'without fixtures:',Object.keys(registry.matrix).length-Object.keys(byInput).length);

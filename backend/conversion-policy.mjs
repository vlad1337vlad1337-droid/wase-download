// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Wase Download contributors
// Engine declarations include capture devices and still-image-to-video synthesis.
// The public file converter offers file transformations, not those separate tools.
const devices=new Set('alsa fbdev iec61883 jack kmsgrab lavfi libcdio libdc1394 openal oss pulse video4linux2 v4l2 x11grab xv'.split(' '));
// ImageMagick's generators, remote transports and display targets are not
// uploaded-file formats. Leave actual text/data/raw formats available.
// https://imagemagick.org/formats/#pseudo
// Do not exclude X: Assimp also uses .x for real DirectX model files.
const imageActions=new Set('canvas caption clipboard fractal gradient radial_gradient hald label null open pango plasma print scan scanx screenshot tile vid win xc pattern http https ftp'.split(' '));
const imageEngines=new Set(['imagemagick','graphicsmagick']);
const media=new Set('mp4 webm mov mkv avi m4v wmv flv asf mpg mpeg m2v mts m2ts 3gp 3g2 mp3 wav flac aac ogg opus m4a ac3 aiff aif au amr ape'.split(' '));
const animated=new Set(['gif','apng']);
// Several engines claim these extensions as images as well as documents.
// Directory/import order must not change their public target lists across hosts.
// This classifies the picker; it does not certify every declared conversion.
function stableCategories(categories={}){
 const result={...categories};
 for(const [format,category] of [['pdf','document'],['txt','document'],['pdb','ebook']]){
  if(Object.hasOwn(result,format))result[format]=category;
 }
 return result;
}
export function usablePair(input,output,categories={},fileFormats=[]){
 input=input.toLowerCase();output=output.toLowerCase();
 if(devices.has(input)||devices.has(output))return false;
 if([input,output].some(format=>imageActions.has(format)&&!fileFormats.includes(format)))return false;
 const still=['image','vector'].includes(categories[input])&&!animated.has(input);
 const mediaOutput=media.has(output)||['audio','video'].includes(categories[output])||/\.(?:mp4|mkv)$/.test(output);
 return !(still&&mediaOutput);
}
export function publicRegistry(registry){
 const categories=stableCategories(registry.categories),matrix={};
 // A different engine may genuinely use a colliding extension as a file.
 const collidingFiles=new Set();
 for(const [input,targets]of Object.entries(registry.matrix||registry))for(const [output,choices]of Object.entries(targets))if((imageActions.has(input)||imageActions.has(output))&&choices.some(engine=>!imageEngines.has(engine))){if(imageActions.has(input))collidingFiles.add(input);if(imageActions.has(output))collidingFiles.add(output);}
 const fileFormats=[...collidingFiles];
 for(const [input,targets]of Object.entries(registry.matrix||registry)){
  if(devices.has(input))continue;
  const allowed=Object.fromEntries(Object.entries(targets).filter(([output])=>usablePair(input,output,categories,fileFormats)).map(([output,choices])=>[output,imageActions.has(input)||imageActions.has(output)?choices.filter(engine=>!imageEngines.has(engine)):choices]).filter(([,choices])=>choices.length));
  if(Object.keys(allowed).length)matrix[input]=allowed;
 }
 return {...registry,matrix,categories};
}
export function publicCatalogue(raw){
 const categories=stableCategories(raw.categories),groups=[],inputs={},seen=new Map();
 for(const [input,index]of Object.entries(raw.inputs)){
  if(devices.has(input))continue;
  const values=raw.groups[index].filter(output=>usablePair(input,output,categories,raw.fileFormats||[]));
  if(!values.length)continue;
  const key=JSON.stringify(values);if(!seen.has(key)){seen.set(key,groups.length);groups.push(values);}
  inputs[input]=seen.get(key);
 }
 return {...raw,inputs,groups,categories};
}

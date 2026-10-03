// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Wase Download contributors
// Engine declarations include capture devices and still-image-to-video synthesis.
// The public file converter offers file transformations, not those separate tools.
const devices=new Set('alsa fbdev iec61883 jack kmsgrab lavfi libcdio libdc1394 openal oss pulse video4linux2 v4l2 x11grab xv'.split(' '));
const media=new Set('mp4 webm mov mkv avi m4v wmv flv asf mpg mpeg m2v mts m2ts 3gp 3g2 mp3 wav flac aac ogg opus m4a ac3 aiff aif au amr ape'.split(' '));
const animated=new Set(['gif','apng']);
export function usablePair(input,output,categories={}){
 input=input.toLowerCase();output=output.toLowerCase();
 if(devices.has(input)||devices.has(output))return false;
 const still=['image','vector'].includes(categories[input])&&!animated.has(input);
 const mediaOutput=media.has(output)||['audio','video'].includes(categories[output])||/\.(?:mp4|mkv)$/.test(output);
 return !(still&&mediaOutput);
}
export function publicRegistry(registry){
 const categories=registry.categories||{},matrix={};
 for(const [input,targets]of Object.entries(registry.matrix||registry)){
  if(devices.has(input))continue;
  const allowed=Object.fromEntries(Object.entries(targets).filter(([output])=>usablePair(input,output,categories)));
  if(Object.keys(allowed).length)matrix[input]=allowed;
 }
 return {...registry,matrix,categories};
}
export function publicCatalogue(raw){
 const groups=[],inputs={},seen=new Map();
 for(const [input,index]of Object.entries(raw.inputs)){
  if(devices.has(input))continue;
  const values=raw.groups[index].filter(output=>usablePair(input,output,raw.categories));
  if(!values.length)continue;
  const key=JSON.stringify(values);if(!seen.has(key)){seen.set(key,groups.length);groups.push(values);}
  inputs[input]=seen.get(key);
 }
 return {...raw,inputs,groups};
}

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
// ConvertX groups FFmpeg's inputs/outputs as "muxer", not audio/video.
// Do not let discovery order turn known sound/container formats into documents.
// FFmpeg selects existing streams; a still image or GIF has no audio/subtitles.
// https://ffmpeg.org/ffmpeg.html#Stream-selection
const audio=new Set('mp3 wav flac aac ogg opus m4a ac3 ac4 bit aiff aif au amr ape aifc caf cvg dts eac3 ec3 g722 gsm ircam latm loas m2a m4b mka mlp mmf mp2 mpa msbc oga oma ra rso sb sbc sf sox spdif spx sw thd tta ub ul uw vag voc w64 wma wv adts adx afc al apm aptx aptxhd ast aud c2 dfpwm isma lbc pcm'.split(' '));
const video=new Set('mp4 webm mov mkv avi m4v wmv flv asf mpg mpeg m2v mts m2ts 3gp 3g2 264 265 266 a64 cpk drc amv avs2 avs3 cavs chk dnxhd dnxhr dv dvd evc f4v flm gxf h261 h263 hevc ismv ivf m1v m2t m3u8 mjpeg mjpg mpd mxf nut obu ogv psp rcv rm roq swf ts vc1 vc2 vob vvc wtv y4m'.split(' '));
const subtitles=new Set('ass js jss lrc scc srt ssa sub sup ttml vtt'.split(' '));
const animated=new Set(['gif','apng']);
// Several engines claim these extensions as images as well as documents.
// Directory/import order must not change their public target lists across hosts.
// This classifies the picker; it does not certify every declared conversion.
function stableCategories(categories={}){
 const result={...categories};
 for(const format of audio)if(Object.hasOwn(result,format))result[format]='audio';
 for(const format of video)if(Object.hasOwn(result,format))result[format]='video';
 for(const [format,category] of [['pdf','document'],['txt','document'],['pdb','ebook']]){
  if(Object.hasOwn(result,format))result[format]=category;
 }
 return result;
}
export function usablePair(input,output,categories={},fileFormats=[]){
 input=input.toLowerCase();output=output.toLowerCase();
 if(devices.has(input)||devices.has(output))return false;
 if([input,output].some(format=>imageActions.has(format)&&!fileFormats.includes(format)))return false;
 const visual=['image','vector'].includes(categories[input]);
 // Ogg is also a video container (Theora), so animated GIF -> Ogg remains valid.
 const soundOnly=output!=='ogg'&&(audio.has(output)||categories[output]==='audio');
 if(visual&&(soundOnly||subtitles.has(output)))return false;
 const still=visual&&!animated.has(input);
 const mediaOutput=audio.has(output)||video.has(output)||['audio','video'].includes(categories[output])||/\.(?:mp4|mkv)$/.test(output);
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

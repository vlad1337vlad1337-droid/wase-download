// SPDX-License-Identifier: MIT
export const themePreference=value=>value==='light'||value==='dark'?value:'auto';
export const resolvedTheme=(preference,dark)=>preference==='auto'?(dark?'dark':'light'):preference;

// A manual choice survives system changes; Auto keeps following the device.
export function createThemeController({storage,media,apply}){
 let preference='auto';
 const read=()=>{try{return themePreference(storage?.getItem('wase-theme'));}catch{return 'auto';}};
 const render=()=>apply(resolvedTheme(preference,Boolean(media?.matches)),preference);
 const onSystem=()=>{if(preference==='auto')render();};
 preference=read();render();
 if(media?.addEventListener)media.addEventListener('change',onSystem);
 else media?.addListener?.(onSystem);
 return {
  choose(value){preference=themePreference(value);try{storage?.setItem('wase-theme',preference);}catch{}render();},
  refresh(){preference=read();render();},
  get preference(){return preference;},
  destroy(){if(media?.removeEventListener)media.removeEventListener('change',onSystem);else media?.removeListener?.(onSystem);}
 };
}

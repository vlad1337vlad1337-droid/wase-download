// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import {createThemeController,themePreference} from '../site/src/theme-policy.js';
import {themeCopy} from '../site/src/theme-copy.js';
import {localeCodes} from '../site/src/locales.js';

function fixture(saved,dark=false,legacy=false){
 let value=saved,listener;const applied=[];
 const storage={getItem:()=>value,setItem:(key,next)=>{assert.equal(key,'wase-theme');value=next;}};
 const media={matches:dark,...legacy?{addListener:fn=>listener=fn,removeListener:fn=>{if(listener===fn)listener=null;}}:{addEventListener:(key,fn)=>{assert.equal(key,'change');listener=fn;},removeEventListener:(key,fn)=>{if(listener===fn)listener=null;}}};
 const controller=createThemeController({storage,media,apply:(color,preference)=>applied.push({color,preference})});
 return {controller,applied,setSystem(dark){media.matches=dark;listener?.({matches:dark});},setSaved(next){value=next;},get saved(){return value;},get listener(){return listener;}};
}

test('first visit follows system theme without writing a preference',()=>{
 for(const dark of [false,true]){const f=fixture(null,dark);assert.deepEqual(f.applied,[{color:dark?'dark':'light',preference:'auto'}]);assert.equal(f.saved,null);}
});
test('Auto changes immediately when the device changes appearance',()=>{
 const f=fixture('auto',false);f.setSystem(true);f.setSystem(false);assert.deepEqual(f.applied.map(v=>v.color),['light','dark','light']);
});
test('saved manual theme survives device changes and Auto restores tracking',()=>{
 const f=fixture('light',true);f.setSystem(false);f.setSystem(true);assert.equal(f.applied.length,1);assert.equal(f.applied[0].color,'light');
 f.controller.choose('dark');assert.equal(f.saved,'dark');f.setSystem(false);assert.equal(f.applied.at(-1).color,'dark');
 f.controller.choose('auto');assert.equal(f.saved,'auto');assert.deepEqual(f.applied.at(-1),{color:'light',preference:'auto'});f.setSystem(true);assert.equal(f.applied.at(-1).color,'dark');
});
test('invalid saved values use the system instead of an invalid CSS theme',()=>{
 assert.equal(themePreference('unexpected'),'auto');const f=fixture('unexpected',true);assert.deepEqual(f.applied[0],{color:'dark',preference:'auto'});
});
test('blocked storage still allows changing appearance in the current tab',()=>{
 const applied=[];const controller=createThemeController({storage:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}},media:{matches:true},apply:(color,preference)=>applied.push({color,preference})});controller.choose('light');assert.deepEqual(applied,[{color:'dark',preference:'auto'},{color:'light',preference:'light'}]);
});
test('a preference changed in another tab can be refreshed',()=>{
 const f=fixture('dark',true);f.setSaved('light');f.controller.refresh();assert.deepEqual(f.applied.at(-1),{color:'light',preference:'light'});f.setSaved(null);f.controller.refresh();assert.deepEqual(f.applied.at(-1),{color:'dark',preference:'auto'});
});
test('older Safari media listeners are supported and can be removed',()=>{
 const f=fixture(null,false,true);f.setSystem(true);assert.equal(f.applied.at(-1).color,'dark');f.controller.destroy();assert.equal(f.listener,null);
});
test('theme and compact coffee labels exist for every published language',()=>{
 assert.deepEqual(Object.keys(themeCopy).sort(),[...localeCodes].sort());for(const copy of Object.values(themeCopy)){for(const key of ['coffee','theme','auto','light','dark'])assert.ok(copy[key]?.trim());}
});

import {pairs as originalPairs} from './strings.js';
import verified from '../data/verified-pairs.json' with {type:'json'};
import catalogue from '../data/catalog.json' with {type:'json'};
import {usablePair,publicCatalogue} from '../../backend/conversion-policy.mjs';
const data=publicCatalogue(catalogue),{categories,fileFormats=[]}=data;
// Engine-level policy can remove a pair whose formats are otherwise usable;
// a landing page must never promise a pair the API does not accept.
const declared=(input,output)=>data.inputs[input]===undefined||data.groups[data.inputs[input]].includes(output);
export const pairs=Object.fromEntries(Object.entries({...originalPairs,...verified}).filter(([,pair])=>usablePair(...pair,categories,fileFormats)&&declared(pair[0].toLowerCase(),pair[1].toLowerCase())));

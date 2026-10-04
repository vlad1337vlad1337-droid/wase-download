import {pairs as originalPairs} from './strings.js';
import verified from '../data/verified-pairs.json' with {type:'json'};
import catalogue from '../data/catalog.json' with {type:'json'};
import {usablePair,publicCatalogue} from '../../backend/conversion-policy.mjs';
const {categories,fileFormats=[]}=publicCatalogue(catalogue);
export const pairs=Object.fromEntries(Object.entries({...originalPairs,...verified}).filter(([,pair])=>usablePair(...pair,categories,fileFormats)));

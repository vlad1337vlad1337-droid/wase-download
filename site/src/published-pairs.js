import {pairs as originalPairs} from './strings.js';
import verified from '../data/verified-pairs.json' with {type:'json'};
import catalogue from '../data/catalog.json' with {type:'json'};
import {usablePair} from '../../backend/conversion-policy.mjs';
export const pairs=Object.fromEntries(Object.entries({...originalPairs,...verified}).filter(([,pair])=>usablePair(...pair,catalogue.categories)));

import {pairs as originalPairs} from './strings.js';
import verified from '../data/verified-pairs.json' with {type:'json'};
export const pairs={...originalPairs,...verified};

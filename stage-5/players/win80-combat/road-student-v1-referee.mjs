import '../solo-40-portfolio-c/disable-native.mjs';
import {installShortRoad} from './road-student-v1-hooks.mjs';
// The frozen CLI includes seeds:{type:'string'} for warm multi-opening batches.
installShortRoad();
await import('./road-heat-fast-referee.mjs');

import '../solo-40-portfolio-c/disable-native.mjs';
import {installFourWorkerRoad} from './road-student-mux-hooks.mjs';
// The frozen CLI includes seeds:{type:'string'} for warm multi-opening batches.
installFourWorkerRoad();
await import('./road-and-boss-student-v1-referee.mjs');

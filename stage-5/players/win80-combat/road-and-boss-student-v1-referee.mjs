import '../solo-40-portfolio-c/disable-native.mjs';
import {installShortRoad} from './road-student-v1-hooks.mjs';
import {installTerminalStage3} from './formation-student-v1-hooks.mjs';
// The frozen CLI includes seeds:{type:'string'} for warm multi-opening batches.
installShortRoad();
installTerminalStage3();
await import('./road-heat-fast-referee.mjs');

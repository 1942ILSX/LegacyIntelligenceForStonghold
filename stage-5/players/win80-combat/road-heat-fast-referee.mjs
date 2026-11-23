// Forward the accelerated seeds:{type:'string'} API and exact main-thread game.
import {installRoadHeatFamilies} from './road-heat-hooks.mjs';
installRoadHeatFamilies();
await import('../win80/fast-release-referee.mjs');

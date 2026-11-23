import {installDetachedFastpath} from './detached-fastpath.mjs';
installDetachedFastpath();
await import('../win80-combat/release-worker.mjs');

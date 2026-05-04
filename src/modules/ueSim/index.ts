// modules/ueSim/index.ts
//
// Public barrel — only the view is needed by the dashboard router. Internal
// types/services/hooks remain importable via deep paths for tests but are
// not surfaced here to keep the module's surface small.

export { UeSimView } from './views/UeSimView';

// Built-in Mobility Scenarios, copied to data/scenarios on first use.
// They are cell-count agnostic: targets come from ${cells[...]} / ${cellCount},
// which the runner fills from eNB config_get.
import type { MobilityScenario } from '../types';
import hoPingPong from './ho-ping-pong.json';
import hoTour from './ho-tour.json';
import ho3ccGroups from './ho-3cc-groups.json';
import scellChurn from './scell-churn.json';
import rrcIdleCycle from './rrc-idle-cycle.json';
import rlfReestablish from './rlf-reestablish.json';
import cellBarring from './cell-barring.json';
import driveTest from './drive-test.json';
import tau from './tau.json';

export const SEED_SCENARIOS: MobilityScenario[] = [
  hoPingPong, hoTour, ho3ccGroups, scellChurn, rrcIdleCycle, rlfReestablish, cellBarring, driveTest, tau,
] as unknown as MobilityScenario[];

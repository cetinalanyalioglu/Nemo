import { elementInfo as massFlowInletInfo } from './MassFlowInlet';
import { elementInfo as losslessDuctInfo } from './LosslessDuct';
import { elementInfo as pressureOutletInfo } from './PressureOutlet';

// Sadece elementInfo'yu export edelim
export const elementInfo = {
    MassFlowInlet: massFlowInletInfo,
    LosslessDuct: losslessDuctInfo,
    PressureOutlet: pressureOutletInfo
};

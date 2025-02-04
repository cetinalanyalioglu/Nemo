import MassFlowInlet, { elementInfo as massFlowInletInfo } from './MassFlowInlet';
import LosslessDuct, { elementInfo as losslessDuctInfo } from './LosslessDuct';
import PressureOutlet, { elementInfo as pressureOutletInfo } from './PressureOutlet';

// Tüm node tipleri
export const nodeTypes = {
    MassFlowInlet,
    LosslessDuct,
    PressureOutlet
};

// Her elemanın kendi elementInfo'sunu birleştir
export const elementInfo = {
    MassFlowInlet: massFlowInletInfo,
    LosslessDuct: losslessDuctInfo,
    PressureOutlet: pressureOutletInfo
};

export default nodeTypes;

import MassFlowInlet, { elementInfo as massFlowInletInfo } from './MassFlowInlet';
import LosslessDuct, { elementInfo as losslessDuctInfo } from './LosslessDuct';

// Tüm node tipleri
export const nodeTypes = {
    MassFlowInlet,
    LosslessDuct,
};

// Her elemanın kendi elementInfo'sunu birleştir
export const elementInfo = {
    MassFlowInlet: massFlowInletInfo,
    LosslessDuct: losslessDuctInfo
};

export default nodeTypes;

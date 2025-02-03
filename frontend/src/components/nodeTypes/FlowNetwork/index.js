import MassFlowInlet, { elementInfo as massFlowInfo } from './MassFlowInlet';
import LosslessDuct, { elementInfo as losslessDuctInfo } from './LosslessDuct';

// Tüm node tipleri
export const nodeTypes = {
    MassFlowInlet,
    LosslessDuct,
};

// Element library için bilgiler
export const elements = [
    massFlowInfo,
    losslessDuctInfo,
]; 
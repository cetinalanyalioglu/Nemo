import MassFlowInlet, { elementInfo as massFlowInletInfo } from './MassFlowInlet';
import PressureOutlet, { elementInfo as pressureOutletInfo } from './PressureOutlet';
import LosslessDuct, { elementInfo as losslessDuctInfo } from './LosslessDuct';
import SuddenExpansion, { elementInfo as suddenExpansionInfo } from './SuddenExpansion';

export const nodeTypes = {
  MassFlowInlet,
  PressureOutlet,
  LosslessDuct,
  SuddenExpansion
};

export const elementInfo = {
  MassFlowInlet: massFlowInletInfo,
  PressureOutlet: pressureOutletInfo,
  LosslessDuct: losslessDuctInfo,
  SuddenExpansion: suddenExpansionInfo
};
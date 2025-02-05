import MassFlowInlet, { elementInfo as massFlowInletInfo } from './MassFlowInlet';
import PressureOutlet, { elementInfo as pressureOutletInfo } from './PressureOutlet';
import LosslessDuct, { elementInfo as losslessDuctInfo } from './LosslessDuct';
import SuddenExpansion, { elementInfo as suddenExpansionInfo } from './SuddenExpansion';
import LosslessSplitter, { elementInfo as losslessSplitterInfo } from './LosslessSplitter';

export const nodeTypes = {
  MassFlowInlet,
  PressureOutlet,
  LosslessDuct,
  SuddenExpansion,
  LosslessSplitter
};

export const elementInfo = {
  MassFlowInlet: massFlowInletInfo,
  PressureOutlet: pressureOutletInfo,
  LosslessDuct: losslessDuctInfo,
  SuddenExpansion: suddenExpansionInfo,
  LosslessSplitter: losslessSplitterInfo
};
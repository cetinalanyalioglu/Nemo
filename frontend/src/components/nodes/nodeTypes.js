import MassFlowInlet, { elementInfo as massFlowInletInfo, elementIcon as massFlowInletIcon } from './MassFlowInlet';
import PressureOutlet, { elementInfo as pressureOutletInfo, elementIcon as pressureOutletIcon } from './PressureOutlet';
import LosslessDuct, { elementInfo as losslessDuctInfo, elementIcon as losslessDuctIcon } from './LosslessDuct';
import SuddenExpansion, { elementInfo as suddenExpansionInfo, elementIcon as suddenExpansionIcon } from './SuddenExpansion';
import LosslessSplitter, { elementInfo as losslessSplitterInfo, elementIcon as losslessSplitterIcon } from './LosslessSplitter';
import Junction, { elementInfo as junctionInfo, elementIcon as junctionIcon } from './Junction';

export const nodeTypes = {
  MassFlowInlet,
  PressureOutlet,
  LosslessDuct,
  SuddenExpansion,
  LosslessSplitter,
  Junction
};

export const elementInfo = {
  MassFlowInlet: massFlowInletInfo,
  PressureOutlet: pressureOutletInfo,
  LosslessDuct: losslessDuctInfo,
  SuddenExpansion: suddenExpansionInfo,
  LosslessSplitter: losslessSplitterInfo,
  Junction: junctionInfo
};

export const elementIcons = {
  MassFlowInlet: massFlowInletIcon,
  PressureOutlet: pressureOutletIcon,
  LosslessDuct: losslessDuctIcon,
  SuddenExpansion: suddenExpansionIcon,
  LosslessSplitter: losslessSplitterIcon,
  Junction: junctionIcon
};
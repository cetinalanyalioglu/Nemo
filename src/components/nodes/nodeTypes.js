/**
 * Import all node components and their associated configurations.
 * Each node type exports:
 * - The component itself
 * - elementInfo: Configuration object defining parameters and ports
 * - elementIcon: React icon component for visual representation
 */
import MassFlowInlet, {
  elementInfo as massFlowInletInfo,
  elementIcon as massFlowInletIcon,
} from './MassFlowInlet';
import PressureOutlet, {
  elementInfo as pressureOutletInfo,
  elementIcon as pressureOutletIcon,
} from './PressureOutlet';
import LosslessDuct, {
  elementInfo as losslessDuctInfo,
  elementIcon as losslessDuctIcon,
} from './LosslessDuct';
import SuddenExpansion, {
  elementInfo as suddenExpansionInfo,
  elementIcon as suddenExpansionIcon,
} from './SuddenExpansion';
import LosslessSplitter, {
  elementInfo as losslessSplitterInfo,
  elementIcon as losslessSplitterIcon,
} from './LosslessSplitter';
import Junction, { elementInfo as junctionInfo, elementIcon as junctionIcon } from './Junction';

/**
 * Collection of all available node components.
 * Used by React Flow to render the appropriate component for each node type.
 */
export const nodeTypes = {
  MassFlowInlet,
  PressureOutlet,
  LosslessDuct,
  SuddenExpansion,
  LosslessSplitter,
  Junction,
};

/**
 * Collection of configuration objects for all node types.
 * Contains information about:
 * - Parameters and their constraints
 * - Port configurations
 * - Display names and categories
 */
export const elementInfo = {
  MassFlowInlet: massFlowInletInfo,
  PressureOutlet: pressureOutletInfo,
  LosslessDuct: losslessDuctInfo,
  SuddenExpansion: suddenExpansionInfo,
  LosslessSplitter: losslessSplitterInfo,
  Junction: junctionInfo,
};

/**
 * Collection of icon components for all node types.
 * Used for visual representation in the node palette and diagrams.
 */
export const elementIcons = {
  MassFlowInlet: massFlowInletIcon,
  PressureOutlet: pressureOutletIcon,
  LosslessDuct: losslessDuctIcon,
  SuddenExpansion: suddenExpansionIcon,
  LosslessSplitter: losslessSplitterIcon,
  Junction: junctionIcon,
};

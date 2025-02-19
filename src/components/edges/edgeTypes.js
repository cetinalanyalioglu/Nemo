import BaseCustomEdge, { edgeInfo as baseEdgeInfo } from './BaseCustomEdge';
import FlowEdge, { elementInfo as flowEdgeInfo } from './FlowEdge';

// Export edge types object for ReactFlow
export const edgeTypes = {
  custom: BaseCustomEdge,
  flow: FlowEdge,
};

// Export edge info configurations
export const edgeInfo = {
  custom: baseEdgeInfo,
  flow: flowEdgeInfo,
};

export default edgeTypes;

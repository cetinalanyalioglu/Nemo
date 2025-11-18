/**
 * Edge configuration file containing custom parameters and metadata for each edge type.
 * Generic parameters (solverIndex) are defined in the base component and merged at runtime.
 */

export const edgeConfig = {
  flow: {
    customParameters: {
      area: {
        label: 'Area',
        type: 'float',
        defaultValue: 1,
        unit: 'm^2',
        category: 'Parameters',
        description: 'Cross-sectional area of the flow path',
        editable: true,
        visible: true,
      },
    },
    displayName: 'Flow Edge',
    category: 'Flow Connections',
  },
};

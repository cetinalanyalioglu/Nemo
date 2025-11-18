import { BsArrowDownCircle } from 'react-icons/bs';
import { BsArrowUpCircle } from 'react-icons/bs';
import { BsArrowLeftRight } from 'react-icons/bs';
import { BsArrowsExpand } from 'react-icons/bs';
import { BsDiagram2 } from 'react-icons/bs';
import { BsLightningFill } from 'react-icons/bs';

/**
 * Node configuration file containing custom parameters, ports, icons, and metadata for each node type.
 * Generic parameters (label, width, height, solverIndex) are defined
 * in the base component and merged at runtime.
 */

export const nodeConfig = {
  MassFlowInlet: {
    customParameters: {
      label: {
        defaultValue: 'MassFlowInlet',
      },
      massFlowRate: {
        label: 'Mass Flow Rate',
        type: 'float',
        defaultValue: 1.0,
        unit: 'kg/s',
        category: 'Parameters',
        min: 0,
        step: 0.1,
      },
      totalTemperature: {
        label: 'Total Temperature',
        type: 'float',
        defaultValue: 298.15,
        unit: 'K',
        category: 'Parameters',
        min: 0,
      },
    },
    ports: {
      target: [],
      source: ['0'],
    },
    icon: BsArrowDownCircle,
    displayName: 'Mass Flow Inlet',
    category: 'Single port elements',
    dynamicPorts: false,
  },
  PressureOutlet: {
    customParameters: {
      label: {
        defaultValue: 'PressureOutlet',
      },
      pressure: {
        label: 'Pressure',
        type: 'float',
        defaultValue: 101325,
        unit: 'Pa',
        category: 'Parameters',
        min: 0,
        max: Infinity,
        editable: true,
      },
      allowReverseFlow: {
        label: 'Allow reverse flow',
        type: 'boolean',
        category: 'Parameters',
        defaultValue: false,
        editable: true,
      },
      totalTemperature: {
        label: 'Total Temperature',
        type: 'float',
        defaultValue: 298.15,
        unit: 'K',
        category: 'Parameters',
        min: 0,
        editable: true,
        visibleIf: {
          parameter: 'allowReverseFlow',
          equals: true,
        },
      },
    },
    ports: {
      target: ['0'],
      source: [],
    },
    icon: BsArrowUpCircle,
    displayName: 'Pressure Outlet',
    category: 'Single port elements',
    dynamicPorts: false,
  },
  LosslessDuct: {
    customParameters: {
      label: {
        defaultValue: 'LosslessDuct',
      },
      area: {
        label: 'Area',
        type: 'float',
        defaultValue: 1,
        unit: 'm^2',
        category: 'Parameters',
        min: 0.000001,
      },
      length: {
        label: 'Length',
        type: 'float',
        defaultValue: 1.0,
        unit: 'm',
        category: 'Parameters',
        min: 0.000001,
      },
    },
    ports: {
      target: ['0'],
      source: ['1'],
    },
    icon: BsArrowLeftRight,
    displayName: 'Lossless Duct',
    category: 'Two port elements',
    dynamicPorts: false,
  },
  SuddenExpansion: {
    customParameters: {
      label: {
        defaultValue: 'SuddenExpansion',
      },
      minimumAreaRatio: {
        label: 'Minimum area ratio',
        type: 'float',
        defaultValue: 1,
        category: 'Parameters',
        min: 1,
        description: 'Minimum area ratio across this node',
        editable: false,
        visible: false,
      },
      maximumAreaRatio: {
        label: 'Maximum area ratio',
        type: 'float',
        defaultValue: Infinity,
        category: 'Parameters',
        min: 1,
        description: 'Maximum area ratio across this node',
        editable: false,
        visible: false,
      },
    },
    ports: {
      target: ['0'],
      source: ['1'],
    },
    icon: BsArrowsExpand,
    displayName: 'Sudden Expansion',
    category: 'Two port elements',
    dynamicPorts: false,
  },
  LosslessSplitter: {
    customParameters: {
      label: {
        defaultValue: 'LosslessSplitter',
      },
      rightPorts: {
        label: 'Output Ports',
        type: 'number',
        defaultValue: 2,
        min: 2,
        step: 1,
        category: 'Ports',
        description: 'Number of output ports',
      },
    },
    ports: {
      target: ['0'],
      source: [], // Dynamic - calculated from rightPorts parameter
    },
    icon: BsDiagram2,
    displayName: 'Lossless Splitter',
    category: 'Dynamic Port Elements',
    dynamicPorts: true,
  },
  Junction: {
    customParameters: {
      label: {
        defaultValue: 'Junction',
      },
      leftPorts: {
        label: 'Left Ports',
        type: 'number',
        defaultValue: 2,
        min: 1,
        step: 1,
        category: 'Ports',
        description: 'Number of left ports',
      },
      rightPorts: {
        label: 'Right Ports',
        type: 'number',
        defaultValue: 1,
        min: 1,
        step: 1,
        category: 'Ports',
        description: 'Number of right ports',
      },
    },
    ports: {
      target: [], // Dynamic - calculated from leftPorts parameter
      source: [], // Dynamic - calculated from rightPorts parameter
    },
    icon: BsLightningFill,
    displayName: 'Junction',
    category: 'Dynamic Port Elements',
    dynamicPorts: true,
  },
};

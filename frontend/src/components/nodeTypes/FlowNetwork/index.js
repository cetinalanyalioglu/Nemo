import MassFlowInlet from './MassFlowInlet';
import LosslessDuct from './LosslessDuct';

// Tüm node tipleri
export const nodeTypes = {
    MassFlowInlet,
    LosslessDuct,
};

// Element bilgileri
export const elementInfo = {
    MassFlowInlet: {
        type: 'MassFlowInlet',
        label: 'Mass Flow Inlet',
        ports: {
            source: ['port-0']
        },
        parameters: {
            massFlowRate: {
                label: 'Mass Flow Rate',
                type: 'float',
                defaultValue: 1.0,
                unit: 'kg/s',
                category: 'Flow',
                min: 0,
                max: 100
            },
            temperature: {
                label: 'Temperature',
                type: 'float',
                defaultValue: 298.15,
                unit: 'K',
                category: 'Flow Properties',
                min: 0,
                max: 1000
            },
            pressure: {
                label: 'Total Pressure',
                type: 'float',
                defaultValue: 101325,
                unit: 'Pa',
                category: 'Flow Properties',
                min: 0,
                max: 1000000
            }
        }
    },
    LosslessDuct: {
        type: 'LosslessDuct',
        label: 'Lossless Duct',
        ports: {
            target: ['port-0'],
            source: ['port-1']
        },
        parameters: {
            diameter: {
                label: 'Diameter',
                type: 'float',
                defaultValue: 0.1,
                unit: 'm',
                category: 'Geometry',
                min: 0.001,
                max: 10
            },
            length: {
                label: 'Length',
                type: 'float',
                defaultValue: 1.0,
                unit: 'm',
                category: 'Geometry',
                min: 0.001,
                max: 100
            }
        }
    }
};

export default nodeTypes;

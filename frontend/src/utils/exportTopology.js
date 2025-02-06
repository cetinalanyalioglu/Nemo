import { elementInfo as elementsInfoMapping } from "../components/nodes/nodeTypes";

const exportTopology = ({ nodes, edges, nodeStates }) => {
  // Elemanları export edelim
  const elements = nodes.map((node) => {
    let targetCount = 0;
    let sourceCount = 0;
    const config = elementsInfoMapping[node.type];

    // Özel durum: Eğer Junction gibi dinamik portlu bir eleman ise,
    // NodeContext içindeki parametrelerden port sayılarını alalım.
    if (node.type === "Junction" && nodeStates[node.id]) {
      const leftPorts = parseInt(nodeStates[node.id].parameters.leftPorts, 10) || 0;
      const rightPorts = parseInt(nodeStates[node.id].parameters.rightPorts, 10) || 0;
      targetCount = leftPorts;
      sourceCount = rightPorts;
    } else if (config && config.ports) {
      // Statik elemanlar için elementInfo'daki ports dizilerini kullanıyoruz.
      targetCount = config.ports.target ? config.ports.target.length : 0;
      sourceCount = config.ports.source ? config.ports.source.length : 0;
    }

    return {
      id: node.id,
      name: node.data.label,
      ports: {
        target: targetCount,
        source: sourceCount
      }
    };
  });

  // Kenarları export edelim; port bilgilerini elde etmek için handle id'sinden ayrıştırıyoruz.
  const parsePortIndex = (handle) => {
    if (!handle) return null;
    const parts = handle.split("-port-");
    return parts.length > 1 ? parseInt(parts[1], 10) : null;
  };

  const exportedEdges = edges.map((edge) => ({
    source: edge.source,
    sourcePort: parsePortIndex(edge.sourceHandle),
    target: edge.target,
    targetPort: parsePortIndex(edge.targetHandle)
  }));

  const exportData = {
    elements,
    edges: exportedEdges
  };

  return JSON.stringify(exportData, null, 2);
};

export default exportTopology; 
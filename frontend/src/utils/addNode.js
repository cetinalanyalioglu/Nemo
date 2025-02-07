import { elementInfo } from '../components/nodes/nodeTypes';

/**
 * The addNode function centralizes the process of adding a new node.
 *
 * @param {Object} options - Node creation options.
 * @param {string} [options.id] - The node's id; if not provided, it will be generated using getNextNodeId.
 * @param {string} options.type - The type of the node (required).
 * @param {Object} [options.position] - The position of the node; default is { x: 0, y: 0 }.
 * @param {Object} [options.data] - Additional data fields; e.g., label.
 * @param {Object} [options.parameters] - Node parameters; missing properties will be filled in with defaults from elementInfo.
 *
 * @param {Object} callbacks - An object containing the callback functions.
 * @param {Function} callbacks.getNextNodeId - A function that generates a new id for the node.
 * @param {Function} callbacks.setNodes - A function to update the nodes state.
 * @param {Function} callbacks.onNodeAdd - A function to notify that a node has been registered.
 * @param {Function} callbacks.onNodeSelect - A function to update the selected node id.
 * @param {Function} [callbacks.updateCounter] - A function to update counters for node types.
 *
 * @returns {Object} - The newly added node object.
 */
export function addNode(
  { id: providedId, type, position = { x: 0, y: 0 }, data = {}, parameters = {} },
  { getNextNodeId, setNodes, onNodeAdd, onNodeSelect, updateCounter }
) {
  if (!type) {
    throw new Error('Node type is required!');
  }

  // If no id is provided, generate one using getNextNodeId.
  let id = providedId;
  if (!id) {
    if (typeof getNextNodeId !== 'function') {
      throw new Error('No id provided; getNextNodeId function is required to generate an id!');
    }
    id = getNextNodeId(type);
  }

  // Retrieve the template information for the specified node type from elementInfo.
  const nodeTemplate = elementInfo[type];
  if (!nodeTemplate) {
    throw new Error(`Element info not found for type: "${type}"`);
  }

  // Obtain default parameters defined in elementInfo.
  const defaultParameters = {};
  for (const key in nodeTemplate.parameters) {
    defaultParameters[key] = nodeTemplate.parameters[key].defaultValue;
  }

  // Merge the provided parameters with the default parameters.
  const mergedParameters = { ...defaultParameters, ...parameters };

  // If no label is provided in data, set it to the mergedParameters label or the id.
  if (data.label === undefined) {
    data.label = mergedParameters.label || id;
  }

  // Construct the new node object.
  const newNode = {
    id,
    type,
    position,
    data: { ...data }
  };

  // 1. Update the nodes state.
  setNodes(prevNodes => [...prevNodes, newNode]);

  // 2. Notify that a new node has been registered.
  onNodeAdd({ type: 'add', item: newNode });

  // 3. Update the selected node id.
  onNodeSelect(newNode.id);

  // 4. Update the counter for the specific node type if provided.
  if (typeof updateCounter === 'function') {
    updateCounter(type);
  }

  return newNode;
}

export default addNode; 
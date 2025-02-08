/**
 * The deleteNode function centralizes the process of deleting a node.
 *
 * @param {Object} options - Node deletion options
 * @param {string|string[]} options.nodeIds - Single node id or array of node ids to delete
 * @param {Object[]} options.nodes - Current nodes array
 * @param {Object[]} options.edges - Current edges array
 * 
 * @param {Object} callbacks - Callback functions
 * @param {Function} callbacks.setNodes - Function to update nodes state
 * @param {Function} callbacks.setEdges - Function to update edges state
 * @param {Function} callbacks.onNodeDelete - Function to notify that nodes have been deleted
 * @param {Function} callbacks.onNodeSelect - Function to update selected node (usually to null after deletion)
 * 
 * @returns {Object} - Object containing deleted nodes and affected edges
 */
export function deleteNode({nodeIds, nodes, edges}, {setNodes, setEdges, onNodeDelete, onNodeSelect}) {
    // Always handle nodeIds as an array
    const nodeIdsToDelete = Array.isArray(nodeIds) ? nodeIds : [nodeIds];
    
    // Find nodes to be deleted
    const nodesToDelete = nodes.filter(node => nodeIdsToDelete.includes(node.id));
    
    // Find edges connected to these nodes
    const affectedEdges = edges.filter(edge => 
        nodeIdsToDelete.includes(edge.source) || nodeIdsToDelete.includes(edge.target)
    );
    
    // Delete nodes
    setNodes(prevNodes => 
        prevNodes.filter(node => !nodeIdsToDelete.includes(node.id))
    );
    
    // Delete connected edges
    setEdges(prevEdges => 
        prevEdges.filter(edge => 
            !nodeIdsToDelete.includes(edge.source) && !nodeIdsToDelete.includes(edge.target)
        )
    );
    
    // Clear node selection
    if (typeof onNodeSelect === 'function') {
        onNodeSelect(null);
    }
    
    // Notify about deletion
    if (typeof onNodeDelete === 'function') {
        nodesToDelete.forEach(node => {
            onNodeDelete({
                type: 'delete',
                item: node
            });
        });
    }
    
    return {
        deletedNodes: nodesToDelete,
        affectedEdges: affectedEdges
    };
} 
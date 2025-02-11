import React, { useState } from 'react';
import { 
    IoChevronBackCircleOutline,
    IoLibrary,
    IoChevronDown,
    IoSaveOutline
} from 'react-icons/io5';
import '../styles/sidebar.css';
import { elementInfo } from './nodes/nodeTypes';
import { useNodeContext } from '../context/NodeContext';
import exportTopology from '../utils/exportTopology';

const formatCategoryName = (category) => {
    return category.toUpperCase().replace(/I/g, 'I');
};

const Sidebar = () => {
    // Internal state management
    const [isOpen, setIsOpen] = useState(true);
    const [collapsedGroups, setCollapsedGroups] = useState({});

    // Get nodes and edges from context for export
    const { nodes, edges } = useNodeContext();

    const onDragStart = (event, nodeType) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    const toggleGroup = (category) => {
        setCollapsedGroups(prev => ({
            ...prev,
            [category]: !prev[category]
        }));
    };

    const toggleSidebar = () => {
        setIsOpen(!isOpen);
    };

    const handleExport = () => {
        const dataStr = exportTopology({ nodes, edges });
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "topology.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const groupedElements = Object.entries(elementInfo).reduce((acc, [type, info]) => {
        const category = info.category;
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push({ type, info });
        return acc;
    }, {});

    return (
        <>
            {/* Panel kapalıyken görünecek ikonlar */}
            {!isOpen && (
                <div className="sidebar-closed-icons">
                    <button className="library-button" onClick={toggleSidebar}>
                        <IoLibrary />
                    </button>
                    <button className="library-button save-button" onClick={handleExport} title="Export Topology">
                        <IoSaveOutline />
                    </button>
                </div>
            )}
            
            {/* Ana sidebar */}
            <div className={`sidebar ${isOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="panel-icon-wrapper">
                        <IoLibrary className="panel-icon" />
                        <span className="panel-title">ELEMENT LIBRARY</span>
                    </div>
                    <IoChevronBackCircleOutline
                        className={`toggle-icon ${!isOpen ? 'closed' : ''}`}
                        onClick={toggleSidebar}
                    />
                </div>
                
                <div className="action-icons">
                    <button 
                        className="action-button" 
                        onClick={handleExport}
                        title="Export Topology"
                    >
                        <IoSaveOutline className="action-icon" />
                    </button>
                </div>

                {Object.entries(groupedElements).map(([category, elements]) => (
                    <div key={category} className={`elements-group ${collapsedGroups[category] ? 'collapsed' : ''}`}>
                        <div 
                            className="group-header"
                            onClick={() => toggleGroup(category)}
                        >
                            <div className="group-header-content">
                                <span>{formatCategoryName(category)}</span>
                                <IoChevronDown className="group-collapse-icon" style={{ transform: collapsedGroups[category] ? 'rotate(-90deg)' : 'rotate(0deg)' }} />
                            </div>
                        </div>
                        <div className={`group-content ${collapsedGroups[category] ? 'collapsed' : ''}`}>
                            {elements.map(({ type, info }) => (
                                <div
                                    key={type}
                                    className="element-item"
                                    draggable
                                    onDragStart={(e) => onDragStart(e, type)}
                                >
                                    {info.icon && <info.icon className="element-icon" />}
                                    <span className="element-label">{info.displayName || type}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
};

export default Sidebar; 
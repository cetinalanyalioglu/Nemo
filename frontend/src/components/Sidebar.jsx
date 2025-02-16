import React from 'react';
import { 
    IoChevronBackCircleOutline,
    IoLibrary,
    IoChevronDown,
    IoSaveOutline
} from 'react-icons/io5';
import '../styles/sidebar.css';
import { elementInfo } from './nodes/nodeTypes';
import { useAppState } from '../context/AppStateContext';

/**
 * Formats a category name to uppercase, preserving 'I' characters
 * @param {string} category The category name to format
 * @returns {string} Formatted category name
 */
const formatCategoryName = (category) => {
    return category.toUpperCase().replace(/I/g, 'I');
};

/**
 * ElementsPanel component provides a collapsible sidebar with draggable flow elements.
 * Elements are grouped by categories and can be dragged onto the canvas.
 * 
 * @returns {React.Component} Elements panel component
 */
const Sidebar = () => {
    // Get states and actions from AppState context
    const { 
        sidebar: { isOpen, collapsedGroups },
        actions 
    } = useAppState();

    /**
     * Handles the start of element drag operations
     * Sets the drag data with the element type
     */
    const onDragStart = (event, nodeType) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    // Group elements by their categories
    const groupedElements = Object.entries(elementInfo).reduce((acc, [type, info]) => {
        const category = info.category;
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push({ type, info });
        return acc;
    }, {});

    return (
        <div className={`sidebar ${isOpen ? 'open' : ''}`}>
            {/* Panel header */}
            <div className="sidebar-header">
                <div className="panel-icon-wrapper">
                    <IoLibrary className="panel-icon" />
                    <span className="panel-title">ELEMENT LIBRARY</span>
                </div>
                <IoChevronBackCircleOutline
                    className={`toggle-icon ${!isOpen ? 'closed' : ''}`}
                    onClick={() => actions.sidebar.toggle()}
                />
            </div>
            
            {/* Action buttons */}
            <div className="action-icons">
                <button 
                    className="action-button" 
                    title="Export Topology"
                >
                    <IoSaveOutline className="action-icon" />
                </button>
            </div>

            {/* Element groups */}
            {Object.entries(groupedElements).map(([category, elements]) => (
                <div key={category} className={`elements-group ${collapsedGroups[category] ? 'collapsed' : ''}`}>
                    {/* Group header with collapse toggle */}
                    <div 
                        className="group-header"
                        onClick={() => actions.sidebar.toggleGroup(category)}
                    >
                        <div className="group-header-content">
                            <span>{formatCategoryName(category)}</span>
                            <IoChevronDown 
                                className="group-collapse-icon" 
                                style={{ transform: collapsedGroups[category] ? 'rotate(-90deg)' : 'rotate(0deg)' }} 
                            />
                        </div>
                    </div>
                    {/* Group content with draggable elements */}
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
    );
};

export default Sidebar; 
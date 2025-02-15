import React, { useState } from 'react';
import { 
    IoChevronBackCircleOutline,
    IoLibrary,
    IoChevronDown,
    IoSaveOutline
} from 'react-icons/io5';
import '../styles/sidebar.css';
import { elementInfo } from './nodes/nodeTypes';

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
 * @param {Object} props Component properties
 * @param {boolean} props.isOpen Whether the panel is currently open
 * @param {Function} props.setIsOpen Function to control panel visibility
 * @param {Function} props.onExport Function to handle topology export
 * @returns {React.Component} Elements panel component
 */
const Sidebar = ({ isOpen, setIsOpen, onExport }) => {
    // Track collapsed state of element groups
    const [collapsedGroups, setCollapsedGroups] = useState({});

    /**
     * Handles the start of element drag operations
     * Sets the drag data with the element type
     */
    const onDragStart = (event, nodeType) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    /**
     * Toggles the collapsed state of an element group
     */
    const toggleGroup = (category) => {
        setCollapsedGroups(prev => ({
            ...prev,
            [category]: !prev[category]
        }));
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
                    onClick={() => setIsOpen(false)}
                />
            </div>
            
            {/* Action buttons */}
            <div className="action-icons">
                <button 
                    className="action-button" 
                    onClick={onExport}
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
                        onClick={() => toggleGroup(category)}
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
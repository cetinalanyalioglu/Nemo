import React, { useState } from 'react';
import { 
    IoChevronBackCircleOutline,
    IoLibrary,
    IoChevronDown
} from 'react-icons/io5';
import '../styles/sidebar.css';
import { elementInfo } from './nodeTypes/FlowNetwork/index';

const formatCategoryName = (category) => {
    return category.toUpperCase().replace(/I/g, 'I');
};

const Sidebar = ({ isOpen, onToggle }) => {
    const [collapsedGroups, setCollapsedGroups] = useState({});

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
            {/* Panel kapalıyken görünecek kütüphane ikonu */}
            {!isOpen && (
                <button className="library-button" onClick={onToggle}>
                    <IoLibrary />
                </button>
            )}
            
            {/* Ana sidebar */}
            <div className={`sidebar ${isOpen ? 'open' : ''}`}>
                <div className="panel-header">
                    <IoLibrary className="panel-icon" />
                    <span className="panel-title">ELEMENT LIBRARY</span>
                    <button className="toggle-button" onClick={onToggle}>
                        <IoChevronBackCircleOutline />
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
                                <IoChevronDown className="group-collapse-icon" />
                            </div>
                        </div>
                        <div className="group-content">
                            {elements.map(({ type, info }) => (
                                <div
                                    key={type}
                                    className="element-item"
                                    draggable
                                    onDragStart={(e) => onDragStart(e, type)}
                                >
                                    {info.icon && <info.icon className="element-icon" />}
                                    <span className="element-label">{type}</span>
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
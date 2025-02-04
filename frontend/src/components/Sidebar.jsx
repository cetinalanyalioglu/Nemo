import React, { useState, useMemo } from 'react';
import '../styles/sidebar.css';
import { elementInfo } from './nodeTypes/FlowNetwork';

const Sidebar = () => {
    // Kategorilerin açık/kapalı durumunu tutacak state
    const [expandedCategories, setExpandedCategories] = useState({});

    // ElementInfo'dan kategorilere göre gruplandırılmış elemanları oluştur
    const categorizedElements = useMemo(() => {
        const categories = {};
        
        Object.entries(elementInfo).forEach(([elementType, info]) => {
            const category = info.category || 'Uncategorized';
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push({
                type: elementType,
                ...info
            });
        });

        return categories;
    }, []);

    const onDragStart = (event, nodeType) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    const toggleCategory = (category) => {
        setExpandedCategories(prev => ({
            ...prev,
            [category]: !prev[category]
        }));
    };

    return (
        <div className="sidebar">
            <div className="sidebar-header">
                Element Library
            </div>
            <div className="library-name">
                Flow Network
            </div>
            {Object.entries(categorizedElements).map(([category, elements]) => (
                <div key={category} className="element-category">
                    <div 
                        className={`category-header ${expandedCategories[category] ? 'expanded' : ''}`}
                        onClick={() => toggleCategory(category)}
                    >
                        <span className="category-icon">
                            {expandedCategories[category] ? '▼' : '▶'}
                        </span>
                        {category}
                    </div>
                    <div className={`element-list ${expandedCategories[category] ? 'expanded' : ''}`}>
                        {expandedCategories[category] && elements.map(element => (
                            <div
                                key={element.type}
                                className="element-item"
                                onDragStart={(event) => onDragStart(event, element.type)}
                                draggable
                            >
                                <span className="element-label">{element.type}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default Sidebar; 
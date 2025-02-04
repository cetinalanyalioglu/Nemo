import React, { useState, useMemo } from 'react';
import { 
    IoChevronBackCircleOutline, 
    IoChevronForwardCircleOutline,
    IoChevronDownCircleOutline,
    IoChevronForwardCircleOutline as IoChevronRightCircleOutline  // Sağa bakan chevron için
} from 'react-icons/io5';
import '../styles/sidebar.css';
import { elementInfo } from './nodeTypes/FlowNetwork';

const Sidebar = ({ isOpen, onToggle }) => {
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
        <div className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
            <div className="sidebar-header">
                <span>Element Library</span>
                <button className="toggle-button" onClick={onToggle}>
                    {isOpen ? <IoChevronBackCircleOutline size={24} /> : <IoChevronForwardCircleOutline size={24} />}
                </button>
            </div>
            {isOpen && (
                <>
                    <div className="library-name">
                        Flow Network
                    </div>
                    {Object.entries(categorizedElements).map(([category, elements]) => (
                        <div key={category} className="element-category">
                            <div 
                                className={`category-header ${expandedCategories[category] ? 'expanded' : ''}`}
                                onClick={() => toggleCategory(category)}
                            >
                                {expandedCategories[category] ? 
                                    <IoChevronDownCircleOutline size={20} className="category-icon" /> : 
                                    <IoChevronRightCircleOutline size={20} className="category-icon" />
                                }
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
                </>
            )}
        </div>
    );
};

export default Sidebar; 
import React, { useMemo } from 'react';
import {
  IoChevronBackCircleOutline,
  IoLibrary,
  IoChevronDown,
  IoSaveOutline,
} from 'react-icons/io5';
import '../styles/sidebar.css';
import { useAppState } from '../context/AppStateContext';
import { useModel } from '../context/ModelContext';
import { useGraphStore } from '../store/graphStore';
import type { ElementInfoEntry } from '../types/flow';

const formatCategoryName = (category: string) => {
  return category.toUpperCase().replace(/I/g, 'I');
};

const NodeLibrary = React.memo(() => {
  const {
    sidebar: { isOpen, collapsedGroups },
    actions,
  } = useAppState();
  const { model } = useModel();
  // A locked canvas rejects new nodes (adding one renumbers the indices loaded
  // data maps to), so disable the drag affordance to make that visible.
  const locked = useGraphStore((s) => s.locked);

  const onDragStart = (event: React.DragEvent<HTMLDivElement>, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const elementInfo = useMemo(() => model?.elementInfo ?? {}, [model]);

  const groupedElements = useMemo(() => {
    return Object.entries(elementInfo).reduce(
      (acc, [type, info]) => {
        const category = info.category!;
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push({ type, info });
        return acc;
      },
      {} as Record<string, Array<{ type: string; info: ElementInfoEntry }>>
    );
  }, [elementInfo]);

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div className="panel-icon-wrapper">
          <IoLibrary className="panel-icon" />
          <span className="panel-title">NODE LIBRARY</span>
        </div>
        <IoChevronBackCircleOutline
          className={`toggle-icon ${!isOpen ? 'closed' : ''}`}
          onClick={() => actions.sidebar.toggle()}
        />
      </div>

      <div className="action-icons">
        <button type="button" className="action-button" title="Export Topology">
          <IoSaveOutline className="action-icon" />
        </button>
      </div>

      {Object.entries(groupedElements).map(([category, elements]) => (
        <div
          key={category}
          className={`elements-group ${collapsedGroups[category] ? 'collapsed' : ''}`}
        >
          <div className="group-header" onClick={() => actions.sidebar.toggleGroup(category)}>
            <div className="group-header-content">
              <span>{formatCategoryName(category)}</span>
              <IoChevronDown className="group-collapse-icon" />
            </div>
          </div>
          <div className={`group-content ${collapsedGroups[category] ? 'collapsed' : ''}`}>
            {elements.map(({ type, info }) => {
              const Icon = info.icon;
              return (
                <div
                  key={type}
                  className={`element-item ${locked ? 'locked' : ''}`}
                  draggable={!locked}
                  onDragStart={locked ? undefined : (e) => onDragStart(e, type)}
                  title={locked ? 'Canvas is locked — unlock it to add nodes' : undefined}
                >
                  {Icon && <Icon className="element-icon" />}
                  <span className="element-label">{info.displayName || type}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
});

NodeLibrary.displayName = 'NODE LIBRARY';

export default NodeLibrary;

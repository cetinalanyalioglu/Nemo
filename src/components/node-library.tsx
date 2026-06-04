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
  const { models, activeModelId, model, isLoading, error, setActiveModelId } = useModel();
  const nodeCount = useGraphStore((s) => s.nodes.length);

  const onDragStart = (event: React.DragEvent<HTMLDivElement>, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleModelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = event.target.value;
    if (newId === activeModelId) return;
    // Switching models clears the canvas; confirm first when work would be lost.
    if (nodeCount > 0) {
      const confirmed = window.confirm(
        'Switching the model will clear the current canvas. Continue?'
      );
      if (!confirmed) return;
    }
    setActiveModelId(newId);
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

      <div className="model-selector">
        <label className="model-selector-label" htmlFor="model-select">
          MODEL
        </label>
        <div className="model-select-wrapper">
          <select
            id="model-select"
            className="model-select"
            value={activeModelId ?? ''}
            onChange={handleModelChange}
            disabled={models.length === 0}
          >
            {models.length === 0 && <option value="">No models available</option>}
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <IoChevronDown className="model-select-icon" />
        </div>
        {model?.description && <p className="model-selector-description">{model.description}</p>}
      </div>

      {error && <div className="model-status model-status-error">{error}</div>}
      {isLoading && !error && <div className="model-status">Loading model…</div>}

      {Object.entries(groupedElements).map(([category, elements]) => (
        <div
          key={category}
          className={`elements-group ${collapsedGroups[category] ? 'collapsed' : ''}`}
        >
          <div className="group-header" onClick={() => actions.sidebar.toggleGroup(category)}>
            <div className="group-header-content">
              <span>{formatCategoryName(category)}</span>
              <IoChevronDown
                className="group-collapse-icon"
                style={{
                  transform: collapsedGroups[category] ? 'rotate(-90deg)' : 'rotate(0deg)',
                }}
              />
            </div>
          </div>
          <div className={`group-content ${collapsedGroups[category] ? 'collapsed' : ''}`}>
            {elements.map(({ type, info }) => {
              const Icon = info.icon;
              return (
                <div
                  key={type}
                  className="element-item"
                  draggable
                  onDragStart={(e) => onDragStart(e, type)}
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

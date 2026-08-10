import React, { useMemo } from 'react';
import { IoChevronBackCircleOutline, IoChevronDown, IoCubeOutline } from 'react-icons/io5';
import '../styles/sidebar.css';
import SidebarShell from './sidebar-shell';
import '../styles/properties-panel.css';
import { useAppState } from '../context/AppStateContext';
import { useModel } from '../context/ModelContext';
import { useGraphStore } from '../store/graphStore';
import { hasWorkInProgress } from '../store/start-fresh';
import { ParameterFormFields } from './parameter-form-fields';
import type { ParameterInfo } from '../types/flow';

const ModelPane = React.memo(() => {
  const {
    sidebar: { isOpen, collapsedGroups },
    actions,
  } = useAppState();
  const { models, activeModelId, model, isLoading, error, setActiveModelId } = useModel();
  const modelParameters = useGraphStore((s) => s.modelParameters);
  const updateModelParameter = useGraphStore((s) => s.updateModelParameter);

  const parametersInfo = useMemo(
    () => (model?.modelParameters ?? {}) as Record<string, ParameterInfo>,
    [model]
  );

  const handleModelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = event.target.value;
    if (newId === activeModelId) return;
    // Everything a session holds is about the model it was made under, so a switch
    // discards all of it. Asked only when there is something to lose — and asked
    // about all three, since the notebook is the one behind the other tab.
    if (hasWorkInProgress()) {
      const confirmed = window.confirm(
        'Switching the model starts a new session: the canvas, any loaded results and ' +
          'the notebook will be cleared. Continue?'
      );
      if (!confirmed) return;
    }
    setActiveModelId(newId);
  };

  return (
    <SidebarShell className="model-pane">
      <div className="sidebar-header">
        <div className="panel-icon-wrapper">
          <IoCubeOutline className="panel-icon" />
          <span className="panel-title">MODEL</span>
        </div>
        <IoChevronBackCircleOutline
          className={`toggle-icon ${!isOpen ? 'closed' : ''}`}
          onClick={() => actions.sidebar.toggle()}
        />
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

      <div className="model-pane-content">
        <ParameterFormFields
          contextId="model"
          parameters={modelParameters}
          parametersInfo={parametersInfo}
          collapsedGroups={collapsedGroups}
          onToggleGroup={actions.sidebar.toggleGroup}
          onUpdateParameter={updateModelParameter}
          categoryPrecedence={model?.categoryPrecedence}
        />
      </div>
    </SidebarShell>
  );
});

ModelPane.displayName = 'ModelPane';

export default ModelPane;

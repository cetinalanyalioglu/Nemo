import { useEffect } from 'react';
import { useModel } from '../context/ModelContext';
import { useGraphStore } from './graphStore';
import { startFresh } from './start-fresh';

/**
 * Bridges ModelContext into the graph store. Keeps the active model, model list
 * and model switcher in sync, starts the session again when the model changes,
 * and applies a deferred file load once its target model has finished loading.
 *
 * Renders nothing; it only wires effects.
 */
const GraphStoreBridge = () => {
  const { model, models, setActiveModelId } = useModel();
  const modelId = model?.id ?? null;

  // Sync the active runtime model into the store. Declared before the
  // model-change reset so resetForModel sees the new model's elementInfo.
  useEffect(() => {
    useGraphStore.getState().syncModel(model);
  }, [model]);

  useEffect(() => {
    useGraphStore.getState().setModels(models);
  }, [models]);

  useEffect(() => {
    useGraphStore.getState().setModelSwitcher(setActiveModelId);
  }, [setActiveModelId]);

  // Start the session again whenever the active model changes: the canvas, the
  // results, the notebook and the interpreter all belong to the model they were
  // made under. The message log is kept, being the record of how we got here.
  useEffect(() => {
    if (!modelId) return;
    startFresh();
  }, [modelId]);

  // Apply a deferred load once its target model is active. Declared after the
  // reset effect so the restored data wins within the same commit.
  useEffect(() => {
    useGraphStore.getState().applyPendingLoad();
  }, [modelId]);

  return null;
};

export default GraphStoreBridge;

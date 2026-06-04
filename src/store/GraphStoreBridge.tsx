import { useEffect } from 'react';
import { useModel } from '../context/ModelContext';
import { useGraphStore } from './graphStore';

/**
 * Bridges ModelContext into the graph store. Keeps the active model, model list
 * and model switcher in sync, resets the canvas when the model changes, and
 * applies a deferred file load once its target model has finished loading.
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

  // Reset the canvas whenever the active model changes.
  useEffect(() => {
    if (!modelId) return;
    useGraphStore.getState().resetForModel();
  }, [modelId]);

  // Apply a deferred load once its target model is active. Declared after the
  // reset effect so the restored data wins within the same commit.
  useEffect(() => {
    useGraphStore.getState().applyPendingLoad();
  }, [modelId]);

  return null;
};

export default GraphStoreBridge;

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import yaml from 'js-yaml';
import { buildRuntimeModel, validateModelDefinition } from '../models/model-builder';
import type { RuntimeModel } from '../models/model-builder';
import { withStableTypeMaps } from '../models/stable-type-maps';
import type { ModelSummary } from '../types/flow';
import { logger } from '../utils/logger';

const MODELS_BASE = `${process.env.PUBLIC_URL ?? ''}/models`;

interface ModelContextValue {
  /** Available models listed in the manifest. */
  models: ModelSummary[];
  /** Id of the currently active model (null while the first model loads). */
  activeModelId: string | null;
  /** The fully built runtime model, or null while loading/on error. */
  model: RuntimeModel | null;
  isLoading: boolean;
  error: string | null;
  /** Requests a switch to another model. Loading is handled internally. */
  setActiveModelId: (id: string) => void;
}

const ModelContext = createContext<ModelContextValue | undefined>(undefined);

const fetchModelDefinition = async (file: string): Promise<RuntimeModel> => {
  const response = await fetch(`${MODELS_BASE}/${file}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch model file "${file}" (${response.status}).`);
  }
  const text = await response.text();
  const parsed = yaml.load(text);
  const definition = validateModelDefinition(parsed);
  return buildRuntimeModel(definition);
};

export const ModelProvider = ({ children }: { children: React.ReactNode }) => {
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [activeModelId, setActiveModelIdState] = useState<string | null>(null);
  const [model, setModel] = useState<RuntimeModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load the manifest once on mount and select the first model by default.
  useEffect(() => {
    let cancelled = false;

    const loadManifest = async () => {
      try {
        const response = await fetch(`${MODELS_BASE}/manifest.json`);
        if (!response.ok) {
          throw new Error(`Failed to fetch model manifest (${response.status}).`);
        }
        const data = (await response.json()) as { models?: ModelSummary[] };
        const list = data.models ?? [];
        if (cancelled) return;

        setModels(list);
        if (list.length > 0) {
          logger.info(`Found ${list.length} model${list.length === 1 ? '' : 's'} in manifest.`);
          setActiveModelIdState(list[0].id);
        } else {
          logger.warn('No models found in manifest.');
          setError('No models found in manifest.');
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to load model manifest: ${message}`);
        setError(message);
        setIsLoading(false);
      }
    };

    loadManifest();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load the active model definition whenever the active id changes.
  useEffect(() => {
    if (!activeModelId) return;
    const summary = models.find((m) => m.id === activeModelId);
    if (!summary) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchModelDefinition(summary.file)
      .then((runtimeModel) => {
        if (cancelled) return;
        setModel(withStableTypeMaps(runtimeModel));
        setIsLoading(false);
        logger.info(`Loaded model "${runtimeModel.name ?? runtimeModel.id}".`);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to load model: ${message}`);
        setError(message);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeModelId, models]);

  const setActiveModelId = useCallback((id: string) => {
    setActiveModelIdState((prev) => (prev === id ? prev : id));
  }, []);

  const value = useMemo<ModelContextValue>(
    () => ({ models, activeModelId, model, isLoading, error, setActiveModelId }),
    [models, activeModelId, model, isLoading, error, setActiveModelId]
  );

  return <ModelContext.Provider value={value}>{children}</ModelContext.Provider>;
};

export const useModel = (): ModelContextValue => {
  const context = useContext(ModelContext);
  if (!context) {
    throw new Error('useModel must be used within a ModelProvider');
  }
  return context;
};

export default ModelContext;

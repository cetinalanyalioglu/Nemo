import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

type CollapsedGroups = Record<string, boolean>;

type AppStateSnapshot = {
  viewport: { zoom: number };
  sidebar: { isOpen: boolean; collapsedGroups: CollapsedGroups };
  propertiesPanel: { isOpen: boolean; collapsedGroups: CollapsedGroups };
  grid: { snapToGrid: boolean; size: number };
};

type AppActions = {
  viewport: { updateZoom: (newZoom: number) => void };
  sidebar: {
    toggle: () => void;
    toggleGroup: (category: string) => void;
  };
  propertiesPanel: {
    toggle: () => void;
    toggleGroup: (category: string) => void;
    setIsOpen: (isOpen: boolean) => void;
  };
  grid: {
    toggleSnap: () => void;
    updateSize: (size: number) => void;
  };
};

export type AppStateContextValue = AppStateSnapshot & { actions: AppActions };

const AppStateContext = createContext<AppStateContextValue | null>(null);

export const AppStateProvider = ({ children }: { children: React.ReactNode }) => {
  const [viewportState, setViewport] = useState({ zoom: 1 });
  const [sidebarState, setSidebar] = useState<{
    isOpen: boolean;
    collapsedGroups: CollapsedGroups;
  }>({
    isOpen: true,
    collapsedGroups: {},
  });
  const [propertiesPanelState, setPropertiesPanel] = useState<{
    isOpen: boolean;
    collapsedGroups: CollapsedGroups;
  }>({
    isOpen: false,
    collapsedGroups: {},
  });
  const [gridState, setGrid] = useState({ snapToGrid: true, size: 15 });

  const updateZoom = useCallback((newZoom: number) => {
    setViewport((prev) => ({ ...prev, zoom: newZoom }));
  }, []);

  const sidebarToggle = useCallback(() => {
    setSidebar((prev) => ({ ...prev, isOpen: !prev.isOpen }));
  }, []);

  const sidebarToggleGroup = useCallback((category: string) => {
    setSidebar((prev) => ({
      ...prev,
      collapsedGroups: {
        ...prev.collapsedGroups,
        [category]: !prev.collapsedGroups[category],
      },
    }));
  }, []);

  const propertiesPanelToggle = useCallback(() => {
    setPropertiesPanel((prev) => ({ ...prev, isOpen: !prev.isOpen }));
  }, []);

  const propertiesPanelToggleGroup = useCallback((category: string) => {
    setPropertiesPanel((prev) => ({
      ...prev,
      collapsedGroups: {
        ...prev.collapsedGroups,
        [category]: !prev.collapsedGroups[category],
      },
    }));
  }, []);

  const propertiesPanelSetIsOpen = useCallback((isOpen: boolean) => {
    setPropertiesPanel((prev) => ({ ...prev, isOpen }));
  }, []);

  const gridToggleSnap = useCallback(() => {
    setGrid((prev) => ({ ...prev, snapToGrid: !prev.snapToGrid }));
  }, []);

  const gridUpdateSize = useCallback((size: number) => {
    setGrid((prev) => ({ ...prev, size }));
  }, []);

  const appActions = useMemo(
    () => ({
      viewport: {
        updateZoom,
      },
      sidebar: {
        toggle: sidebarToggle,
        toggleGroup: sidebarToggleGroup,
      },
      propertiesPanel: {
        toggle: propertiesPanelToggle,
        toggleGroup: propertiesPanelToggleGroup,
        setIsOpen: propertiesPanelSetIsOpen,
      },
      grid: {
        toggleSnap: gridToggleSnap,
        updateSize: gridUpdateSize,
      },
    }),
    [
      updateZoom,
      sidebarToggle,
      sidebarToggleGroup,
      propertiesPanelToggle,
      propertiesPanelToggleGroup,
      propertiesPanelSetIsOpen,
      gridToggleSnap,
      gridUpdateSize,
    ]
  );

  const providerValue = useMemo(
    (): AppStateContextValue => ({
      viewport: viewportState,
      sidebar: sidebarState,
      propertiesPanel: propertiesPanelState,
      grid: gridState,
      actions: appActions,
    }),
    [viewportState, sidebarState, propertiesPanelState, gridState, appActions]
  );

  return <AppStateContext.Provider value={providerValue}>{children}</AppStateContext.Provider>;
};

export const useAppState = (): AppStateContextValue => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};

export default AppStateContext;

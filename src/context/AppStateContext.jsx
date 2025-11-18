import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

const AppStateContext = createContext(null);

export const AppStateProvider = ({ children }) => {
  // Define all app states in a single object
  const [viewportState, setViewport] = useState({
    zoom: 1,
  });
  const [sidebarState, setSidebar] = useState({
    isOpen: true,
    collapsedGroups: {},
  });
  const [propertiesPanelState, setPropertiesPanel] = useState({
    isOpen: false,
    collapsedGroups: {},
  });
  const [gridState, setGrid] = useState({
    snapToGrid: true,
    size: 15,
  });

  // Define actions with useCallback for stable references (required for React 19)
  const updateZoom = useCallback((newZoom) => {
    setViewport((prev) => ({ ...prev, zoom: newZoom }));
  }, []);

  const sidebarToggle = useCallback(() => {
    setSidebar((prev) => ({ ...prev, isOpen: !prev.isOpen }));
  }, []);

  const sidebarToggleGroup = useCallback((category) => {
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

  const propertiesPanelToggleGroup = useCallback((category) => {
    setPropertiesPanel((prev) => ({
      ...prev,
      collapsedGroups: {
        ...prev.collapsedGroups,
        [category]: !prev.collapsedGroups[category],
      },
    }));
  }, []);

  const propertiesPanelSetIsOpen = useCallback((isOpen) => {
    setPropertiesPanel((prev) => ({ ...prev, isOpen }));
  }, []);

  const gridToggleSnap = useCallback(() => {
    setGrid((prev) => ({ ...prev, snapToGrid: !prev.snapToGrid }));
  }, []);

  const gridUpdateSize = useCallback((size) => {
    setGrid((prev) => ({ ...prev, size }));
  }, []);

  // Memoize actions object
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

  // Create provider value with states and actions
  const providerValue = useMemo(
    () => ({
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

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};

export default AppStateContext;

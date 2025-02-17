import React, { createContext, useContext, useState } from 'react';

const AppStateContext = createContext(null);

export const AppStateProvider = ({ children }) => {
  // Define all app states in a single object
  const appStates = {
    viewport: {
      id: 'viewport',
      persist: true,
      state: useState({
        zoom: 1,
      }),
    },
    sidebar: {
      id: 'sidebar',
      persist: false,
      state: useState({
        isOpen: true,
        collapsedGroups: {},
      }),
    },
    propertiesPanel: {
      id: 'propertiesPanel',
      persist: false,
      state: useState({
        isOpen: false,
        collapsedGroups: {},
      }),
    },
    grid: {
      id: 'grid',
      persist: true,
      state: useState({
        snapToGrid: true,
        size: 15,
      }),
    },
  };

  // Define actions for each state
  const appActions = {
    viewport: {
      updateZoom: (newZoom) => {
        const [_, setViewport] = appStates.viewport.state;
        setViewport((prev) => ({ ...prev, zoom: newZoom }));
      },
    },
    sidebar: {
      toggle: () => {
        const [state, setState] = appStates.sidebar.state;
        setState((prev) => ({ ...prev, isOpen: !prev.isOpen }));
      },
      toggleGroup: (category) => {
        const [state, setState] = appStates.sidebar.state;
        setState((prev) => ({
          ...prev,
          collapsedGroups: {
            ...prev.collapsedGroups,
            [category]: !prev.collapsedGroups[category],
          },
        }));
      },
    },
    propertiesPanel: {
      toggle: () => {
        const [state, setState] = appStates.propertiesPanel.state;
        setState((prev) => ({ ...prev, isOpen: !prev.isOpen }));
      },
      toggleGroup: (category) => {
        const [state, setState] = appStates.propertiesPanel.state;
        setState((prev) => ({
          ...prev,
          collapsedGroups: {
            ...prev.collapsedGroups,
            [category]: !prev.collapsedGroups[category],
          },
        }));
      },
      setIsOpen: (isOpen) => {
        const [_, setState] = appStates.propertiesPanel.state;
        setState((prev) => ({ ...prev, isOpen }));
      },
    },
    grid: {
      toggleSnap: () => {
        const [state, setState] = appStates.grid.state;
        setState((prev) => ({ ...prev, snapToGrid: !prev.snapToGrid }));
      },
      updateSize: (size) => {
        const [_, setState] = appStates.grid.state;
        setState((prev) => ({ ...prev, size }));
      },
    },
  };

  // Create provider value with states and actions
  const providerValue = {
    // States
    ...Object.entries(appStates).reduce(
      (acc, [key, slice]) => ({
        ...acc,
        [key]: slice.state[0],
      }),
      {}
    ),

    // Actions
    actions: appActions,
  };

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

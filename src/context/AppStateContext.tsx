import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import { readStoredTheme, THEME_STORAGE_KEY } from '../types/theme';
import type { ThemeId } from '../types/theme';
import { CONSOLE_DEFAULT_HEIGHT } from '../types/console';

export type SidebarPane = 'library' | 'document' | 'model' | 'tools' | 'settings';
export type EdgePathStyle = 'bezier' | 'straight' | 'smoothstep' | 'simplebezier';

type CollapsedGroups = Record<string, boolean>;

export type GridState = { snapToGrid: boolean; size: number };

export type AppearanceState = {
  theme: ThemeId;
  showEdgeBadges: boolean;
  showIndices: boolean;
};

export type LayoutState = {
  edgePathStyle: EdgePathStyle;
  nodeSep: number;
  rankSep: number;
  showMinimap: boolean;
};

type AppStateSnapshot = {
  viewport: { zoom: number };
  sidebar: { isOpen: boolean; collapsedGroups: CollapsedGroups; activePane: SidebarPane };
  propertiesPanel: { isOpen: boolean; collapsedGroups: CollapsedGroups };
  consolePane: { isOpen: boolean; height: number };
  grid: GridState;
  appearance: AppearanceState;
  layout: LayoutState;
};

type AppActions = {
  viewport: { updateZoom: (newZoom: number) => void };
  sidebar: {
    toggle: () => void;
    toggleGroup: (category: string) => void;
    selectPane: (pane: SidebarPane) => void;
  };
  propertiesPanel: {
    toggle: () => void;
    toggleGroup: (category: string) => void;
    setIsOpen: (isOpen: boolean) => void;
  };
  consolePane: {
    toggle: () => void;
    setIsOpen: (isOpen: boolean) => void;
    setHeight: (height: number) => void;
  };
  grid: {
    toggleSnap: () => void;
    updateSize: (size: number) => void;
  };
  appearance: {
    setTheme: (theme: ThemeId) => void;
    toggleEdgeBadges: () => void;
    toggleShowIndices: () => void;
  };
  layout: {
    setEdgePathStyle: (style: EdgePathStyle) => void;
    setNodeSep: (value: number) => void;
    setRankSep: (value: number) => void;
    toggleMinimap: () => void;
  };
};

export type AppStateContextValue = AppStateSnapshot & { actions: AppActions };

const AppStateContext = createContext<AppStateContextValue | null>(null);
const AppearanceContext = createContext<AppearanceState | null>(null);
const LayoutContext = createContext<LayoutState | null>(null);
const GridContext = createContext<GridState | null>(null);

export const AppStateProvider = ({ children }: { children: React.ReactNode }) => {
  const [viewportState, setViewport] = useState({ zoom: 1 });
  const [sidebarState, setSidebar] = useState<{
    isOpen: boolean;
    collapsedGroups: CollapsedGroups;
    activePane: SidebarPane;
  }>({
    isOpen: true,
    collapsedGroups: {},
    activePane: 'library',
  });
  const [propertiesPanelState, setPropertiesPanel] = useState<{
    isOpen: boolean;
    collapsedGroups: CollapsedGroups;
  }>({
    isOpen: false,
    collapsedGroups: {},
  });
  const [consolePaneState, setConsolePane] = useState<{
    isOpen: boolean;
    height: number;
  }>({
    isOpen: false,
    height: CONSOLE_DEFAULT_HEIGHT,
  });
  const [gridState, setGrid] = useState({ snapToGrid: true, size: 15 });
  const [appearanceState, setAppearance] = useState<AppearanceState>(() => ({
    theme: readStoredTheme(),
    showEdgeBadges: true,
    showIndices: false,
  }));
  const [layoutState, setLayout] = useState<{
    edgePathStyle: EdgePathStyle;
    nodeSep: number;
    rankSep: number;
    showMinimap: boolean;
  }>({
    edgePathStyle: 'bezier',
    nodeSep: 80,
    rankSep: 100,
    showMinimap: true,
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', appearanceState.theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, appearanceState.theme);
    } catch {
      /* localStorage unavailable */
    }
  }, [appearanceState.theme]);

  const updateZoom = useCallback((newZoom: number) => {
    setViewport((prev) => ({ ...prev, zoom: newZoom }));
  }, []);

  const sidebarToggle = useCallback(() => {
    setSidebar((prev) => ({ ...prev, isOpen: !prev.isOpen }));
  }, []);

  const sidebarSelectPane = useCallback((pane: SidebarPane) => {
    setSidebar((prev) => {
      if (prev.isOpen && prev.activePane === pane) {
        return { ...prev, isOpen: false };
      }
      return { ...prev, isOpen: true, activePane: pane };
    });
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

  const consolePaneToggle = useCallback(() => {
    setConsolePane((prev) => ({ ...prev, isOpen: !prev.isOpen }));
  }, []);

  const consolePaneSetIsOpen = useCallback((isOpen: boolean) => {
    setConsolePane((prev) => ({ ...prev, isOpen }));
  }, []);

  const consolePaneSetHeight = useCallback((height: number) => {
    setConsolePane((prev) => ({ ...prev, height }));
  }, []);

  const gridToggleSnap = useCallback(() => {
    setGrid((prev) => ({ ...prev, snapToGrid: !prev.snapToGrid }));
  }, []);

  const gridUpdateSize = useCallback((size: number) => {
    setGrid((prev) => ({ ...prev, size }));
  }, []);

  const appearanceSetTheme = useCallback((theme: ThemeId) => {
    setAppearance((prev) => ({ ...prev, theme }));
  }, []);

  const appearanceToggleEdgeBadges = useCallback(() => {
    setAppearance((prev) => ({ ...prev, showEdgeBadges: !prev.showEdgeBadges }));
  }, []);

  const appearanceToggleShowIndices = useCallback(() => {
    setAppearance((prev) => ({ ...prev, showIndices: !prev.showIndices }));
  }, []);

  const layoutSetEdgePathStyle = useCallback((style: EdgePathStyle) => {
    setLayout((prev) => ({ ...prev, edgePathStyle: style }));
  }, []);

  const layoutSetNodeSep = useCallback((value: number) => {
    setLayout((prev) => ({ ...prev, nodeSep: value }));
  }, []);

  const layoutSetRankSep = useCallback((value: number) => {
    setLayout((prev) => ({ ...prev, rankSep: value }));
  }, []);

  const layoutToggleMinimap = useCallback(() => {
    setLayout((prev) => ({ ...prev, showMinimap: !prev.showMinimap }));
  }, []);

  const appActions = useMemo(
    () => ({
      viewport: {
        updateZoom,
      },
      sidebar: {
        toggle: sidebarToggle,
        toggleGroup: sidebarToggleGroup,
        selectPane: sidebarSelectPane,
      },
      propertiesPanel: {
        toggle: propertiesPanelToggle,
        toggleGroup: propertiesPanelToggleGroup,
        setIsOpen: propertiesPanelSetIsOpen,
      },
      consolePane: {
        toggle: consolePaneToggle,
        setIsOpen: consolePaneSetIsOpen,
        setHeight: consolePaneSetHeight,
      },
      grid: {
        toggleSnap: gridToggleSnap,
        updateSize: gridUpdateSize,
      },
      appearance: {
        setTheme: appearanceSetTheme,
        toggleEdgeBadges: appearanceToggleEdgeBadges,
        toggleShowIndices: appearanceToggleShowIndices,
      },
      layout: {
        setEdgePathStyle: layoutSetEdgePathStyle,
        setNodeSep: layoutSetNodeSep,
        setRankSep: layoutSetRankSep,
        toggleMinimap: layoutToggleMinimap,
      },
    }),
    [
      updateZoom,
      sidebarToggle,
      sidebarToggleGroup,
      sidebarSelectPane,
      propertiesPanelToggle,
      propertiesPanelToggleGroup,
      propertiesPanelSetIsOpen,
      consolePaneToggle,
      consolePaneSetIsOpen,
      consolePaneSetHeight,
      gridToggleSnap,
      gridUpdateSize,
      appearanceSetTheme,
      appearanceToggleEdgeBadges,
      appearanceToggleShowIndices,
      layoutSetEdgePathStyle,
      layoutSetNodeSep,
      layoutSetRankSep,
      layoutToggleMinimap,
    ]
  );

  const providerValue = useMemo(
    (): AppStateContextValue => ({
      viewport: viewportState,
      sidebar: sidebarState,
      propertiesPanel: propertiesPanelState,
      consolePane: consolePaneState,
      grid: gridState,
      appearance: appearanceState,
      layout: layoutState,
      actions: appActions,
    }),
    [
      viewportState,
      sidebarState,
      propertiesPanelState,
      consolePaneState,
      gridState,
      appearanceState,
      layoutState,
      appActions,
    ]
  );

  return (
    <AppStateContext.Provider value={providerValue}>
      <AppearanceContext.Provider value={appearanceState}>
        <LayoutContext.Provider value={layoutState}>
          <GridContext.Provider value={gridState}>{children}</GridContext.Provider>
        </LayoutContext.Provider>
      </AppearanceContext.Provider>
    </AppStateContext.Provider>
  );
};

export const useAppState = (): AppStateContextValue => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};

export const useAppearanceState = (): AppearanceState => {
  const context = useContext(AppearanceContext);
  if (!context) {
    throw new Error('useAppearanceState must be used within an AppStateProvider');
  }
  return context;
};

export const useLayoutState = (): LayoutState => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayoutState must be used within an AppStateProvider');
  }
  return context;
};

export const useGridState = (): GridState => {
  const context = useContext(GridContext);
  if (!context) {
    throw new Error('useGridState must be used within an AppStateProvider');
  }
  return context;
};

export default AppStateContext;

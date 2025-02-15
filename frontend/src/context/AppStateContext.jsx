import React, { createContext, useContext, useState } from 'react';

/**
 * Context for managing application-wide UI states.
 * Provides centralized state management for UI components.
 */
const AppStateContext = createContext(null);

/**
 * Provider component for application UI state management.
 * Manages states like sidebar visibility, properties panel, grid settings, etc.
 * 
 * @param {Object} props Component properties
 * @param {React.ReactNode} props.children Child components to be wrapped
 * @returns {React.Component} Context provider component
 */
export const AppStateProvider = ({ children }) => {
    // Sidebar state
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [sidebarCollapsedGroups, setSidebarCollapsedGroups] = useState({});

    // Properties panel state
    const [isPropertiesPanelOpen, setIsPropertiesPanelOpen] = useState(false);
    const [propertiesCollapsedGroups, setPropertiesCollapsedGroups] = useState({});

    // Grid and zoom states
    const [snapToGrid, setSnapToGrid] = useState(true);
    const [gridSize, setGridSize] = useState(15);
    const [zoom, setZoom] = useState(1);

    // Sidebar actions
    const toggleSidebar = () => setIsSidebarOpen(prev => !prev);
    const toggleSidebarGroup = (category) => {
        setSidebarCollapsedGroups(prev => ({
            ...prev,
            [category]: !prev[category]
        }));
    };

    // Properties panel actions
    const togglePropertiesPanel = () => setIsPropertiesPanelOpen(prev => !prev);
    const togglePropertiesGroup = (category) => {
        setPropertiesCollapsedGroups(prev => ({
            ...prev,
            [category]: !prev[category]
        }));
    };

    // Grid actions
    const toggleSnapToGrid = () => setSnapToGrid(prev => !prev);
    const updateGridSize = (size) => setGridSize(size);

    // Zoom actions
    const updateZoom = (newZoom) => setZoom(newZoom);

    return (
        <AppStateContext.Provider value={{
            // Sidebar states and actions
            isSidebarOpen,
            setIsSidebarOpen,
            toggleSidebar,
            sidebarCollapsedGroups,
            toggleSidebarGroup,

            // Properties panel states and actions
            isPropertiesPanelOpen,
            setIsPropertiesPanelOpen,
            togglePropertiesPanel,
            propertiesCollapsedGroups,
            togglePropertiesGroup,

            // Grid states and actions
            snapToGrid,
            setSnapToGrid,
            toggleSnapToGrid,
            gridSize,
            updateGridSize,

            // Zoom states and actions
            zoom,
            updateZoom
        }}>
            {children}
        </AppStateContext.Provider>
    );
};

/**
 * Custom hook to access the application UI state and actions.
 * Must be used within an AppStateProvider component.
 * 
 * @returns {Object} Object containing all UI states and their setter functions
 * @throws {Error} If used outside of an AppStateProvider
 */
export const useAppState = () => {
    const context = useContext(AppStateContext);
    if (context === undefined) {
        throw new Error('useAppState must be used within an AppStateProvider');
    }
    return context;
};

export default AppStateContext; 
import React, { useState } from 'react';
import Canvas from './components/Canvas';
import Sidebar from './components/Sidebar';
import './App.css';

function App() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    return (
        <div className="app">
            <Sidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
            <Canvas />
        </div>
    );
}

export default App; 
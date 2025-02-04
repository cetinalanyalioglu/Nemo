import React from 'react';
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import PropertiesPanel from './components/PropertiesPanel';
import './App.css';

function App() {
  return (
    <div className="app">
      <Sidebar />
      <Canvas />
      <PropertiesPanel />
    </div>
  );
}

export default App; 
import React from 'react';
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import './App.css';

function App() {
  return (
    <div className="app">
      <Sidebar />
      <div className="canvas-container">
        <Canvas />
      </div>
    </div>
  );
}

export default App; 
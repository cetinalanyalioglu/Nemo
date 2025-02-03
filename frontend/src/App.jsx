import React from 'react';
import ElementLibrary from './components/ElementLibrary';
import Canvas from './components/Canvas';
import './App.css';

function App() {
  return (
    <div className="app">
      <ElementLibrary />
      <div className="canvas-container">
        <Canvas />
      </div>
    </div>
  );
}

export default App; 
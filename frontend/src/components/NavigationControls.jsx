import React, { useRef } from 'react';
import { useNodeContext } from '../context/NodeContext';
import { FaBars, FaDownload, FaSave, FaUpload } from 'react-icons/fa';
import '../styles/navigation-controls.css';

const NavigationControls = ({ isSidebarOpen, toggleSidebar, handleExport }) => {
    const { saveToFile, loadFromFile } = useNodeContext();
    const fileInputRef = useRef(null);

    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (file) {
            loadFromFile(file);
            // Reset file input so the same file can be selected again
            event.target.value = '';
        }
    };

    return (
        <div className="navigation-controls">
            {!isSidebarOpen && (
                <button onClick={toggleSidebar} className="nav-button">
                    <FaBars />
                </button>
            )}
            <button onClick={handleExport} className="nav-button">
                <FaDownload />
            </button>
            <button onClick={saveToFile} className="nav-button">
                <FaSave />
            </button>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".json"
                style={{ display: 'none' }}
            />
            <button 
                onClick={() => fileInputRef.current.click()} 
                className="nav-button"
            >
                <FaUpload />
            </button>
        </div>
    );
};

export default NavigationControls; 
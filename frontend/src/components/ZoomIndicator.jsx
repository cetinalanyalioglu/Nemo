import React, { useState, useEffect } from 'react';
import '../styles/zoom-indicator.css';

const ZoomIndicator = ({ zoom }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Zoom değiştiğinde indikatörü göster
        setIsVisible(true);

        // 1.5 saniye sonra indikatörü gizle
        const timer = setTimeout(() => {
            setIsVisible(false);
        }, 1500);

        return () => clearTimeout(timer);
    }, [zoom]);

    const percentage = Math.round(zoom * 100);

    return (
        <div className={`zoom-indicator ${isVisible ? 'visible' : ''}`}>
            {percentage}%
        </div>
    );
};

export default ZoomIndicator; 
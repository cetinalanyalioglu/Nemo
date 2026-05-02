import React, { useState, useEffect } from 'react';
import '../styles/zoom-indicator.css';

type ZoomIndicatorProps = { zoom: number };

const ZoomIndicator = ({ zoom }: ZoomIndicatorProps) => {
  const [isVisible, setIsVisible] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setIsVisible(true);

    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, [zoom]);

  const percentage = Math.round(zoom * 100);

  return <div className={`zoom-indicator ${isVisible ? 'visible' : ''}`}>{percentage}%</div>;
};

export default ZoomIndicator;

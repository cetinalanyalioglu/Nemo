import React, { useState, useEffect } from 'react';
import '../styles/zoom-indicator.css';

/**
 * ZoomIndicator component displays the current zoom level as a percentage.
 * Shows temporarily when zoom level changes and fades out after a delay.
 *
 * @param {Object} props Component properties
 * @param {number} props.zoom Current zoom level (1.0 = 100%)
 * @returns {React.Component} Zoom indicator overlay
 */
const ZoomIndicator = ({ zoom }) => {
  // Track visibility state of the indicator
  const [isVisible, setIsVisible] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Show indicator when zoom changes
    // Note: This effect intentionally sets state to show the indicator when zoom changes
    setIsVisible(true);

    // Hide indicator after 1.5 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 1500);

    // Clean up timer on unmount or when zoom changes
    return () => clearTimeout(timer);
  }, [zoom]);

  // Convert zoom level to percentage
  const percentage = Math.round(zoom * 100);

  return <div className={`zoom-indicator ${isVisible ? 'visible' : ''}`}>{percentage}%</div>;
};

export default ZoomIndicator;

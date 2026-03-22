import React, { useEffect, useState } from 'react';
import './styles/LaunchingPage.css';

const LaunchingPage = () => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Start fade out animation after 3 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`launching-container ${!isVisible ? 'fade-out' : ''}`}>
      <div className="launching-content">
        <div className="logo-container">
          <div className="brand-text">
            <h1 className="brand-name">MONIVUE</h1>
            <p className="brand-tagline">TRACK. SAVE. GROW.</p>
            <p className="brand-subtitle">Your Financial Journey Starts Here</p>
          </div>
        </div>
        
        <div className="loading-indicator">
          <div className="loading-dots">
            <div className="dot"></div>
            <div className="dot"></div>
            <div className="dot"></div>
          </div>
          <p className="loading-text">Loading...</p>
        </div>
      </div>
    </div>
  );
};

export default LaunchingPage;
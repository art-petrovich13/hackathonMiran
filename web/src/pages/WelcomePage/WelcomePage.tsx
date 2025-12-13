import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './WelcomePage.scss';

const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimated(true);
    }, 300);
    
    return () => clearTimeout(timer);
  }, []);

  const handleNavigate = () => {
    navigate('/map');
  };

  return (
    <div className="welcome-page">
      {/* Фоновые элементы */}
      <div className="background-animation">
        <div className="floating-shape shape-1"></div>
        <div className="floating-shape shape-2"></div>
        <div className="pulse-dot"></div>
      </div>

      <div className="welcome-container">
        {/* Основной контент с сундуком */}
        <div className={`content-section ${animated ? 'animate' : ''}`}>
          <h2 className="tagline">
            <span className="tagline-part welcome-text">Добро пожаловать на квест!</span>
            
            {/* Анимированный сундук с сокровищами */}
            <div className="treasure-chest-container">
              <div className="treasure-chest">
                {/* Световое свечение */}
                <div className="chest-light"></div>
                
                {/* Искры */}
                <div className="sparkle"></div>
                <div className="sparkle"></div>
                <div className="sparkle"></div>
                
                {/* Крышка сундука */}
                <div className="chest-lid">
                  <div className="lid-details"></div>
                </div>
                
                {/* Корпус сундука */}
                <div className="chest-body">
                  {/* Замок */}
                  <div className="chest-lock">
                    <div className="lock-hole"></div>
                  </div>
                  
                  {/* Металлические полосы */}
                  <div className="chest-bands"></div>
                  <div className="chest-bands"></div>
                  
                  {/* Свечение сокровищ */}
                  <div className="treasure-glow"></div>
                </div>
                
                {/* Кучка сокровищ (монеты и драгоценности) */}
                <div className="treasure-pile">
                  {/* Монеты */}
                  <div className="coin"></div>
                  <div className="coin"></div>
                  <div className="coin"></div>
                  <div className="coin"></div>
                  
                  {/* Драгоценные камни */}
                  <div className="gem"></div>
                  <div className="gem"></div>
                </div>
              </div>
            </div>
            
            <span className="quest-title">
              <span className="quest-text">«В поисках сокровищ»</span>
            </span>
          </h2>
          
          <div className="features">
            <div className="feature">
              <span className="feature-icon">✨</span>
              <span className="feature-text">Незабываемые эмоции</span>
            </div>
            <div className="feature">
              <span className="feature-icon">🎯</span>
              <span className="feature-text">Увлекательное путешествие</span>
            </div>
          </div>
        </div>

        {/* Кнопка перехода */}
        <div className={`action-section ${animated ? 'animate' : ''}`}>
          <button 
            className="cta-button"
            onClick={handleNavigate}
            onMouseEnter={(e) => {
              e.currentTarget.classList.add('hover');
            }}
            onMouseLeave={(e) => {
              e.currentTarget.classList.remove('hover');
            }}
          >
            <span className="button-text">Начать квест</span>
            <span className="button-arrow">→</span>
          </button>
          
          <div className="hint">
            <span className="hint-text">Расследуйте тайны Беларуси</span>
          </div>
        </div>

        {/* Декоративные иконки */}
        <div className="decorative-elements">
          <div className="event-icon icon-1">🎨</div>
          <div className="event-icon icon-2">🎵</div>
          <div className="event-icon icon-3">🎭</div>
        </div>
      </div>

      {/* Подложка */}
      <div className="gradient-overlay"></div>
    </div>
  );
};

export default WelcomePage;
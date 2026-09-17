import { useState, useEffect, useRef } from 'react';
import api from '../api';
import './DoomsdayButton.css';

function DoomsdayButton({ onDestroyed }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCoverOpen, setIsCoverOpen] = useState(false);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [destroyed, setDestroyed] = useState(false);
  const pollingRef = useRef(null);

  useEffect(() => {
    if (isOpen && !destroyed) {
      const pollStatus = async () => {
        try {
          const response = await api.get('/doomsday/status');
          setStatus(response.data);
          if (response.data.timeLeft !== null) {
            setTimeLeft(response.data.timeLeft);
          }
        } catch (error) {
          console.error('Ошибка опроса статуса:', error);
        }
      };

      pollStatus();
      pollingRef.current = setInterval(pollStatus, 2000);

      return () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
      };
    }
  }, [isOpen, destroyed]);

  useEffect(() => {
    if (timeLeft !== null && timeLeft > 0 && !destroyed) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeLeft, destroyed]);

  const handlePress = async () => {
    setLoading(true);
    try {
      const response = await api.post('/doomsday/press');
      setStatus(response.data);
      setTimeLeft(response.data.timeLeft);
      setIsCoverOpen(false);
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirm('ВЫ УВЕРЕНЫ? Это уничтожит ВСЮ БАЗУ ЗНАНИЙ безвозвратно!')) {
      return;
    }
    
    setLoading(true);
    try {
      const response = await api.post('/doomsday/confirm');
      
      if (response.data.destroyed) {
        setDestroyed(true);
        setIsCoverOpen(false);
        
        setTimeout(() => {
          if (onDestroyed) onDestroyed();
        }, 4000);
      }
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      await api.post('/doomsday/cancel');
      setStatus(null);
      setTimeLeft(null);
    } catch (error) {
      console.error('Ошибка отмены:', error);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsCoverOpen(false);
    setStatus(null);
    setTimeLeft(null);
  };

  const formatTime = (seconds) => {
    if (seconds === null) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) {
    return (
      <button 
        className="doomsday-trigger"
        onClick={() => setIsOpen(true)}
        title="Судный день"
      >
        ☢ Судный день
      </button>
    );
  }

  if (destroyed) {
    return (
      <div className="doomsday-modal-overlay">
        <div className="doomsday-destroyed">
          <div className="doomsday-boom">💥</div>
          <h1>СУДНЫЙ ДЕНЬ СВЕРШИЛСЯ</h1>
          <p>База знаний уничтожена</p>
          <p className="doomsday-destroyed-sub">Все статьи и ссылки удалены безвозвратно</p>
        </div>
      </div>
    );
  }

  const votesCount = status?.totalVotes || 0;
  const userHasVoted = status?.userHasVoted || false;

  return (
    <div className="doomsday-modal-overlay" onClick={handleClose}>
      <div className="doomsday-modal" onClick={(e) => e.stopPropagation()}>
        <div className="doomsday-header">
          <h2>☢ СУДНЫЙ ДЕНЬ</h2>
          <button className="doomsday-close" onClick={handleClose}>✕</button>
        </div>

        <div className="doomsday-content">
          <div className="doomsday-warning">
            <p className="doomsday-warning-title">ВНИМАНИЕ</p>
            <p>Эта кнопка безвозвратно уничтожит <strong>ВСЮ</strong> базу знаний:</p>
            <ul>
              <li>Все статьи и инструкции</li>
              <li>Все вложенные материалы</li>
              <li>Все загруженные изображения</li>
              <li>Все активные ссылки</li>
            </ul>
            <p className="doomsday-warning-action">
              Для активации требуется <strong>ОДНОВРЕМЕННОЕ нажатие двух администраторов</strong>.
            </p>
          </div>

          {votesCount > 0 && (
            <div className="doomsday-status">
              <div className="doomsday-votes">
                <span className="doomsday-votes-count">
                  {votesCount} / 2
                </span>
                <span className="doomsday-votes-label">
                  администраторов активировали
                </span>
              </div>
              
              {votesCount === 1 && timeLeft > 0 && (
                <div className="doomsday-countdown">
                  <div className="doomsday-timer">{formatTime(timeLeft)}</div>
                  <p>Второй администратор должен нажать кнопку</p>
                </div>
              )}
              
              {votesCount === 1 && timeLeft === 0 && (
                <div className="doomsday-expired">
                  ⏱ Время истекло
                </div>
              )}
            </div>
          )}

          <div className="doomsday-button-container">
            <div className="doomsday-button-base">
              <div className="doomsday-button-red">
                <div className="doomsday-button-inner"></div>
              </div>
            </div>

            <div 
              className={`doomsday-cover ${isCoverOpen ? 'open' : ''}`}
              onClick={() => {
                if (votesCount === 0 && !userHasVoted) {
                  setIsCoverOpen(!isCoverOpen);
                }
              }}
            >
              <div className="doomsday-cover-body">
                <div className="doomsday-cover-stripes"></div>
                <div className="doomsday-cover-text">ЗАЩИЩЕНО</div>
              </div>
              {!isCoverOpen && votesCount === 0 && (
                <div className="doomsday-cover-hint">
                  Нажмите, чтобы открыть
                </div>
              )}
            </div>
          </div>

          {isCoverOpen && votesCount === 0 && !userHasVoted && (
            <button 
              className="doomsday-action-btn first-press"
              onClick={handlePress}
              disabled={loading}
            >
              {loading ? 'Активация...' : 'АКТИВИРОВАТЬ'}
            </button>
          )}

          {userHasVoted && votesCount === 1 && (
            <div className="doomsday-waiting">
              <div className="doomsday-waiting-pulse"></div>
              <p>Ожидание второго администратора...</p>
              <button 
                className="doomsday-cancel-btn"
                onClick={handleCancel}
              >
                Отменить голос
              </button>
            </div>
          )}

          {!userHasVoted && votesCount === 1 && timeLeft > 0 && (
            <button 
              className="doomsday-action-btn confirm-press"
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading ? 'УНИЧТОЖЕНИЕ...' : '☢ ПОДТВЕРДИТЬ'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default DoomsdayButton;
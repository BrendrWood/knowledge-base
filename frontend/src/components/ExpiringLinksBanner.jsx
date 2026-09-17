import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import './ExpiringLinksBanner.css';

function ExpiringLinksBanner() {
  const navigate = useNavigate();
  const [links, setLinks] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Проверяем, не скрыт ли баннер сегодня
    const hiddenUntil = localStorage.getItem('expiring_banner_hidden_until');
    if (hiddenUntil) {
      const until = new Date(hiddenUntil);
      if (new Date() < until) {
        setDismissed(true);
        setLoading(false);
        return;
      }
    }
    loadExpiring();
  }, []);

  const loadExpiring = async () => {
    try {
      const response = await api.get('/shared-links/expiring/soon?hours=24');
      setLinks(response.data);
    } catch (error) {
      console.error('Ошибка загрузки истекающих ссылок:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    // Скрываем до конца дня (до 00:00 завтра)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    localStorage.setItem('expiring_banner_hidden_until', tomorrow.toISOString());
    setDismissed(true);
  };

  const handleGoToArticle = (articleId) => {
    navigate(`/article/${articleId}`);
  };

  // Форматирование оставшегося времени
  const formatTimeLeft = (expiresAt) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return 'истекла';
    
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    
    if (hours > 0) {
      return `через ${hours}ч ${minutes}м`;
    }
    return `через ${minutes}м`;
  };

  if (loading || dismissed || links.length === 0) {
    return null;
  }

  const count = links.length;
  const linkWord = count === 1 ? 'ссылка' : (count < 5 ? 'ссылки' : 'ссылок');

  return (
    <div className="expiring-banner">
      <div className="expiring-banner-header">
        <div className="expiring-banner-left">
          <span className="expiring-icon">⏰</span>
          <span className="expiring-text">
            <strong>{count}</strong> {linkWord} истек{count === 1 ? 'ает' : 'ают'} в течение 24 часов
          </span>
        </div>
        <div className="expiring-banner-actions">
          <button 
            className="expiring-toggle-btn"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Свернуть' : 'Показать'}
          </button>
          <button 
            className="expiring-dismiss-btn"
            onClick={handleDismiss}
            title="Скрыть до завтра"
          >
            ✕
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="expiring-banner-body">
          <table className="expiring-table">
            <thead>
              <tr>
                <th>Статья</th>
                <th>Режим</th>
                <th>Истекает</th>
                <th>Осталось</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.id}>
                  <td className="expiring-article-name">
                    {link.article?.title || 'Без названия'}
                  </td>
                  <td>
                    <span className={`expiring-mode ${link.mode}`}>
                      {link.mode === 'web' ? 'ПК' : 'Моб'}
                    </span>
                  </td>
                  <td className="expiring-time">
                    {new Date(link.expiresAt).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="expiring-time-left">
                    {formatTimeLeft(link.expiresAt)}
                  </td>
                  <td>
                    <button 
                      className="expiring-go-btn"
                      onClick={() => handleGoToArticle(link.article?.id)}
                    >
                      Открыть
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ExpiringLinksBanner;
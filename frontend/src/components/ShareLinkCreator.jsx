import { useState } from 'react';
import api from '../api';
import './ShareLinkCreator.css';

function ShareLinkCreator({ articleId, onClose, onLinkCreated }) {
  const [mode, setMode] = useState('web');
  const [isPermanent, setIsPermanent] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copyMessage, setCopyMessage] = useState('');

  // Вычисляем минимальную и максимальную дату
  const getMinDate = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5); // Минимум через 5 минут
    return now.toISOString().slice(0, 16);
  };

  const getMaxDate = () => {
    const max = new Date();
    max.setDate(max.getDate() + 7);
    return max.toISOString().slice(0, 16);
  };

  // Устанавливаем дату по умолчанию (через 24 часа)
  const getDefaultDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toISOString().slice(0, 16);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopyMessage('✅ Скопировано!');
    setTimeout(() => setCopyMessage(''), 3000);
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const payload = {
        articleId,
        mode,
        isPermanent,
      };

      if (!isPermanent) {
        if (!expiresAt) {
          alert('Выберите дату и время истечения срока');
          setLoading(false);
          return;
        }

        // Проверяем, что дата не в прошлом
        const selectedDate = new Date(expiresAt);
        const now = new Date();
        if (selectedDate <= now) {
          alert('Дата и время должны быть в будущем (минимум через 5 минут)');
          setLoading(false);
          return;
        }

        payload.expiresAt = new Date(expiresAt).toISOString();
      }

      const response = await api.post('/shared-links', payload);
      
      setResult(response.data);
      if (onLinkCreated) onLinkCreated(response.data);
    } catch (error) {
      alert('Ошибка создания ссылки: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="share-result">
        <h3>✅ Ссылка создана!</h3>
        <div className="share-result-item">
          <label>🔗 Ссылка:</label>
          <div className="share-result-value">
            <input type="text" readOnly value={result.link} />
            <button onClick={() => copyToClipboard(result.link)}>📋</button>
          </div>
        </div>
        <div className="share-result-item">
          <label>🔑 Код доступа:</label>
          <div className="share-result-value">
            <input type="text" readOnly value={result.code} />
            <button onClick={() => copyToClipboard(result.code)}>📋</button>
          </div>
        </div>
        {copyMessage && <div className="share-copy-message">{copyMessage}</div>}
        <div className="share-result-meta">
          <span>📱 {result.mode === 'web' ? 'Веб-версия' : 'Мобильная версия'}</span>
          <span>
            {result.isPermanent 
              ? '♾️ Постоянная' 
              : `⏱️ До ${new Date(result.expiresAt).toLocaleString('ru-RU')}`
            }
          </span>
        </div>
        <button onClick={onClose} className="share-done-btn">
          Готово
        </button>
      </div>
    );
  }

  return (
    <div className="share-creator">
      <h3>🔗 Создать ссылку</h3>
      
      <div className="share-field">
        <label>Версия:</label>
        <div className="share-mode-buttons">
          <button className={mode === 'web' ? 'active' : ''} onClick={() => setMode('web')}>
              Версия для ПК
          </button>
          <button 
            className={mode === 'mobile' ? 'active' : ''}
            onClick={() => setMode('mobile')}
          >
            Мобильная версия
          </button>
        </div>
      </div>

      <div className="share-field">
        <label className="share-checkbox">
          <input 
            type="checkbox" 
            checked={isPermanent}
            onChange={() => {
              setIsPermanent(!isPermanent);
              if (!isPermanent) {
                setExpiresAt(getDefaultDate());
              }
            }}
          />
          ♾️ Постоянная ссылка (без ограничения по времени)
        </label>
      </div>

      {!isPermanent && (
        <div className="share-field">
          <label>⏱️ Дата и время истечения срока:</label>
          <input
            type="datetime-local"
            value={expiresAt || getDefaultDate()}
            onChange={(e) => setExpiresAt(e.target.value)}
            min={getMinDate()}
            max={getMaxDate()}
            className="share-datetime-input"
          />
          <div className="share-datetime-hint">
            ⚡ Минимум: через 5 минут • Максимум: 7 дней
          </div>
        </div>
      )}

      <div className="share-actions">
        <button onClick={onClose} className="share-cancel-btn">
          Отмена
        </button>
        <button onClick={handleCreate} className="share-create-btn" disabled={loading}>
          {loading ? 'Создание...' : '🚀 Создать ссылку'}
        </button>
      </div>
    </div>
  );
}

export default ShareLinkCreator;
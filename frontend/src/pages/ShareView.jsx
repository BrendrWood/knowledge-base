import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import './ShareView.css';

function ShareView() {
  const { slug } = useParams();
  const [step, setStep] = useState('code');
  const [code, setCode] = useState('');
  const [article, setArticle] = useState(null);
  const [mode, setMode] = useState('web');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [linkInfo, setLinkInfo] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    const checkLink = async () => {
      try {
        const response = await api.get(`/shared-links/${slug}/info`);
        setLinkInfo(response.data);
        
        if (!response.data.isActive) {
          setStep('expired');
          setError('Ссылка деактивирована');
        }
      } catch (error) {
        setStep('error');
        setError('Ссылка не найдена');
      }
    };
    checkLink();
  }, [slug]);

  // Таймер для страницы со статьёй
  useEffect(() => {
    if (linkInfo?.expiresAt && !linkInfo?.isPermanent && step === 'article') {
      const interval = setInterval(() => {
        const expiresAt = new Date(linkInfo.expiresAt);
        const now = new Date();
        const diff = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
        
        if (diff <= 0) {
          clearInterval(interval);
          setStep('expired');
          window.location.reload();
        } else {
          const hours = Math.floor(diff / 3600);
          const minutes = Math.floor((diff % 3600) / 60);
          const seconds = diff % 60;
          setTimeLeft(
            hours > 0 
              ? `${hours}ч ${minutes}м ${seconds}с`
              : `${minutes}м ${seconds}с`
          );
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [linkInfo, step]);

  // Таймер для перезагрузки страницы
  useEffect(() => {
    let timer = null;
    if (linkInfo?.expiresAt && !linkInfo?.isPermanent && step === 'article') {
      const expiresAt = new Date(linkInfo.expiresAt);
      const now = new Date();
      const timeLeft = expiresAt.getTime() - now.getTime();

      if (timeLeft > 0) {
        timer = setTimeout(() => {
          window.location.reload();
        }, timeLeft + 1000);
      }
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [linkInfo, step]);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError('Код должен содержать 6 цифр');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/shared-links/verify', { slug, code });
      
      setArticle(response.data.article);
      setMode(response.data.mode);
      setStep('article');
    } catch (error) {
      if (error.response?.status === 401) {
        setError('Неверный код доступа');
      } else if (error.response?.status === 410) {
        setStep('expired');
        setError('Срок действия ссылки истёк');
      } else {
        setError('Ошибка проверки. Попробуйте позже.');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    if (mode === 'mobile') {
      return (
        <div className="share-mobile-frame">
          <div 
            className="share-mobile-content"
            dangerouslySetInnerHTML={{ __html: article.content_mobile }}
          />
        </div>
      );
    }
    return (
      <div 
        className="share-web-content"
        dangerouslySetInnerHTML={{ __html: article.content_web }}
      />
    );
  };

  if (step === 'code') {
    return (
      <div className="share-container">
        <div className="share-card">
          <div className="share-header">
            <h1>Доступ к статье</h1>
            <p className="share-subtitle">
              {linkInfo?.article?.title || 'Введите код доступа'}
            </p>
          </div>

          {linkInfo?.expiresAt && !linkInfo?.isPermanent && (
            <p className="share-expires">
              ⏱️ Действует до {new Date(linkInfo.expiresAt).toLocaleString('ru-RU')}
            </p>
          )}

          <form onSubmit={handleVerify} className="share-form">
            <div className="share-code-input">
              <input
                type="text"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                autoFocus
                className="share-input"
              />
            </div>

            {error && <p className="share-error">{error}</p>}

            <button 
              type="submit" 
              className="share-btn"
              disabled={loading}
            >
              {loading ? 'Проверка...' : '📖 Читать статью'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (step === 'article' && article) {
    return (
      <div className="share-article-container">
        <div className="share-article-header">
          <h1>{article.title}</h1>
          <div className="share-badges">
            <span className={`share-badge ${mode}`}>
              {mode === 'mobile' ? '📱 Мобильная' : '🌐 Веб'}
            </span>
            {linkInfo?.expiresAt && !linkInfo?.isPermanent && (
              <span className="share-expires-badge">
                ⏱️ До {new Date(linkInfo.expiresAt).toLocaleString('ru-RU')}
              </span>
            )}
          </div>
          {linkInfo?.expiresAt && !linkInfo?.isPermanent && timeLeft && (
            <div className="share-time-left">
              ⏳ Осталось: <strong>{timeLeft}</strong>
            </div>
          )}
        </div>
        <div className="share-article-body">
          {renderContent()}
        </div>
      </div>
    );
  }

  return (
    <div className="share-container">
      <div className="share-card share-error-card">
        <div className="share-error-icon">⛔</div>
        <h2>{step === 'expired' ? 'Срок действия истёк' : 'Ошибка доступа'}</h2>
        <p>{error}</p>
        <p className="share-error-hint">
          {step === 'expired' 
            ? 'Свяжитесь с администратором для получения новой ссылки' 
            : 'Проверьте правильность ссылки'}
        </p>
      </div>
    </div>
  );
}

export default ShareView;
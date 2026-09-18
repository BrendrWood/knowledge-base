import { useState, useEffect } from 'react';
import api from '../api';
import './SharedLinksTable.css';

function SharedLinksTable({ articleId }) {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // Базовый путь для ссылок: /base в продакшене, пусто локально
  const basePath = import.meta.env.PROD ? '/base' : '';
  const shareBaseUrl = `${window.location.origin}${basePath}`;

  useEffect(() => {
    if (articleId) {
      loadLinks();
    }
  }, [articleId]);

  const loadLinks = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/shared-links/article/${articleId}`);
      setLinks(response.data);
    } catch (error) {
      console.error('Ошибка загрузки ссылок:', error);
    } finally {
      setLoading(false);
    }
  };

  const deactivateLink = async (id) => {
    if (!confirm('Деактивировать ссылку?')) return;
    try {
      await api.delete(`/shared-links/${id}`);
      loadLinks();
    } catch (error) {
      console.error('Ошибка деактивации:', error);
    }
  };

  const copyToClipboard = (text, event) => {
    navigator.clipboard.writeText(text);
    const btn = event.currentTarget;
    const originalText = btn.textContent;
    btn.textContent = '✓';
    setTimeout(() => { btn.textContent = originalText; }, 1500);
  };

  const copyFull = (link, event) => {
    const fullText = `🔗 Ссылка: ${shareBaseUrl}/share/${link.slug}\n🔑 Код доступа: ${link.code}`;
    navigator.clipboard.writeText(fullText);
    
    const btn = event.currentTarget;
    const originalText = btn.textContent;
    btn.textContent = '✓ Скопировано';
    setCopiedId(link.id);
    setTimeout(() => {
      btn.textContent = originalText;
      setCopiedId(null);
    }, 1500);
  };

  const activeLinks = links.filter(link => link.isActive);

  if (loading) {
    return <div className="shared-links-loading">...</div>;
  }

  if (activeLinks.length === 0) {
    return null;
  }

  return (
    <div className="shared-links-wrapper">
      <button 
        className="shared-links-toggle"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="toggle-icon">{isOpen ? '▾' : '▸'}</span>
        <span className="toggle-label">Ссылки ({activeLinks.length})</span>
        {!isOpen && <span className="toggle-hint">показать</span>}
      </button>

      {isOpen && (
        <div className="shared-links-dropdown">
          <div className="shared-links-list">
            {activeLinks.map((link) => (
              <div key={link.id} className="link-row">
                <div className="link-row-content">
                  <span className="link-mode">
                    {link.mode === 'web' ? 'ПК' : 'Моб'}
                  </span>
                  <span className="link-url">
                    {`${shareBaseUrl}/share/${link.slug}`}
                  </span>
                  <button 
                    onClick={(e) => copyToClipboard(`${shareBaseUrl}/share/${link.slug}`, e)}
                    className="link-copy-btn"
                    title="Копировать ссылку"
                  >
                    ⧉
                  </button>
                  <span className="link-code">{link.code}</span>
                  <button 
                    onClick={(e) => copyToClipboard(link.code, e)}
                    className="link-copy-btn"
                    title="Копировать код"
                  >
                    ⧉
                  </button>
                  <button 
                    onClick={(e) => copyFull(link, e)}
                    className={`link-copy-full-btn ${copiedId === link.id ? 'copied' : ''}`}
                    title="Скопировать ссылку и код одним сообщением"
                  >
                    Копировать всё
                  </button>
                  <span className="link-expires">
                    {link.isPermanent ? 'бессрочно' : `до ${new Date(link.expiresAt).toLocaleString('ru-RU', { 
                      day: '2-digit', 
                      month: '2-digit', 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}`}
                  </span>
                  <button 
                    onClick={() => deactivateLink(link.id)}
                    className="link-deactivate-btn"
                    title="Деактивировать"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default SharedLinksTable;
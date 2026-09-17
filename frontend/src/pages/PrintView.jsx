import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '../api';
import './PrintView.css';

function PrintView() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'web'; // 'web' или 'mobile'
  
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadArticle();
  }, [id]);

  const loadArticle = async () => {
    try {
      const response = await api.get(`/articles/${id}`);
      setArticle(response.data);
      setLoading(false);
      
      // Автоматически открываем диалог печати после загрузки
      setTimeout(() => {
        window.print();
      }, 800);
    } catch (error) {
      console.error('Ошибка загрузки статьи:', error);
      setError('Статья не найдена');
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="print-loading">Загрузка статьи...</div>;
  }

  if (error) {
    return <div className="print-error">{error}</div>;
  }

  return (
    <div className="print-view">
      {/* Кнопка закрытия — не печатается */}
      <div className="print-controls no-print">
        <button 
          className="print-close-btn"
          onClick={() => window.close()}
        >
          Закрыть
        </button>
        <button 
          className="print-again-btn"
          onClick={() => window.print()}
        >
          Печать
        </button>
        <div className="print-mode-info">
          {mode === 'mobile' ? 'Мобильная версия' : 'Веб-версия'}
        </div>
      </div>

      {/* Печатаемый контент */}
      <div className={`print-content ${mode}`}>
        <h1 className="print-title">{article.title}</h1>
        <div className="print-meta">
          {new Date().toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })}
        </div>
        <div 
          className="print-body"
          dangerouslySetInnerHTML={{ 
            __html: mode === 'mobile' ? article.content_mobile : article.content_web 
          }}
        />
      </div>
    </div>
  );
}

export default PrintView;
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import './Dashboard.css';

function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await api.get('/stats');
      setStats(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
      setError(error.response?.data?.error || 'Ошибка загрузки');
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('ru-RU').format(num || 0);
  };

  const formatDate = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return <div className="dashboard-loading">Загрузка статистики...</div>;
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <header className="dashboard-header">
          <div className="dashboard-header-left">
            <button onClick={() => navigate('/')} className="dashboard-back-btn">
              ← Назад
            </button>
            <h1>Статистика</h1>
          </div>
        </header>
        <div className="dashboard-error">{error}</div>
      </div>
    );
  }

  const { summary, topArticles, activeLinksList, recentlyExpired } = stats;

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header-left">
          <button onClick={() => navigate('/')} className="dashboard-back-btn">
            ← Назад
          </button>
          <h1>Статистика</h1>
        </div>
      </header>

      <div className="dashboard-content">
        {/* КАРТОЧКИ С ЦИФРАМИ */}
        <div className="dashboard-cards">
          <div className="dashboard-card">
            <div className="dashboard-card-value">{formatNumber(summary.totalArticles)}</div>
            <div className="dashboard-card-label">Статей в базе</div>
          </div>
          <div className="dashboard-card dashboard-card-success">
            <div className="dashboard-card-value">{formatNumber(summary.activeLinks)}</div>
            <div className="dashboard-card-label">Активных ссылок</div>
          </div>
          <div className="dashboard-card dashboard-card-muted">
            <div className="dashboard-card-value">{formatNumber(summary.expiredLinks)}</div>
            <div className="dashboard-card-label">Истёкших ссылок</div>
          </div>
          <div className="dashboard-card dashboard-card-primary">
            <div className="dashboard-card-value">{formatNumber(summary.totalViews)}</div>
            <div className="dashboard-card-label">Всего просмотров</div>
          </div>
          <div className="dashboard-card dashboard-card-purple">
            <div className="dashboard-card-value">{formatNumber(summary.totalUsers)}</div>
            <div className="dashboard-card-label">Администраторов</div>
          </div>
          <div className="dashboard-card">
            <div className="dashboard-card-value">{formatNumber(summary.totalLinks)}</div>
            <div className="dashboard-card-label">Всего ссылок</div>
          </div>
        </div>

        {/* ТОП СТАТЕЙ */}
        <div className="dashboard-section">
          <h2 className="dashboard-section-title">Топ статей по просмотрам</h2>
          {topArticles.length === 0 ? (
            <div className="dashboard-empty">Нет данных о просмотрах</div>
          ) : (
            <div className="dashboard-table-wrapper">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>#</th>
                    <th>Статья</th>
                    <th style={{ width: '120px', textAlign: 'right' }}>Просмотры</th>
                    <th style={{ width: '120px', textAlign: 'right' }}>Ссылок</th>
                    <th style={{ width: '100px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {topArticles.map((item, idx) => (
                    <tr key={item.articleId}>
                      <td className="dashboard-rank">{idx + 1}</td>
                      <td className="dashboard-article-name">{item.title}</td>
                      <td className="dashboard-number">{formatNumber(item.totalViews)}</td>
                      <td className="dashboard-number-muted">{formatNumber(item.linksCount)}</td>
                      <td>
                        <button 
                          className="dashboard-go-btn"
                          onClick={() => navigate(`/article/${item.articleId}`)}
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

        {/* АКТИВНЫЕ ССЫЛКИ */}
        <div className="dashboard-section">
          <h2 className="dashboard-section-title">Активные ссылки</h2>
          {activeLinksList.length === 0 ? (
            <div className="dashboard-empty">Нет активных ссылок</div>
          ) : (
            <div className="dashboard-table-wrapper">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Статья</th>
                    <th style={{ width: '80px' }}>Режим</th>
                    <th style={{ width: '90px' }}>Код</th>
                    <th style={{ width: '160px' }}>Истекает</th>
                    <th style={{ width: '100px', textAlign: 'right' }}>Просмотры</th>
                  </tr>
                </thead>
                <tbody>
                  {activeLinksList.map((link) => (
                    <tr key={link.id}>
                      <td className="dashboard-article-name">{link.articleTitle}</td>
                      <td>
                        <span className={`dashboard-mode-badge ${link.mode}`}>
                          {link.mode === 'web' ? 'ПК' : 'Моб'}
                        </span>
                      </td>
                      <td className="dashboard-code">{link.code}</td>
                      <td className="dashboard-date">
                        {link.isPermanent 
                          ? 'бессрочно' 
                          : formatDate(link.expiresAt)
                        }
                      </td>
                      <td className="dashboard-number">{formatNumber(link.views)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ИСТЁКШИЕ ССЫЛКИ */}
        <div className="dashboard-section">
          <h2 className="dashboard-section-title">
            Истёкшие ссылки <span className="dashboard-section-hint">(за последние 30 дней)</span>
          </h2>
          {recentlyExpired.length === 0 ? (
            <div className="dashboard-empty">Нет истёкших ссылок</div>
          ) : (
            <div className="dashboard-table-wrapper">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Статья</th>
                    <th style={{ width: '80px' }}>Режим</th>
                    <th style={{ width: '180px' }}>Истекла</th>
                    <th style={{ width: '100px', textAlign: 'right' }}>Просмотры</th>
                  </tr>
                </thead>
                <tbody>
                  {recentlyExpired.map((link) => (
                    <tr key={link.id}>
                      <td className="dashboard-article-name">{link.articleTitle}</td>
                      <td>
                        <span className={`dashboard-mode-badge ${link.mode}`}>
                          {link.mode === 'web' ? 'ПК' : 'Моб'}
                        </span>
                      </td>
                      <td className="dashboard-date">{formatDate(link.expiresAt)}</td>
                      <td className="dashboard-number">{formatNumber(link.views)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
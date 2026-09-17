import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import './AuditLogs.css';

function AuditLogs() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  
  // Фильтры
  const [filterAction, setFilterAction] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterEntityType, setFilterEntityType] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [filterAction, filterUser, filterEntityType, currentPage]);

  const loadUsers = async () => {
    try {
      const response = await api.get('/audit-logs/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Ошибка загрузки пользователей:', error);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', currentPage);
      params.append('limit', 50);
      if (filterAction) params.append('action', filterAction);
      if (filterUser) params.append('userId', filterUser);
      if (filterEntityType) params.append('entityType', filterEntityType);

      const response = await api.get(`/audit-logs?${params.toString()}`);
      setLogs(response.data.logs);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Ошибка загрузки логов:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFilterAction('');
    setFilterUser('');
    setFilterEntityType('');
    setCurrentPage(1);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Описание действия
  const getActionLabel = (action) => {
    const labels = {
      'article.create': { text: 'Создал статью', color: 'success' },
      'article.update': { text: 'Изменил статью', color: 'primary' },
      'article.delete': { text: 'Удалил статью', color: 'danger' },
      'link.create': { text: 'Создал ссылку', color: 'purple' },
      'link.deactivate': { text: 'Деактивировал ссылку', color: 'muted' },
      'user.login': { text: 'Вход в систему', color: 'success' },
      'user.logout': { text: 'Выход из системы', color: 'muted' },
      'user.create': { text: 'Создал администратора', color: 'success' },
      'user.delete': { text: 'Удалил администратора', color: 'danger' },
      'doomsday.press': { text: 'Нажал кнопку Судного дня', color: 'danger' },
      'doomsday.confirm': { text: '☢ ПОДТВЕРДИЛ СУДНЫЙ ДЕНЬ', color: 'danger' },
    };
    return labels[action] || { text: action, color: 'muted' };
  };

  // Детали изменения
  const renderDetails = (log) => {
    if (!log.details) return null;

    if (log.action === 'article.update') {
      const parts = [];
      if (log.details.title) {
        parts.push(`Заголовок: "${log.details.title.from}" → "${log.details.title.to}"`);
      }
      if (log.details.contentWebChanged) {
        parts.push('Изменено содержимое веб-версии');
      }
      if (log.details.contentMobileChanged) {
        parts.push('Изменено содержимое мобильной версии');
      }
      return parts.length > 0 ? parts.join(' • ') : null;
    }

    if (log.action === 'article.delete') {
      const parts = [];
      if (log.details.deletedChildArticles > 0) {
        parts.push(`Удалено дочерних: ${log.details.deletedChildArticles}`);
      }
      if (log.details.deletedLinks > 0) {
        parts.push(`Удалено ссылок: ${log.details.deletedLinks}`);
      }
      return parts.length > 0 ? parts.join(' • ') : null;
    }

    if (log.action === 'link.create') {
      const parts = [];
      parts.push(log.details.mode === 'web' ? 'Веб' : 'Мобильная');
      parts.push(log.details.isPermanent ? 'Постоянная' : 'Временная');
      if (log.details.code) parts.push(`Код: ${log.details.code}`);
      return parts.join(' • ');
    }

    if (log.action === 'user.create' && log.details.role) {
      return log.details.role === 'super_admin' ? 'Роль: супер-администратор' : 'Роль: администратор';
    }

    return null;
  };

  const canGoToEntity = (log) => {
    return log.entityType === 'article' && log.entityId && log.action !== 'article.delete';
  };

  return (
    <div className="audit-page">
      <header className="audit-header">
        <div className="audit-header-left">
          <button onClick={() => navigate('/')} className="audit-back-btn">
            ← Назад
          </button>
          <h1>История изменений</h1>
        </div>
        <div className="audit-counter">
          Всего записей: {pagination?.total || 0}
        </div>
      </header>

      <div className="audit-content">
        {/* ФИЛЬТРЫ */}
        <div className="audit-filters">
          <div className="audit-filter-group">
            <label>Тип действия</label>
            <select 
              value={filterAction} 
              onChange={(e) => { setFilterAction(e.target.value); setCurrentPage(1); }}
              className="audit-select"
            >
              <option value="">Все действия</option>
              <option value="article.create">Создание статьи</option>
              <option value="article.update">Изменение статьи</option>
              <option value="article.delete">Удаление статьи</option>
              <option value="link.create">Создание ссылки</option>
              <option value="link.deactivate">Деактивация ссылки</option>
              <option value="user.login">Вход в систему</option>
              <option value="user.logout">Выход из системы</option>
              <option value="user.create">Создание админа</option>
              <option value="user.delete">Удаление админа</option>
              <option value="doomsday.press">Нажатие Судного дня</option>
              <option value="doomsday.confirm">Подтверждение Судного дня</option>
            </select>
          </div>

          <div className="audit-filter-group">
            <label>Пользователь</label>
            <select 
              value={filterUser} 
              onChange={(e) => { setFilterUser(e.target.value); setCurrentPage(1); }}
              className="audit-select"
            >
              <option value="">Все пользователи</option>
              {users.map((u) => (
                <option key={u.userId} value={u.userId}>{u.username}</option>
              ))}
            </select>
          </div>

          <div className="audit-filter-group">
            <label>Тип объекта</label>
            <select 
              value={filterEntityType} 
              onChange={(e) => { setFilterEntityType(e.target.value); setCurrentPage(1); }}
              className="audit-select"
            >
              <option value="">Все объекты</option>
              <option value="article">Статья</option>
              <option value="link">Ссылка</option>
              <option value="user">Пользователь</option>
              <option value="system">Система</option>
            </select>
          </div>

          <button onClick={handleReset} className="audit-reset-btn">
            Сбросить
          </button>
        </div>

        {/* СПИСОК ЛОГОВ */}
        {loading ? (
          <div className="audit-loading">Загрузка...</div>
        ) : logs.length === 0 ? (
          <div className="audit-empty">Нет записей</div>
        ) : (
          <>
            <div className="audit-table-wrapper">
              <table className="audit-table">
                <thead>
                  <tr>
                    <th style={{ width: '160px' }}>Дата</th>
                    <th style={{ width: '160px' }}>Пользователь</th>
                    <th style={{ width: '180px' }}>Действие</th>
                    <th>Объект</th>
                    <th>Детали</th>
                    <th style={{ width: '80px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const action = getActionLabel(log.action);
                    const details = renderDetails(log);
                    return (
                      <tr key={log.id}>
                        <td className="audit-date">{formatDate(log.createdAt)}</td>
                        <td className="audit-username">{log.username || '—'}</td>
                        <td>
                          <span className={`audit-badge audit-badge-${action.color}`}>
                            {action.text}
                          </span>
                        </td>
                        <td className="audit-entity">
                          {log.entityTitle || '—'}
                        </td>
                        <td className="audit-details">{details || ''}</td>
                        <td>
                          {canGoToEntity(log) && (
                            <button 
                              className="audit-go-btn"
                              onClick={() => navigate(`/article/${log.entityId}`)}
                              title="Открыть статью"
                            >
                              →
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ПАГИНАЦИЯ */}
            {pagination && pagination.pages > 1 && (
              <div className="audit-pagination">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="audit-page-btn"
                >
                  ← Назад
                </button>
                <span className="audit-page-info">
                  Страница {currentPage} из {pagination.pages}
                </span>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(pagination.pages, p + 1))}
                  disabled={currentPage === pagination.pages}
                  className="audit-page-btn"
                >
                  Вперёд →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default AuditLogs;
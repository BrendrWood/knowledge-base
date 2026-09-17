import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import './Users.css';

function Users() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Форма создания
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState('admin');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      const parsed = JSON.parse(user);
      setCurrentUser(parsed);
      if (parsed.role !== 'super_admin') {
        navigate('/');
        return;
      }
    }
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await api.get('/auth/users');
      setUsers(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Ошибка загрузки пользователей:', error);
      setError(error.response?.data?.error || 'Ошибка загрузки');
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');

    try {
      await api.post('/auth/users', {
        username: newUsername,
        password: newPassword,
        fullName: newFullName,
        role: newRole,
      });
      
      // Сбрасываем форму
      setNewUsername('');
      setNewPassword('');
      setNewFullName('');
      setNewRole('admin');
      setShowCreateForm(false);
      
      // Обновляем список
      loadUsers();
    } catch (error) {
      setError(error.response?.data?.error || 'Ошибка создания');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id, username) => {
    if (!confirm(`Удалить пользователя "${username}"?`)) return;
    try {
      await api.delete(`/auth/users/${id}`);
      loadUsers();
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка удаления');
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  if (loading) {
    return <div className="users-loading">Загрузка...</div>;
  }

  const canCreateMore = users.length < 4;

  return (
    <div className="users-page">
      <header className="users-header">
        <div className="users-header-left">
          <button onClick={handleBack} className="users-back-btn">
            ← Назад
          </button>
          <h1>Управление администраторами</h1>
        </div>
        <div className="users-counter">
          {users.length} / 4
        </div>
      </header>

      <div className="users-content">
        <div className="users-info">
          <p>В системе может быть максимум 4 администратора.</p>
          <p>Только super_admin может создавать и удалять пользователей.</p>
        </div>

        {error && <div className="users-error">{error}</div>}

        {/* Форма создания */}
        {!showCreateForm && canCreateMore && (
          <button 
            className="users-create-btn"
            onClick={() => setShowCreateForm(true)}
          >
            + Создать администратора
          </button>
        )}

        {!canCreateMore && (
          <div className="users-limit-warning">
            ⚠️ Достигнут лимит: 4 администратора
          </div>
        )}

        {showCreateForm && (
          <div className="users-create-form">
            <h3>Новый администратор</h3>
            <form onSubmit={handleCreate}>
              <div className="users-form-row">
                <div className="users-form-field">
                  <label>Имя</label>
                  <input
                    type="text"
                    placeholder="Иван Иванов"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    className="users-input"
                  />
                </div>

                <div className="users-form-field">
                  <label>Логин *</label>
                  <input
                    type="text"
                    placeholder="admin2"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="users-input"
                    required
                  />
                </div>
              </div>

              <div className="users-form-row">
                <div className="users-form-field">
                  <label>Пароль * (мин. 6 символов)</label>
                  <input
                    type="password"
                    placeholder="••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="users-input"
                    required
                    minLength={6}
                  />
                </div>

                <div className="users-form-field">
                  <label>Роль</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="users-select"
                  >
                    <option value="admin">Администратор</option>
                    <option value="super_admin">Супер-администратор</option>
                  </select>
                </div>
              </div>

              <div className="users-form-actions">
                <button 
                  type="button" 
                  onClick={() => setShowCreateForm(false)}
                  className="users-cancel-btn"
                >
                  Отмена
                </button>
                <button 
                  type="submit" 
                  className="users-submit-btn"
                  disabled={creating}
                >
                  {creating ? 'Создание...' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Список пользователей */}
        <div className="users-list">
          <h3>Администраторы системы</h3>
          <div className="users-table">
            <div className="users-table-header">
              <div>Имя</div>
              <div>Логин</div>
              <div>Роль</div>
              <div>Последний вход</div>
              <div></div>
            </div>
            {users.map((user) => (
              <div key={user.id} className="users-table-row">
                <div className="users-name">
                  {user.fullName || '—'}
                  {user.id === currentUser?.id && (
                    <span className="users-you-badge">это вы</span>
                  )}
                </div>
                <div className="users-username">{user.username}</div>
                <div>
                  <span className={`users-role ${user.role}`}>
                    {user.role === 'super_admin' ? 'Супер-админ' : 'Админ'}
                  </span>
                </div>
                <div className="users-last-login">
                  {user.lastLogin 
                    ? new Date(user.lastLogin).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'никогда'}
                </div>
                <div>
                  {user.id !== currentUser?.id && (
                    <button
                      onClick={() => handleDelete(user.id, user.username)}
                      className="users-delete-btn"
                      title="Удалить пользователя"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Users;
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import './Login.css';

function Login() {
  const navigate = useNavigate();
  const [step, setStep] = useState('loading'); // 'loading' | 'setup' | 'login'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkSetup();
  }, []);

  const checkSetup = async () => {
    try {
      const response = await api.get('/auth/status');
      if (response.data.hasUsers) {
        setStep('login');
      } else {
        setStep('setup');
      }
    } catch (error) {
      setStep('login');
    }
  };

  const handleSetup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/setup', {
        username,
        password,
        fullName,
      });
      
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      navigate('/');
    } catch (error) {
      setError(error.response?.data?.error || 'Ошибка создания администратора');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/login', { username, password });
      
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      navigate('/');
    } catch (error) {
      setError(error.response?.data?.error || 'Неверный логин или пароль');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'loading') {
    return <div className="login-loading">Загрузка...</div>;
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">База знаний инженера</h1>
        
        {step === 'setup' && (
          <>
            <p className="login-subtitle">Первый запуск</p>
            <p className="login-hint">
              Создайте первого администратора системы
            </p>
          </>
        )}
        
        {step === 'login' && (
          <p className="login-subtitle">Вход в систему</p>
        )}

        <form onSubmit={step === 'setup' ? handleSetup : handleLogin} className="login-form">
          {step === 'setup' && (
            <div className="login-field">
              <label>Ваше имя</label>
              <input
                type="text"
                placeholder="Иван Иванов"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="login-input"
              />
            </div>
          )}

          <div className="login-field">
            <label>Логин</label>
            <input
              type="text"
              placeholder="admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="login-input"
              autoFocus
              required
            />
          </div>

          <div className="login-field">
            <label>Пароль</label>
            <input
              type="password"
              placeholder="Минимум 6 символов"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="login-input"
              required
              minLength={6}
            />
          </div>

          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading 
              ? 'Загрузка...' 
              : step === 'setup' 
                ? 'Создать администратора' 
                : 'Войти'}
          </button>
        </form>

        {step === 'setup' && (
          <p className="login-footer">
            Максимум 4 администратора в системе
          </p>
        )}
      </div>
    </div>
  );
}

export default Login;
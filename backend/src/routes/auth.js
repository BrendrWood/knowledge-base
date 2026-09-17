const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { logAction } = require('../utils/audit');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_123';
const TOKEN_EXPIRES_IN = '7d';

const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN });
};

// Проверка: сколько всего пользователей в системе
router.get('/status', async (req, res) => {
  try {
    const count = await User.count();
    res.json({
      hasUsers: count > 0,
      totalUsers: count,
      maxUsers: 4,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Первый запуск: создание первого администратора
router.post('/setup', async (req, res) => {
  try {
    const count = await User.count();
    
    if (count > 0) {
      return res.status(403).json({ error: 'Система уже настроена' });
    }

    const { username, password, fullName } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Укажите логин и пароль' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть минимум 6 символов' });
    }

    const user = await User.create({
      username,
      password,
      fullName: fullName || username,
      role: 'super_admin',
    });

    const token = generateToken(user.id);

    await logAction({
      user: user,
      action: 'user.create',
      entityType: 'user',
      entityId: user.id,
      entityTitle: user.username,
      details: { role: 'super_admin', isFirstUser: true },
      req,
    });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Ошибка setup:', error);
    res.status(500).json({ error: error.message });
  }
});

// Вход
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Укажите логин и пароль' });
    }

    const user = await User.findOne({ where: { username } });

    if (!user) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Аккаунт деактивирован' });
    }

    const isValid = await user.validatePassword(password);

    if (!isValid) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    await user.update({ lastLogin: new Date() });

    const token = generateToken(user.id);

    await logAction({
      user: user,
      action: 'user.login',
      entityType: 'user',
      entityId: user.id,
      entityTitle: user.username,
      req,
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Ошибка входа:', error);
    res.status(500).json({ error: error.message });
  }
});

// Выход (логируем)
router.post('/logout', requireAuth, async (req, res) => {
  try {
    await logAction({
      user: req.user,
      action: 'user.logout',
      entityType: 'user',
      entityId: req.user.id,
      entityTitle: req.user.username,
      req,
    });
    res.json({ message: 'Выход выполнен' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Проверка текущего токена
router.get('/me', requireAuth, async (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      fullName: req.user.fullName,
      role: req.user.role,
      lastLogin: req.user.lastLogin,
    },
  });
});

// Получить всех пользователей (только для super_admin)
router.get('/users', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'ASC']],
    });

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Создать нового пользователя (только для super_admin, макс 4)
router.post('/users', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const count = await User.count();
    if (count >= 4) {
      return res.status(403).json({ error: 'Достигнут лимит: 4 администратора' });
    }

    const { username, password, fullName, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Укажите логин и пароль' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть минимум 6 символов' });
    }

    const existing = await User.findOne({ where: { username } });
    if (existing) {
      return res.status(400).json({ error: 'Пользователь с таким логином уже существует' });
    }

    const user = await User.create({
      username,
      password,
      fullName: fullName || username,
      role: role || 'admin',
    });

    await logAction({
      user: req.user,
      action: 'user.create',
      entityType: 'user',
      entityId: user.id,
      entityTitle: user.username,
      details: { role: user.role, fullName: user.fullName },
      req,
    });

    res.status(201).json({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
    });
  } catch (error) {
    console.error('Ошибка создания пользователя:', error);
    res.status(500).json({ error: error.message });
  }
});

// Удалить пользователя (только для super_admin)
router.delete('/users/:id', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    if (req.user.id === req.params.id) {
      return res.status(400).json({ error: 'Нельзя удалить самого себя' });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const deletedUsername = user.username;
    const deletedUserId = user.id;

    await user.destroy();

    await logAction({
      user: req.user,
      action: 'user.delete',
      entityType: 'user',
      entityId: deletedUserId,
      entityTitle: deletedUsername,
      req,
    });

    res.json({ message: 'Пользователь удалён' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_123';

// Проверка токена (обязательная авторизация)
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = await User.findByPk(decoded.userId, {
      attributes: { exclude: ['password'] },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Пользователь не найден или деактивирован' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Неверный токен' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Токен истёк' });
    }
    res.status(500).json({ error: error.message });
  }
};

module.exports = { requireAuth };
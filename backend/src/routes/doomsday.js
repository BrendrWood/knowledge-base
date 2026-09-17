const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const DoomsdayVote = require('../models/DoomsdayVote');
const Article = require('../models/Article');
const SharedLink = require('../models/SharedLink');
const { requireAuth } = require('../middleware/auth');
const { logAction } = require('../utils/audit');

const CONFIRMATION_WINDOW_SECONDS = 60;

// Очистка просроченных голосов
const cleanupExpiredVotes = async () => {
  const now = new Date();
  await DoomsdayVote.destroy({
    where: {
      expiresAt: { [Op.lt]: now },
      isConfirmed: false,
    },
  });
};

// --- ФУНКЦИЯ УНИЧТОЖЕНИЯ ВСЕЙ БАЗЫ ЗНАНИЙ ---
const destroyEverything = async () => {
  try {
    console.log('💀 ЗАПУЩЕН ПРОТОКОЛ СУДНОГО ДНЯ!');

    const dialect = process.env.DB_DIALECT || 'sqlite';

    if (dialect === 'postgres') {
      // PostgreSQL: используем TRUNCATE CASCADE
      await sequelize.query('TRUNCATE TABLE "SharedLinks", "Articles", "DoomsdayVotes" RESTART IDENTITY CASCADE');
      console.log('💀 PostgreSQL: таблицы очищены через TRUNCATE CASCADE');
    } else {
      // SQLite: отключаем foreign keys и удаляем
      await sequelize.query('PRAGMA foreign_keys = OFF');
      await sequelize.query('DELETE FROM SharedLinks');
      await sequelize.query('DELETE FROM Articles');
      await sequelize.query('DELETE FROM DoomsdayVotes');
      try {
        await sequelize.query("DELETE FROM sqlite_sequence WHERE name IN ('Articles', 'SharedLinks', 'DoomsdayVotes')");
      } catch (e) {}
      await sequelize.query('PRAGMA foreign_keys = ON');
      console.log('💀 SQLite: таблицы очищены');
    }

    // Удаляем картинки
    const uploadsDir = path.join(__dirname, '../../uploads');
    console.log(`💀 Папка uploads: ${uploadsDir}`);
    
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      let deletedFiles = 0;
      let errors = 0;
      
      for (const file of files) {
        const filePath = path.join(uploadsDir, file);
        try {
          if (fs.statSync(filePath).isDirectory()) continue;
          fs.unlinkSync(filePath);
          deletedFiles++;
        } catch (err) {
          console.error(`Ошибка удаления ${file}:`, err.message);
          errors++;
        }
      }
      console.log(`💀 Удалено файлов: ${deletedFiles} (ошибок: ${errors})`);
    }

    console.log('💀 СУДНЫЙ ДЕНЬ ЗАВЕРШЁН. База знаний уничтожена.');
    return true;
  } catch (error) {
    console.error('❌ Ошибка уничтожения:', error);
    console.error('❌ Стек:', error.stack);
    return false;
  }
};

// Получить текущий статус голосования
router.get('/status', requireAuth, async (req, res) => {
  try {
    await cleanupExpiredVotes();

    const votes = await DoomsdayVote.findAll({
      order: [['createdAt', 'ASC']],
    });

    let timeLeft = null;
    if (votes.length > 0 && !votes[0].isConfirmed) {
      const expiresAt = new Date(votes[0].expiresAt);
      const now = new Date();
      timeLeft = Math.max(0, Math.floor((expiresAt - now) / 1000));
    }

    res.json({
      votes: votes.map(v => ({
        userId: v.userId,
        username: v.username,
        isConfirmed: v.isConfirmed,
        createdAt: v.createdAt,
      })),
      totalVotes: votes.length,
      requiredVotes: 2,
      timeLeft,
      userHasVoted: votes.some(v => v.userId === req.user.id),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Первый админ нажимает кнопку
router.post('/press', requireAuth, async (req, res) => {
  try {
    await cleanupExpiredVotes();

    const existingVote = await DoomsdayVote.findOne({
      where: { userId: req.user.id },
    });

    if (existingVote) {
      return res.status(400).json({ 
        error: 'Вы уже проголосовали. Дождитесь второго администратора.' 
      });
    }

    const votes = await DoomsdayVote.findAll();
    
    if (votes.length >= 2) {
      return res.status(400).json({ error: 'Уже достаточно голосов' });
    }

    const expiresAt = new Date(Date.now() + CONFIRMATION_WINDOW_SECONDS * 1000);

    const vote = await DoomsdayVote.create({
      userId: req.user.id,
      username: req.user.fullName || req.user.username,
      isConfirmed: false,
      expiresAt,
    });

    await logAction({
      user: req.user,
      action: 'doomsday.press',
      entityType: 'system',
      entityTitle: 'Нажатие кнопки Судного дня',
      req,
    });

    res.status(201).json({
      vote: {
        userId: vote.userId,
        username: vote.username,
        createdAt: vote.createdAt,
      },
      totalVotes: votes.length + 1,
      requiredVotes: 2,
      timeLeft: CONFIRMATION_WINDOW_SECONDS,
    });
  } catch (error) {
    console.error('Ошибка press:', error);
    res.status(500).json({ error: error.message });
  }
});

// Второй админ подтверждает
router.post('/confirm', requireAuth, async (req, res) => {
  try {
    await cleanupExpiredVotes();

    const existingVote = await DoomsdayVote.findOne({
      where: { userId: req.user.id },
    });

    if (existingVote) {
      return res.status(400).json({ 
        error: 'Вы уже проголосовали. Нужен голос второго администратора.' 
      });
    }

    const votes = await DoomsdayVote.findAll();

    if (votes.length === 0) {
      return res.status(400).json({ 
        error: 'Нет активного голосования. Первый администратор должен нажать кнопку.' 
      });
    }

    if (votes.length >= 2) {
      return res.status(400).json({ error: 'Голосование уже завершено' });
    }

    const firstVote = votes[0];
    if (new Date() > new Date(firstVote.expiresAt)) {
      await cleanupExpiredVotes();
      return res.status(400).json({ 
        error: 'Время ожидания истекло. Начните заново.' 
      });
    }

    const expiresAt = new Date(Date.now() + 5000);
    await DoomsdayVote.create({
      userId: req.user.id,
      username: req.user.fullName || req.user.username,
      isConfirmed: true,
      expiresAt,
    });

    await logAction({
      user: req.user,
      action: 'doomsday.confirm',
      entityType: 'system',
      entityTitle: 'ПОДТВЕРЖДЕНИЕ СУДНОГО ДНЯ',
      details: { 
        triggeredBy: req.user.username,
        timestamp: new Date().toISOString(),
      },
      req,
    });

    const success = await destroyEverything();

    if (success) {
      res.json({
        message: 'Судный день свершился. База знаний уничтожена.',
        destroyed: true,
      });
    } else {
      res.status(500).json({ error: 'Ошибка уничтожения базы' });
    }
  } catch (error) {
    console.error('Ошибка confirm:', error);
    res.status(500).json({ error: error.message });
  }
});

// Отмена своего голоса
router.post('/cancel', requireAuth, async (req, res) => {
  try {
    const vote = await DoomsdayVote.findOne({
      where: { userId: req.user.id },
    });

    if (!vote) {
      return res.status(404).json({ error: 'Ваш голос не найден' });
    }

    await vote.destroy();
    res.json({ message: 'Голос отменён' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
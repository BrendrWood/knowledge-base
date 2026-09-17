const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const SharedLink = require('../models/SharedLink');
const Article = require('../models/Article');
const { requireAuth } = require('../middleware/auth');
const { logAction } = require('../utils/audit');

const generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateSlug = () => {
  return uuidv4().substring(0, 8);
};

// Создать ссылку (только для админов)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { articleId, mode = 'web', isPermanent = false, expiresAt } = req.body;

    if (!articleId) {
      return res.status(400).json({ error: 'articleId обязателен' });
    }

    const article = await Article.findByPk(articleId);
    if (!article) {
      return res.status(404).json({ error: 'Статья не найдена' });
    }

    const slug = generateSlug();
    const code = generateCode();

    let finalExpiresAt = null;
    if (!isPermanent) {
      if (expiresAt) {
        const parsedDate = new Date(expiresAt);
        if (isNaN(parsedDate.getTime())) {
          return res.status(400).json({ error: 'Неверный формат даты' });
        }
        
        if (parsedDate < new Date()) {
          return res.status(400).json({ error: 'Дата не может быть в прошлом' });
        }
        
        const maxDate = new Date();
        maxDate.setDate(maxDate.getDate() + 7);
        if (parsedDate > maxDate) {
          return res.status(400).json({ error: 'Максимальный срок — 7 дней' });
        }
        
        finalExpiresAt = parsedDate;
      } else {
        finalExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }
    }

    const sharedLink = await SharedLink.create({
      articleId,
      slug,
      code,
      mode,
      isPermanent,
      expiresAt: finalExpiresAt,
      isActive: true,
    });

    const baseUrl = process.env.BASE_URL || 'http://localhost:5173';
    const link = `${baseUrl}/share/${slug}`;

    await logAction({
      user: req.user,
      action: 'link.create',
      entityType: 'link',
      entityId: sharedLink.id,
      entityTitle: article.title,
      details: {
        mode,
        isPermanent,
        expiresAt: finalExpiresAt,
        code,
      },
      req,
    });

    res.status(201).json({
      id: sharedLink.id,
      link,
      code,
      mode,
      isPermanent,
      expiresAt: finalExpiresAt,
      article: {
        id: article.id,
        title: article.title,
      },
    });
  } catch (error) {
    console.error('Ошибка создания ссылки:', error);
    res.status(500).json({ error: error.message });
  }
});

// Получить все ссылки для статьи
router.get('/article/:articleId', requireAuth, async (req, res) => {
  try {
    const { articleId } = req.params;
    const links = await SharedLink.findAll({
      where: { articleId },
      order: [['createdAt', 'DESC']],
      include: [{
        model: Article,
        as: 'article',
        attributes: ['id', 'title'],
      }],
    });
    res.json(links);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ссылки, истекающие в течение N часов
router.get('/expiring/soon', requireAuth, async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    
    const now = new Date();
    const future = new Date();
    future.setHours(future.getHours() + hours);

    const links = await SharedLink.findAll({
      where: {
        isActive: true,
        isPermanent: false,
        expiresAt: {
          [Op.gt]: now,
          [Op.lte]: future,
        },
      },
      include: [{
        model: Article,
        as: 'article',
        attributes: ['id', 'title'],
      }],
      order: [['expiresAt', 'ASC']],
    });

    res.json(links);
  } catch (error) {
    console.error('Ошибка получения истекающих ссылок:', error);
    res.status(500).json({ error: error.message });
  }
});

// Проверить ссылку по slug и коду (ПУБЛИЧНЫЙ)
router.post('/verify', async (req, res) => {
  try {
    const { slug, code } = req.body;

    if (!slug || !code) {
      return res.status(400).json({ error: 'slug и code обязательны' });
    }

    const sharedLink = await SharedLink.findOne({
      where: { slug },
      include: [{
        model: Article,
        as: 'article',
      }],
    });

    if (!sharedLink) {
      return res.status(404).json({ error: 'Ссылка не найдена' });
    }

    if (sharedLink.code !== code) {
      return res.status(401).json({ error: 'Неверный код доступа' });
    }

    if (!sharedLink.isActive) {
      return res.status(403).json({ error: 'Ссылка деактивирована' });
    }

    if (!sharedLink.isPermanent && sharedLink.expiresAt) {
      const now = new Date();
      if (now > sharedLink.expiresAt) {
        await sharedLink.update({ isActive: false });
        return res.status(410).json({ error: 'Срок действия ссылки истёк' });
      }
    }

    await sharedLink.increment('views');

    res.json({
      article: sharedLink.article,
      mode: sharedLink.mode,
      expiresAt: sharedLink.expiresAt,
      isPermanent: sharedLink.isPermanent,
    });
  } catch (error) {
    console.error('Ошибка проверки:', error);
    res.status(500).json({ error: error.message });
  }
});

// Деактивировать ссылку
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const sharedLink = await SharedLink.findByPk(id);
    
    if (!sharedLink) {
      return res.status(404).json({ error: 'Ссылка не найдена' });
    }

    await sharedLink.update({ isActive: false });

    await logAction({
      user: req.user,
      action: 'link.deactivate',
      entityType: 'link',
      entityId: sharedLink.id,
      entityTitle: sharedLink.slug,
      details: { code: sharedLink.code },
      req,
    });

    res.json({ message: 'Ссылка деактивирована' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Получить информацию о ссылке по slug (ПУБЛИЧНЫЙ)
router.get('/:slug/info', async (req, res) => {
  try {
    const { slug } = req.params;
    const sharedLink = await SharedLink.findOne({
      where: { slug },
      include: [{
        model: Article,
        as: 'article',
        attributes: ['id', 'title'],
      }],
    });

    if (!sharedLink) {
      return res.status(404).json({ error: 'Ссылка не найдена' });
    }

    res.json({
      id: sharedLink.id,
      mode: sharedLink.mode,
      isPermanent: sharedLink.isPermanent,
      expiresAt: sharedLink.expiresAt,
      isActive: sharedLink.isActive,
      article: sharedLink.article,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
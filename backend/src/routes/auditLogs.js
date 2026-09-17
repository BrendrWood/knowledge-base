const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const AuditLog = require('../models/AuditLog');
const { requireAuth } = require('../middleware/auth');

// Получить логи с фильтрами и пагинацией
router.get('/', requireAuth, async (req, res) => {
  try {
    const {
      userId,
      action,
      entityType,
      entityId,
      from,
      to,
      page = 1,
      limit = 50,
    } = req.query;

    const where = {};

    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt[Op.gte] = new Date(from);
      if (to) where.createdAt[Op.lte] = new Date(to);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    res.json({
      logs: rows.map(log => ({
        id: log.id,
        userId: log.userId,
        username: log.username,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        entityTitle: log.entityTitle,
        details: log.details ? JSON.parse(log.details) : null,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt,
      })),
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Ошибка получения логов:', error);
    res.status(500).json({ error: error.message });
  }
});

// Получить логи для конкретной статьи
router.get('/article/:articleId', requireAuth, async (req, res) => {
  try {
    const logs = await AuditLog.findAll({
      where: {
        entityType: 'article',
        entityId: req.params.articleId,
      },
      order: [['createdAt', 'DESC']],
      limit: 100,
    });

    res.json(logs.map(log => ({
      id: log.id,
      username: log.username,
      action: log.action,
      entityTitle: log.entityTitle,
      details: log.details ? JSON.parse(log.details) : null,
      createdAt: log.createdAt,
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Получить список уникальных пользователей (для фильтра)
router.get('/users', requireAuth, async (req, res) => {
  try {
    const logs = await AuditLog.findAll({
      attributes: ['userId', 'username'],
      group: ['userId', 'username'],
      where: { userId: { [Op.ne]: null } },
    });

    res.json(logs.map(l => ({ userId: l.userId, username: l.username })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
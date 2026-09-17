const express = require('express');
const router = express.Router();
const { Op, fn, col } = require('sequelize');
const Article = require('../models/Article');
const SharedLink = require('../models/SharedLink');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

// Получить всю статистику
router.get('/', requireAuth, async (req, res) => {
  try {
    const now = new Date();

    // 1. Всего статей
    const totalArticles = await Article.count();

    // 2. Всего пользователей
    const totalUsers = await User.count();

    // 3. Всего ссылок
    const totalLinks = await SharedLink.count();

    // 4. Активные ссылки (isActive: true и (постоянные ИЛИ ещё не истекли))
    const activeLinks = await SharedLink.count({
      where: {
        isActive: true,
        [Op.or]: [
          { isPermanent: true },
          { expiresAt: { [Op.gt]: now } },
        ],
      },
    });

    // 5. Истёкшие ссылки (isActive: false ИЛИ expiresAt < now)
    const expiredLinks = await SharedLink.count({
      where: {
        [Op.or]: [
          { isActive: false },
          {
            isPermanent: false,
            expiresAt: { [Op.lt]: now },
          },
        ],
      },
    });

    // 6. Общее количество просмотров
    const totalViewsResult = await SharedLink.sum('views');
    const totalViews = totalViewsResult || 0;

    // 7. Топ-10 популярных статей по просмотрам
    const topArticlesRaw = await SharedLink.findAll({
      attributes: [
        'articleId',
        [fn('SUM', col('views')), 'totalViews'],
        [fn('COUNT', col('SharedLink.id')), 'linksCount'],
      ],
      include: [{
        model: Article,
        as: 'article',
        attributes: ['id', 'title'],
      }],
      group: ['articleId', 'article.id', 'article.title'],
      order: [[fn('SUM', col('views')), 'DESC']],
      limit: 10,
    });

    const topArticles = topArticlesRaw.map(item => ({
      articleId: item.articleId,
      title: item.article?.title || 'Без названия',
      totalViews: parseInt(item.get('totalViews')) || 0,
      linksCount: parseInt(item.get('linksCount')) || 0,
    }));

    // 8. Активные ссылки — детальный список
    const activeLinksList = await SharedLink.findAll({
      where: {
        isActive: true,
        [Op.or]: [
          { isPermanent: true },
          { expiresAt: { [Op.gt]: now } },
        ],
      },
      include: [{
        model: Article,
        as: 'article',
        attributes: ['id', 'title'],
      }],
      order: [['views', 'DESC']],
      limit: 20,
    });

    // 9. Последние истёкшие ссылки (за последние 30 дней)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentlyExpired = await SharedLink.findAll({
      where: {
        isPermanent: false,
        expiresAt: {
          [Op.lt]: now,
          [Op.gt]: thirtyDaysAgo,
        },
      },
      include: [{
        model: Article,
        as: 'article',
        attributes: ['id', 'title'],
      }],
      order: [['expiresAt', 'DESC']],
      limit: 20,
    });

    res.json({
      summary: {
        totalArticles,
        totalUsers,
        totalLinks,
        activeLinks,
        expiredLinks,
        totalViews,
      },
      topArticles,
      activeLinksList: activeLinksList.map(link => ({
        id: link.id,
        articleId: link.articleId,
        articleTitle: link.article?.title || 'Без названия',
        code: link.code,
        mode: link.mode,
        isPermanent: link.isPermanent,
        expiresAt: link.expiresAt,
        views: link.views,
      })),
      recentlyExpired: recentlyExpired.map(link => ({
        id: link.id,
        articleId: link.articleId,
        articleTitle: link.article?.title || 'Без названия',
        mode: link.mode,
        expiresAt: link.expiresAt,
        views: link.views,
      })),
    });
  } catch (error) {
    console.error('Ошибка получения статистики:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
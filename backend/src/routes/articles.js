const express = require('express');
const router = express.Router();
const Article = require('../models/Article');
const SharedLink = require('../models/SharedLink');
const { Op } = require('sequelize');
const { logAction } = require('../utils/audit');

// Вспомогательная функция: строит дерево из плоского списка
function buildTree(items, parentId = null) {
  const children = items.filter(item => item.parentId === parentId);
  
  if (children.length === 0) return [];
  
  return children.map(child => ({
    ...child.toJSON ? child.toJSON() : child,
    children: buildTree(items, child.id)
  }));
}

// Получить все уникальные теги
router.get('/tags/all', async (req, res) => {
  try {
    const articles = await Article.findAll({
      attributes: ['tags'],
    });

    const tagSet = new Set();
    articles.forEach(article => {
      if (Array.isArray(article.tags)) {
        article.tags.forEach(tag => {
          if (tag && typeof tag === 'string') {
            tagSet.add(tag.trim());
          }
        });
      }
    });

    const tags = Array.from(tagSet).sort((a, b) => a.localeCompare(b, 'ru'));
    res.json(tags);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Получить все статьи (в виде дерева)
router.get('/', async (req, res) => {
  try {
    const articles = await Article.findAll({
      order: [
        ['parentId', 'ASC'],
        ['order', 'ASC'],
        ['createdAt', 'ASC']
      ]
    });

    const tree = buildTree(articles, null);
    res.json(tree);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Создать статью
router.post('/', async (req, res) => {
  try {
    const { title, content_web, content_mobile, parentId, isPublished, tags } = req.body;
    const article = await Article.create({
      title,
      content_web,
      content_mobile,
      parentId: parentId || null,
      isPublished: isPublished || false,
      tags: Array.isArray(tags) ? tags : [],
    });

    await logAction({
      user: req.user,
      action: 'article.create',
      entityType: 'article',
      entityId: article.id,
      entityTitle: article.title,
      details: { parentId: article.parentId, tags: article.tags },
      req,
    });

    res.status(201).json(article);
  } catch (error) {
    console.error('❌ Ошибка создания статьи:', error);
    res.status(500).json({ 
      error: error.message,
      name: error.name,
    });
  }
});

// Получить одну статью
router.get('/:id', async (req, res) => {
  try {
    const article = await Article.findByPk(req.params.id);
    if (!article) {
      return res.status(404).json({ error: 'Статья не найдена' });
    }
    res.json(article);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Получить статистику статьи (для подтверждения удаления)
router.get('/:id/stats', async (req, res) => {
  try {
    const articleId = req.params.id;

    const article = await Article.findByPk(articleId);
    if (!article) {
      return res.status(404).json({ error: 'Статья не найдена' });
    }

    const getAllChildIds = async (parentId) => {
      const children = await Article.findAll({
        where: { parentId },
        attributes: ['id'],
      });
      
      let allIds = children.map(c => c.id);
      
      for (const child of children) {
        const grandChildIds = await getAllChildIds(child.id);
        allIds = allIds.concat(grandChildIds);
      }
      
      return allIds;
    };

    const childIds = await getAllChildIds(articleId);
    const allIds = [articleId, ...childIds];

    const linksCount = await SharedLink.count({
      where: { articleId: allIds },
    });

    res.json({
      articleTitle: article.title,
      totalArticles: allIds.length,
      childArticles: childIds.length,
      linksCount: linksCount,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Обновить статью
router.put('/:id', async (req, res) => {
  try {
    const article = await Article.findByPk(req.params.id);
    if (!article) {
      return res.status(404).json({ error: 'Статья не найдена' });
    }

    const { title, content_web, content_mobile, parentId, isPublished, order, tags } = req.body;

    const oldValues = {
      title: article.title,
      parentId: article.parentId,
      isPublished: article.isPublished,
      tags: article.tags,
    };

    await article.update({
      title: title || article.title,
      content_web: content_web || article.content_web,
      content_mobile: content_mobile || article.content_mobile,
      parentId: parentId !== undefined ? parentId : article.parentId,
      order: order !== undefined ? order : article.order,
      isPublished: isPublished !== undefined ? isPublished : article.isPublished,
      tags: tags !== undefined ? (Array.isArray(tags) ? tags : []) : article.tags,
    });

    const changes = {};
    if (title !== undefined && title !== oldValues.title) {
      changes.title = { from: oldValues.title, to: title };
    }
    if (parentId !== undefined && parentId !== oldValues.parentId) {
      changes.parentId = { from: oldValues.parentId, to: parentId };
    }
    if (isPublished !== undefined && isPublished !== oldValues.isPublished) {
      changes.isPublished = { from: oldValues.isPublished, to: isPublished };
    }
    if (content_web !== undefined) changes.contentWebChanged = true;
    if (content_mobile !== undefined) changes.contentMobileChanged = true;
    if (tags !== undefined) {
      const oldTags = Array.isArray(oldValues.tags) ? oldValues.tags : [];
      const newTags = Array.isArray(tags) ? tags : [];
      const tagsChanged = JSON.stringify([...oldTags].sort()) !== JSON.stringify([...newTags].sort());
      if (tagsChanged) {
        changes.tags = { from: oldTags, to: newTags };
      }
    }

    if (Object.keys(changes).length > 0) {
      await logAction({
        user: req.user,
        action: 'article.update',
        entityType: 'article',
        entityId: article.id,
        entityTitle: article.title,
        details: changes,
        req,
      });
    }

    res.json(article);
  } catch (error) {
    console.error('❌ Ошибка обновления статьи:', error);
    res.status(500).json({ error: error.message });
  }
});

// Удалить статью (и все вложенные, и связанные ссылки)
router.delete('/:id', async (req, res) => {
  try {
    const articleId = req.params.id;

    const article = await Article.findByPk(articleId);
    if (!article) {
      return res.status(404).json({ error: 'Статья не найдена' });
    }

    const articleTitle = article.title;

    const getAllChildIds = async (parentId) => {
      const children = await Article.findAll({
        where: { parentId },
        attributes: ['id'],
      });
      
      let allIds = children.map(c => c.id);
      
      for (const child of children) {
        const grandChildIds = await getAllChildIds(child.id);
        allIds = allIds.concat(grandChildIds);
      }
      
      return allIds;
    };

    const childIds = await getAllChildIds(articleId);
    const allIds = [articleId, ...childIds];

    const deletedLinks = await SharedLink.destroy({
      where: { articleId: allIds },
    });

    await logAction({
      user: req.user,
      action: 'article.delete',
      entityType: 'article',
      entityId: articleId,
      entityTitle: articleTitle,
      details: { 
        deletedChildArticles: childIds.length,
        deletedLinks: deletedLinks,
      },
      req,
    });

    if (childIds.length > 0) {
      await Article.destroy({
        where: { id: childIds },
      });
    }

    await Article.destroy({
      where: { id: articleId },
    });

    res.json({ 
      message: 'Статья и все вложенные удалены',
      deletedArticles: allIds.length,
      deletedLinks: deletedLinks,
    });
  } catch (error) {
    console.error('❌ Ошибка удаления:', error);
    res.status(500).json({ 
      error: 'Ошибка удаления статьи',
      details: error.message,
    });
  }
});

module.exports = router;
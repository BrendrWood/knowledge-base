const { Op } = require('sequelize');
const SharedLink = require('../models/SharedLink');

const cleanupExpiredLinks = async () => {
  try {
    const now = new Date();
    
    // Находим все истёкшие временные ссылки
    const expiredLinks = await SharedLink.findAll({
      where: {
        isPermanent: false,
        expiresAt: {
          [Op.lt]: now,
        },
        isActive: true,
      },
    });

    // Деактивируем их
    for (const link of expiredLinks) {
      await link.update({ isActive: false });
      console.log(`🗑️ Деактивирована ссылка: ${link.slug}`);
    }

    // (Опционально) Удаляем старые неактивные ссылки старше 30 дней
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const oldLinks = await SharedLink.findAll({
      where: {
        isActive: false,
        updatedAt: {
          [Op.lt]: thirtyDaysAgo,
        },
      },
    });

    for (const link of oldLinks) {
      await link.destroy();
      console.log(`💀 Удалена старая ссылка: ${link.slug}`);
    }

    return { expired: expiredLinks.length, deleted: oldLinks.length };
  } catch (error) {
    console.error('Ошибка очистки ссылок:', error);
    return { error: error.message };
  }
};

module.exports = cleanupExpiredLinks;
const AuditLog = require('../models/AuditLog');

/**
 * Записать событие в audit log
 * @param {Object} options
 * @param {Object} options.user - req.user (может быть null)
 * @param {string} options.action - тип действия ('article.create', 'user.login', и т.п.)
 * @param {string} options.entityType - 'article', 'link', 'user', 'system'
 * @param {string} options.entityId - ID объекта
 * @param {string} options.entityTitle - название объекта (для отображения)
 * @param {Object} options.details - дополнительные данные (будут сохранены как JSON)
 * @param {Object} options.req - Express request (для IP)
 */
const logAction = async ({ user, action, entityType, entityId, entityTitle, details, req }) => {
  try {
    const ipAddress = req 
      ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
      : null;

    await AuditLog.create({
      userId: user?.id || null,
      username: user?.fullName || user?.username || 'Система',
      action,
      entityType: entityType || null,
      entityId: entityId || null,
      entityTitle: entityTitle || null,
      details: details ? JSON.stringify(details) : null,
      ipAddress,
    });
  } catch (error) {
    // Логирование не должно ломать основную операцию
    console.error('Ошибка записи в audit log:', error);
  }
};

module.exports = { logAction };
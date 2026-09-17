const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true, // null для системных событий
  },
  username: {
    type: DataTypes.STRING,
    allowNull: true, // на момент действия
  },
  action: {
    type: DataTypes.STRING, // 'article.create', 'article.update', 'article.delete', 'link.create', 'link.deactivate', 'user.login', 'user.logout', 'user.create', 'user.delete', 'doomsday.press', 'doomsday.confirm'
    allowNull: false,
  },
  entityType: {
    type: DataTypes.STRING, // 'article', 'link', 'user', 'system'
    allowNull: true,
  },
  entityId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  entityTitle: {
    type: DataTypes.STRING,
    allowNull: true, // для быстрого отображения (название статьи и т.п.)
  },
  details: {
    type: DataTypes.TEXT, // JSON с деталями изменений
    allowNull: true,
  },
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  updatedAt: false, // логи не обновляются
});

module.exports = AuditLog;
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Article = require('./Article');

const SharedLink = sequelize.define('SharedLink', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  articleId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Articles',
      key: 'id',
    },
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  code: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  mode: {
    type: DataTypes.ENUM('web', 'mobile'),
    allowNull: false,
    defaultValue: 'web',
  },
  isPermanent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  views: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
});

// Связь: SharedLink принадлежит Article
SharedLink.belongsTo(Article, {
  foreignKey: 'articleId',
  as: 'article',
});

module.exports = SharedLink;
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Article = sequelize.define('Article', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  content_web: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: '<p>Веб-версия статьи</p>',
  },
  content_mobile: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: '<p>Мобильная версия статьи</p>',
  },
  parentId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Articles',
      key: 'id',
    },
  },
  order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  tags: {
    type: DataTypes.JSON,
    defaultValue: [],
    allowNull: false,
  },
  isPublished: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
});

module.exports = Article;
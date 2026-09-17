const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const DoomsdayVote = sequelize.define('DoomsdayVote', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  isConfirmed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
});

DoomsdayVote.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = DoomsdayVote;
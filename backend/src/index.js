require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const sequelize = require('./config/database');
const Article = require('./models/Article');
const SharedLink = require('./models/SharedLink');
const User = require('./models/User');
const DoomsdayVote = require('./models/DoomsdayVote');
const AuditLog = require('./models/AuditLog');
const articlesRouter = require('./routes/articles');
const uploadRouter = require('./routes/upload');
const sharedLinksRouter = require('./routes/sharedLinks');
const authRouter = require('./routes/auth');
const doomsdayRouter = require('./routes/doomsday');
const statsRouter = require('./routes/stats');
const auditLogsRouter = require('./routes/auditLogs');
const cleanupExpiredLinks = require('./jobs/cleanup');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Публичные маршруты
app.use('/api/auth', authRouter);
app.use('/api/shared-links', sharedLinksRouter);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Защищённые маршруты
app.use('/api/articles', requireAuth, articlesRouter);
app.use('/api/upload', requireAuth, uploadRouter);
app.use('/api/doomsday', doomsdayRouter);
app.use('/api/stats', requireAuth, statsRouter);
app.use('/api/audit-logs', requireAuth, auditLogsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Сервер работает!' });
});

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('🟢 База данных подключена!');
    
    await sequelize.sync({ force: false });
    console.log('✅ Таблицы синхронизированы!');
    
    app.listen(PORT, () => {
      console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    });

    try {
      const result = await cleanupExpiredLinks();
      console.log(`🧹 Очистка: ${result.expired} деактивировано`);
    } catch (error) {
      console.error('❌ Ошибка очистки:', error);
    }

    setInterval(async () => {
      try {
        await cleanupExpiredLinks();
      } catch (error) {
        console.error('❌ Ошибка очистки:', error);
      }
    }, 60 * 60 * 1000);

  } catch (error) {
    console.error('❌ Ошибка запуска сервера:', error);
    process.exit(1);
  }
};

startServer();
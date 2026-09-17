const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Настройка хранилища
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = uuidv4() + ext;
    cb(null, uniqueName);
  },
});

// Фильтр файлов (только изображения)
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Только изображения (jpg, png, gif, webp) разрешены'));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: fileFilter,
});

// Эндпоинт для загрузки
router.post('/', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }
    
    // Возвращаем URL для доступа к файлу
    const imageUrl = `http://localhost:${process.env.PORT || 5000}/uploads/${req.file.filename}`;
    res.json({ location: imageUrl });
  } catch (error) {
    console.error('Ошибка загрузки:', error);
    res.status(500).json({ error: 'Ошибка загрузки файла' });
  }
});

module.exports = router;
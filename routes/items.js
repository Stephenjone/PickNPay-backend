// routes/items.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const Item = require('../models/Items');

const router = express.Router();

const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mime = allowedTypes.test(file.mimetype);
    if (ext && mime) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif)'));
    }
  },
});


router.get('/', async (req, res) => {
  try {
    const items = await Item.find().sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    console.error('❌ Error fetching items:', err);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});


router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { name, price, category } = req.body;

    console.log('📦 New Item Request:', { name, price, category });
    console.log('🖼️ Uploaded File:', req.file);

    
    if (!name || !price || !category) {
      return res.status(400).json({ error: 'Name, price, and category are required' });
    }

    
    const allowedCategories = ['Juice', 'Noodles', 'Maggie','Fruit Bowl', 'Egg','Sandwich','Shakes'];
    if (!allowedCategories.includes(category)) {
      return res.status(400).json({ error: `Category must be one of: ${allowedCategories.join(', ')}` });
    }

    
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ error: 'Price must be a positive number' });
    }

    
    const image = req.file ? req.file.filename : '';

    const newItem = new Item({
      name,
      price: parsedPrice,
      image,
      category,
    });

    await newItem.save();

    res.json({ message: 'Item added successfully' });
  } catch (err) {
    console.error('❌ Error adding item:', err);

   
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Image size should not exceed 5MB' });
      }
    }
    if (err.message && err.message.includes('Only image files are allowed')) {
      return res.status(400).json({ error: err.message });
    }

    res.status(500).json({ error: err.message || 'Failed to add item' });
  }
});


router.delete('/:id', async (req, res) => {
  try {
    await Item.findByIdAndDelete(req.params.id);
    res.json({ message: 'Item deleted' });
  } catch (err) {
    console.error('❌ Error deleting item:', err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

module.exports = router;

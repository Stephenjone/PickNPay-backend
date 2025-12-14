const express = require("express");
const multer = require("multer");
const path = require("path");
const Item = require("../models/Items");

const router = express.Router();

// Multer config
const storage = multer.diskStorage({
  destination: "./uploads/",
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error("Only JPG, JPEG, PNG or GIF allowed"));
  },
});

// GET /api/items?search=term
router.get("/", async (req, res) => {
  try {
    const search = req.query.search?.trim();

    const query = search
      ? { name: { $regex: search, $options: "i" } }
      : {};

    const items = await Item.find(query).sort({ createdAt: -1 });

    res.json({ items });
  } catch (err) {
    console.error("Fetch error:", err);
    res.status(500).json({ error: "Failed to fetch items" });
  }
});

// POST /api/items
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const { name, price, category } = req.body;

    if (!name || !price || !category)
      return res.status(400).json({ error: "All fields are required" });

    // Ensure the allowed categories list matches the one in Navbar.js/Items.js model
    const allowedCategories = [
      "Sandwich",
      "Fruits",
      "Egg",
      "Noodles",
      "Maggie",
      "Juice",
      "Milk shake",
      "Fruit Bowl",
    ];

    if (!allowedCategories.includes(category))
      return res.status(400).json({
        error: "Invalid category. Must be: " + allowedCategories.join(", "),
      });

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 1)
      return res.status(400).json({ error: "Price must be positive" });

    const image = req.file ? req.file.filename : "";

    const newItem = new Item({ name, price: parsedPrice, category, image });
    await newItem.save();

    // 💡 REAL-TIME FIX: Return the newly created item
    res.status(201).json({ message: "Item added successfully", item: newItem });
  } catch (err) {
    console.error("Add item error:", err);

    if (err instanceof multer.MulterError)
      return res.status(400).json({ error: err.message });

    res.status(500).json({ error: "Failed to add item" });
  }
});

// DELETE /api/items/:id
router.delete("/:id", async (req, res) => {
  try {
    await Item.findByIdAndDelete(req.params.id);
    res.json({ message: "Item deleted" });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: "Failed to delete item" });
  }
});

module.exports = router;
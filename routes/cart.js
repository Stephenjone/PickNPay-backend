const express = require('express');
const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Item = require('../models/Items');

const router = express.Router();

/* ===============================
   GET CART ITEMS BY EMAIL
=============================== */
router.get('/:email', async (req, res) => {
  try {
    const email = req.params.email;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const cart = await Cart.findOne({ email }).populate('items.item');
    if (!cart) return res.json({ items: [] });

    const cartItems = cart.items
      .filter(entry => entry.item) // Remove nulls
      .map(entry => ({
        _id: entry.item._id,
        name: entry.item.name,
        price: entry.item.price,
        image: entry.item.image,
        quantity: entry.quantity,
      }));

    res.json({ items: cartItems });
  } catch (err) {
    console.error('❌ Failed to fetch cart:', err);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

/* ===============================
   ADD ITEM TO CART
=============================== */
router.post('/', async (req, res) => {
  const { email, itemId } = req.body;

  if (!email || !itemId)
    return res.status(400).json({ error: 'Email and itemId are required' });

  if (!mongoose.Types.ObjectId.isValid(itemId))
    return res.status(400).json({ error: 'Invalid item ID format' });

  try {
    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    let cart = await Cart.findOne({ email });
    if (!cart) cart = new Cart({ email, items: [] });

    // Remove null items
    cart.items = cart.items.filter(i => i.item != null);

    const existingItem = cart.items.find(i => i.item.toString() === itemId);
    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      cart.items.push({ item: itemId, quantity: 1 });
    }

    await cart.save();

    // Optionally emit socket event here if needed
    // const io = req.app.get('io');
    // io.to(email).emit('cartUpdated', cart);

    res.json({ message: 'Item added to cart successfully' });
  } catch (err) {
    console.error('❌ Error adding item to cart:', err);
    res.status(500).json({ error: 'Failed to add item to cart' });
  }
});

/* ===============================
   UPDATE ITEM QUANTITY IN CART
=============================== */
router.put('/update', async (req, res) => {
  const { email, itemId, quantity } = req.body;

  if (!email || !itemId)
    return res.status(400).json({ error: 'Email and itemId are required' });

  if (!mongoose.Types.ObjectId.isValid(itemId))
    return res.status(400).json({ error: 'Invalid item ID format' });

  if (quantity == null || quantity < 0)
    return res.status(400).json({ error: 'Quantity must be zero or positive' });

  try {
    const cart = await Cart.findOne({ email });
    if (!cart) return res.status(404).json({ error: 'Cart not found' });

    cart.items = cart.items.filter(i => i.item != null);

    const index = cart.items.findIndex(i => i.item.toString() === itemId);
    if (index === -1) return res.status(404).json({ error: 'Item not found in cart' });

    if (quantity === 0) {
      cart.items.splice(index, 1);
    } else {
      cart.items[index].quantity = quantity;
    }

    await cart.save();

    // Optionally emit socket event
    // const io = req.app.get('io');
    // io.to(email).emit('cartUpdated', cart);

    res.json({ message: 'Cart updated successfully' });
  } catch (err) {
    console.error('❌ Error updating cart:', err);
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

/* ===============================
   CLEAR CART BY EMAIL
=============================== */
router.delete('/:email', async (req, res) => {
  const email = req.params.email;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const result = await Cart.findOneAndDelete({ email });
    if (!result) return res.status(404).json({ message: 'Cart already empty or not found' });

    // Optionally emit socket event
    // const io = req.app.get('io');
    // io.to(email).emit('cartCleared');

    res.json({ message: 'Cart cleared successfully' });
  } catch (err) {
    console.error('❌ Error clearing cart:', err);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

module.exports = router;

import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getDb } from './db.js';

const router = express.Router();
const JWT_SECRET = 'REPLACE_WITH_A_STRONG_SECRET'; // Change this in production

// Register new user
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const db = await getDb();
  try {
    const hashed = await bcrypt.hash(password, 10);
    await db.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, hashed]);
    res.status(201).json({ message: 'User registered' });
  } catch (err) {
    res.status(400).json({ error: 'Username already exists' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const db = await getDb();
  try {
    // Use utilizadores table, email as username, password as hash
    const result = await db.query('SELECT * FROM utilizadores WHERE email = $1', [username]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, username: user.email }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Endpoint to get user creation date and available hours
router.get('/user-available-hours', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  const db = await getDb();
  try {
    const result = await db.query('SELECT created_at FROM utilizadores WHERE user_id = $1', [user_id]);
    const user = result.rows[0];
    if (!user || !user.created_at) return res.status(404).json({ error: 'User not found' });
    const createdAt = new Date(user.created_at);
    const now = new Date();
    // Calculate months between creation and now
    let months = (now.getFullYear() - createdAt.getFullYear()) * 12 + (now.getMonth() - createdAt.getMonth());
    if (now.getDate() >= createdAt.getDate()) months += 1; // count current month if past creation day
    if (months < 1) months = 1;
    const availableHours = months * 22 * 8;
    res.json({ created_at: user.created_at, availableHours });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Change password route
router.post('/change-password', async (req, res) => {
  const { user_id, newPassword } = req.body;
  if (!user_id || !newPassword) {
    return res.status(400).json({ error: 'User ID and new password are required' });
  }
  const db = await getDb();
  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE utilizadores SET password = $1 WHERE user_id = $2', [hashedPassword, user_id]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
import express from 'express';
import { getDb } from './db.js';

const router = express.Router();

// POST /api/absences - insert new absence
router.post('/', async (req, res) => {
  const {
    user_id,
    start_date,
    end_date,
    absence_type,
    description,
    status,
    approver_id,
    approval_date,
    created_at,
    updated_at
  } = req.body;

  try {
    const db = await getDb();
    await db.run(
      `INSERT INTO absences (
        user_id, start_date, end_date, absence_type, description,
        status, approver_id, approval_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, start_date, end_date, absence_type, description, status, approver_id, approval_date, created_at, updated_at]
    );
    await db.close();
    res.status(201).json({ message: 'Absence registered successfully' });
  } catch (error) {
    console.error('Error inserting absence:', error);
    res.status(500).json({ error: 'Failed to register absence' });
  }
});

// Get absences for a user_id
router.get('/user-absences', async (req, res) => {
  const { user_id } = req.query;
  const db = await getDb();
  try {
    const rows = await db.all('SELECT start_date, end_date, absence_type, description FROM absences WHERE user_id = ?', [user_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  } finally {
    await db.close();
  }
});

// Get total hours for a user in a month
router.get('/user-month-hours', async (req, res) => {
  const { user_id, start, end } = req.query;
  if (!user_id || !start || !end) {
    return res.status(400).json({ error: 'Missing parameters' });
  }
  const db = await getDb();
  try {
    const rows = await db.all(
      'SELECT hours FROM timesheet WHERE start_date BETWEEN ? AND ? AND user_id = ?',
      [start, end, user_id]
    );
    // Sum the hours (hours may be decimal or string)
    const total = rows.reduce((sum, row) => sum + (typeof row.hours === 'string' ? parseFloat(row.hours) : row.hours || 0), 0);
    res.json({ total });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  } finally {
    await db.close();
  }
});

export default router;

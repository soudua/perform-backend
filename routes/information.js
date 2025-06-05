import express from 'express';
import { getDb } from './db.js';

const router = express.Router();


// Login user
router.post('/information', async (req, res) => {
  const { username } = req.body;
  const db = await getDb();
  try {
    const user = await db.get('SELECT First_Name, groups FROM utilizadores WHERE email = ?', [username]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    // groups is a string like '["Perform"]', so parse and extract the first group
    let group = '';
    if (user.groups) {
      try {
        const parsed = JSON.parse(user.groups);
        if (Array.isArray(parsed) && parsed.length > 0) {
          group = parsed[0];
        }
      } catch (e) {
        group = user.groups;
      }
    }
    res.json({ firstname: user.First_Name, group });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  } finally {
    await db.close();
  }
});

// Get user_id by email
router.get('/user-id', async (req, res) => {
  const { email } = req.query;
  const db = await getDb();
  try {
    const user = await db.get('SELECT user_id FROM utilizadores WHERE email = ?', [email]);
    res.json(user || {});
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  } finally {
    await db.close();
  }
});

// Get timesheet rows for a user_id
router.get('/user-timesheet', async (req, res) => {
  const { user_id } = req.query;
  const db = await getDb();
  try {
    const rows = await db.all('SELECT start_date, end_date, hours, description FROM timesheet WHERE user_id = ?', [user_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  } finally {
    await db.close();
  }
});

// Get group by user_id
router.get('/group-by-user-id', async (req, res) => {
  const { user_id } = req.query;
  const db = await getDb();
  try {
    const user = await db.get('SELECT groups FROM utilizadores WHERE user_id = ?', [user_id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    let group = '';
    if (user.groups) {
      try {
        const parsed = JSON.parse(user.groups);
        if (Array.isArray(parsed) && parsed.length > 0) {
          group = parsed[0];
        }
      } catch (e) {
        group = user.groups;
      }
    }
    res.json({ group });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  } finally {
    await db.close();
  }
});

export default router;
import express from 'express';
import { getDb } from './db.js';

const router = express.Router();

// GET /api/clients - returns all clients
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const clients = await db.all('SELECT * FROM clients');
    await db.close();
    res.json(clients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// GET /api/clients/by-user - returns clients filtered by user's groups
router.get('/by-user', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' });
  
  const db = await getDb();
  try {
    // 1. Get user's groups from utilizadores
    const user = await db.get('SELECT groups FROM utilizadores WHERE user_id = ?', [user_id]);
    if (!user || !user.groups) {
      return res.status(404).json({ error: 'User or groups not found' });
    }

    // Parse the groups array string
    let groupNames = [];
    try {
      const parsed = JSON.parse(user.groups.replace(/'/g, '"'));
      groupNames = Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      groupNames = [user.groups];
    }

    // 2. Get group IDs
    const groupIds = [];
    for (const groupName of groupNames) {
      const group = await db.get('SELECT id FROM groups WHERE group_name = ?', [groupName]);
      if (group && group.id) {
        groupIds.push(group.id);
      }
    }

    if (groupIds.length === 0) {
      return res.status(404).json({ error: 'No valid groups found' });
    }

    // 3. Get clients for these group IDs
    const placeholders = groupIds.map(() => '?').join(',');
    const clients = await db.all(
      `SELECT DISTINCT c.* FROM clients c 
       WHERE c.group_id IN (${placeholders})`,
      groupIds
    );

    // Format response to match Autocomplete component expectations
    const formattedClients = clients.map(client => ({
      id: client.client_id,
      label: client.name,
      name: client.name
    }));

    res.json(formattedClients);
  } catch (err) {
    console.error('Error fetching clients by user:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    await db.close();
  }
});

// GET /api/clients/groups - returns all groups (projetos)
router.get('/groups', async (req, res) => {
  try {
    const db = await getDb();
    const groups = await db.all('SELECT project_name FROM projects');
    await db.close();
    res.json(groups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// GET /api/clients/categories - returns all task categories
router.get('/categories', async (req, res) => {
  try {
    const db = await getDb();
    const categories = await db.all('SELECT * FROM task_categories');
    await db.close();
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/clients/validate-timesheet - validates date range and time conflicts
router.get('/validate-timesheet', async (req, res) => {
  const { user_id, start_date, end_date } = req.query;
  
  if (!user_id || !start_date || !end_date) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const db = await getDb();
  try {
    // Check if the dates are within allowed range (today or 2 days before)
    const startDate = new Date(start_date);
    const now = new Date();
    const twoDaysAgo = new Date(now.setDate(now.getDate() - 2));
    twoDaysAgo.setHours(0, 0, 0, 0); // Start of the day

    if (startDate < twoDaysAgo) {
      return res.json({ 
        valid: false, 
        error: 'Só pode registrar horas do dia atual ou até 2 dias anteriores' 
      });
    }

    // Check for time conflicts
    const overlappingRecords = await db.all(`
      SELECT start_date, end_date 
      FROM timesheet 
      WHERE user_id = ? 
      AND (
        (start_date <= ? AND end_date >= ?) OR
        (start_date <= ? AND end_date >= ?) OR
        (start_date >= ? AND end_date <= ?)
      )`,
      [user_id, start_date, start_date, end_date, end_date, start_date, end_date]
    );

    if (overlappingRecords.length > 0) {
      return res.json({ 
        valid: false, 
        error: 'Já existe um registro de horas para este período' 
      });
    }

    res.json({ valid: true });
  } catch (err) {
    console.error('Error validating timesheet:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    await db.close();
  }
});

// POST /api/clients/timesheet - insert new timesheet entry
router.post('/timesheet', async (req, res) => {
  const {
    user_id,
    group_id,
    client_id,
    project_id,
    category_id,
    task_id,
    rate_user_id,
    start_date,
    end_date,
    hours,
    description,
    billable,
    overtime,
    total_hours,
    approved,
    activity_id,
    updated_at,
    created_at,
    group_name,
    rate_value
  } = req.body;
  try {
    const db = await getDb();
    await db.run(
      `INSERT INTO timesheet (
        user_id, group_id, client_id, project_id, category_id, task_id, rate_user_id, start_date, end_date, hours, description, billable, overtime, total_hours, approved, activity_id, updated_at, created_at, group_name, rate_value
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, group_id, client_id, project_id, category_id, task_id, rate_user_id, start_date, end_date, hours, description, billable, overtime, total_hours, approved, activity_id, updated_at, created_at, group_name, rate_value]
    );
    await db.close();
    res.status(201).json({ message: 'Timesheet entry created' });
  } catch (error) {
    console.error('Error inserting timesheet:', error);
    res.status(500).json({ error: error.message || error.toString() });
  }
});

// GET group id by group_name
router.get('/group-id', async (req, res) => {
  const { name } = req.query;
  try {
    const db = await getDb();
    const group = await db.get('SELECT id FROM groups WHERE group_name = ?', [name]);
    await db.close();
    res.json(group || {});
  } catch (error) {
    res.status(500).json({ error: error.message || error.toString() });
  }
});

// GET client id by name
router.get('/client-id', async (req, res) => {
  const { name } = req.query;
  try {
    const db = await getDb();
    const client = await db.get('SELECT client_id FROM clients WHERE name = ?', [name]);
    await db.close();
    res.json(client || {});
  } catch (error) {
    res.status(500).json({ error: error.message || error.toString() });
  }
});

// GET category id by task_category
router.get('/category-id', async (req, res) => {
  const { name } = req.query;
  try {
    const db = await getDb();
    const cat = await db.get('SELECT task_category_id FROM task_categories WHERE task_category = ?', [name]);
    await db.close();
    res.json(cat || {});
  } catch (error) {
    res.status(500).json({ error: error.message || error.toString() });
  }
});

// GET project names by user_id (chain: user_id -> group_id -> client_id(s) -> project_name)
router.get('/projects-by-user', async (req, res) => {
  const { user_id } = req.query;
  console.log('Fetching projects for user_id:', user_id); // Debug log
  
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' });
  const db = await getDb();
  try {
    // 1. Get user's groups from utilizadores
    const user = await db.get('SELECT groups FROM utilizadores WHERE user_id = ?', [user_id]);
    console.log('User data found:', user); // Debug log
    
    if (!user || !user.groups) {
      console.log('No user or groups found for user_id:', user_id); // Debug log
      return res.status(404).json({ error: 'User or groups not found' });
    }

    // Parse the groups array string
    let groupNames = [];
    try {
      const parsed = JSON.parse(user.groups.replace(/'/g, '"'));
      groupNames = Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      groupNames = [user.groups];
    }

    // 2. Get group IDs
    const groupIds = [];
    for (const groupName of groupNames) {
      const group = await db.get('SELECT id FROM groups WHERE group_name = ?', [groupName]);
      if (group && group.id) {
        groupIds.push(group.id);
      }
    }

    if (groupIds.length === 0) {
      return res.status(404).json({ error: 'No valid groups found' });
    }

    // 3. Get all projects for clients in these groups
    const placeholders = groupIds.map(() => '?').join(',');
    const sql = `SELECT DISTINCT p.project_name
                 FROM projects p
                 JOIN clients c ON p.client_id = c.client_id
                 WHERE c.group_id IN (${placeholders})`;
    
    console.log('Executing SQL with group_ids:', groupIds); // Debug log
    const projects = await db.all(sql, groupIds);
    console.log('Found projects:', projects); // Debug log
    
    res.json({ projects: projects.map(p => p.project_name) });
  } catch (err) {
    console.error('Error in projects-by-user:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    await db.close();
  }
});

// GET project_id by project_name
router.get('/project-id', async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: 'Missing project_name' });
  const db = await getDb();
  try {
    const project = await db.get('SELECT project_id FROM projects WHERE project_name = ?', [name]);
    res.json(project || {});
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  } finally {
    await db.close();
  }
});

// GET people and hours for a project_id (aggregated by name)
router.get('/project-people-hours', async (req, res) => {
  const { project_id } = req.query;
  if (!project_id) return res.status(400).json({ error: 'Missing project_id' });
  const db = await getDb();
  try {
    const rows = await db.all(`
      SELECT u.First_Name, u.Last_Name, t.hours
      FROM timesheet t
      JOIN utilizadores u ON t.user_id = u.user_id
      WHERE t.project_id = ?
    `, [project_id]);
    // Aggregate hours by person
    const peopleMap = {};
    let totalHours = 0;
    for (const row of rows) {
      const name = `${row.First_Name} ${row.Last_Name}`;
      const hours = typeof row.hours === 'string' ? parseFloat(row.hours) : row.hours || 0;
      if (!peopleMap[name]) peopleMap[name] = 0;
      peopleMap[name] += hours;
      totalHours += hours;
    }
    // Format for frontend
    const people = Object.entries(peopleMap).map(([label, value], idx) => ({ id: idx, label, value }));
    res.json({ people, totalHours });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  } finally {
    await db.close();
  }
});

// GET project hours breakdown for a user and project
router.get('/project-hours-breakdown', async (req, res) => {
  const { user_id, project_id } = req.query;
  if (!user_id || !project_id) {
    return res.status(400).json({ error: 'Missing user_id or project_id' });
  }
  const db = await getDb();
  try {
    // Horas Normais: all hours for user/project
    const normaisRows = await db.all(
      'SELECT hours FROM timesheet WHERE user_id = ? AND project_id = ?',
      [user_id, project_id]
    );
    const horasNormais = normaisRows.reduce((sum, row) => sum + (parseFloat(row.hours) || 0), 0);

    // Horas Faturaveis: billable = 1
    const faturaveisRows = await db.all(
      'SELECT hours FROM timesheet WHERE user_id = ? AND project_id = ? AND billable = 1',
      [user_id, project_id]
    );
    const horasFaturaveis = faturaveisRows.reduce((sum, row) => sum + (parseFloat(row.hours) || 0), 0);

    // Horas Extra: overtime = 1
    const extraRows = await db.all(
      'SELECT hours FROM timesheet WHERE user_id = ? AND project_id = ? AND overtime = 1',
      [user_id, project_id]
    );
    const horasExtra = extraRows.reduce((sum, row) => sum + (parseFloat(row.hours) || 0), 0);

    res.json({
      horasNormais,
      horasFaturaveis,
      horasExtra
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  } finally {
    await db.close();
  }
});

export default router;

const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/tasks - استرجاع جميع المهام مع إمكانية التصفية
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM tasks';
    const params = [];
    if (status && ['active', 'completed'].includes(status)) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    query += ' ORDER BY due_date ASC';
    const [rows] = await db.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/tasks - إضافة مهمة جديدة
router.post('/', async (req, res) => {
  try {
    const { title, due_date } = req.body;
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Title is required and must be a non-empty string' });
    }
    if (!due_date || isNaN(Date.parse(due_date))) {
      return res.status(400).json({ success: false, message: 'Due date is required and must be a valid date' });
    }
    const [result] = await db.execute(
      'INSERT INTO tasks (title, due_date, status) VALUES (?, ?, \'active\')',
      [title.trim(), due_date]
    );
    const [newTask] = await db.execute('SELECT * FROM tasks WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: newTask[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PUT /api/tasks/:id - تحديث مهمة
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, status } = req.body;
    if (!title && !status) {
      return res.status(400).json({ success: false, message: 'At least title or status must be provided' });
    }
    if (status && !['active', 'completed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be active or completed' });
    }
    if (title && (typeof title !== 'string' || title.trim().length === 0)) {
      return res.status(400).json({ success: false, message: 'Title must be a non-empty string' });
    }
    const [existing] = await db.execute('SELECT * FROM tasks WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    let query = 'UPDATE tasks SET ';
    const params = [];
    if (title) {
      query += 'title = ?, ';
      params.push(title.trim());
    }
    if (status) {
      query += 'status = ?, ';
      params.push(status);
    }
    query += 'updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    params.push(id);
    await db.execute(query, params);
    const [updated] = await db.execute('SELECT * FROM tasks WHERE id = ?', [id]);
    res.json({ success: true, data: updated[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// DELETE /api/tasks/:id - حذف مهمة
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await db.execute('SELECT * FROM tasks WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    await db.execute('DELETE FROM tasks WHERE id = ?', [id]);
    res.json({ success: true, message: 'Task deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;

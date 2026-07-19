const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const db = new Database('db.sqlite');
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  completed INTEGER DEFAULT 0,
  dueDate TEXT,
  createdAt TEXT DEFAULT (datetime('now'))
)`);

// Seed data if empty
const count = db.prepare('SELECT COUNT(*) as count FROM tasks').get();
if (count.count === 0) {
  const insert = db.prepare('INSERT INTO tasks (title, completed, dueDate) VALUES (?, ?, ?)');
  const seeds = [
    ['شراء البقالة', 0, '2023-12-20'],
    ['قراءة كتاب', 0, '2023-12-22'],
    ['موعد طبيب', 1, '2023-12-18'],
    ['تجهيز التقرير', 0, '2023-12-25'],
    ['تمارين رياضية', 1, '2023-12-19']
  ];
  const insertMany = db.transaction((tasks) => {
    for (const task of tasks) {
      insert.run(...task);
    }
  });
  insertMany(seeds);
}

// Routes
app.get('/api/tasks', (req, res) => {
  const { filter } = req.query;
  let tasks;
  if (filter === 'active') {
    tasks = db.prepare('SELECT * FROM tasks WHERE completed = 0').all();
  } else if (filter === 'completed') {
    tasks = db.prepare('SELECT * FROM tasks WHERE completed = 1').all();
  } else {
    tasks = db.prepare('SELECT * FROM tasks').all();
  }
  res.json({ tasks });
});

app.post('/api/tasks', (req, res) => {
  const { title, dueDate } = req.body;
  if (!title || title.trim() === '') {
    return res.status(400).json({ error: 'Title is required' });
  }
  const result = db.prepare('INSERT INTO tasks (title, dueDate) VALUES (?, ?)').run(title.trim(), dueDate || null);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ task });
});

app.put('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const { title, completed, dueDate } = req.body;
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Task not found' });
  }
  const newTitle = title !== undefined ? title : existing.title;
  const newCompleted = completed !== undefined ? (completed ? 1 : 0) : existing.completed;
  const newDueDate = dueDate !== undefined ? dueDate : existing.dueDate;
  db.prepare('UPDATE tasks SET title = ?, completed = ?, dueDate = ? WHERE id = ?').run(newTitle, newCompleted, newDueDate, id);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.json({ task });
});

app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.json({ message: 'deleted' });
});

// Serve frontend for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const express = require('express');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.DATA_FILE || '/data/state.json';

const DEFAULT_TASKS = [
  { id: '1', text: 'Push all pending code commits', done: false },
  { id: '2', text: 'Update task board / tickets', done: false },
  { id: '3', text: 'Review and respond to open PRs', done: false },
  { id: '4', text: 'Check tomorrow\'s calendar', done: false },
  { id: '5', text: 'Send end-of-day status update', done: false },
  { id: '6', text: 'Log hours / timesheet', done: false },
  { id: '7', text: 'Clear open browser tabs', done: false },
];

function loadState() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load state, using defaults:', e.message);
  }
  return { tasks: JSON.parse(JSON.stringify(DEFAULT_TASKS)) };
}

function saveState(state) {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('Failed to save state:', e.message);
  }
}

function resetTasks() {
  const state = loadState();
  state.tasks.forEach(t => { t.done = false; });
  state.lastReset = new Date().toISOString();
  saveState(state);
  console.log(`Tasks reset at ${state.lastReset}`);
  return state;
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/tasks', (req, res) => {
  res.json(loadState());
});

app.post('/api/tasks/:id/toggle', (req, res) => {
  const state = loadState();
  const task = state.tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  task.done = !task.done;
  saveState(state);
  res.json(state);
});

app.post('/api/tasks', (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Text is required' });
  const state = loadState();
  state.tasks.push({ id: Date.now().toString(), text: text.trim(), done: false });
  saveState(state);
  res.json(state);
});

app.delete('/api/tasks/:id', (req, res) => {
  const state = loadState();
  const before = state.tasks.length;
  state.tasks = state.tasks.filter(t => t.id !== req.params.id);
  if (state.tasks.length === before) return res.status(404).json({ error: 'Task not found' });
  saveState(state);
  res.json(state);
});

app.post('/api/reset', (req, res) => {
  res.json(resetTasks());
});

// Reset all tasks at 3 AM every day (respects TZ env var)
cron.schedule('0 3 * * *', resetTasks);

app.listen(PORT, () => {
  console.log(`Nightly To-Do running on port ${PORT}`);
  console.log(`Tasks will auto-reset at 3:00 AM (TZ=${process.env.TZ || 'UTC'})`);
});

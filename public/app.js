let state = { tasks: [] };

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function updateProgress() {
  const total = state.tasks.length;
  const done = state.tasks.filter(t => t.done).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  document.getElementById('progress-bar').style.width = pct + '%';
  document.getElementById('progress-label').textContent = `${done} of ${total} done`;
}

function renderTasks() {
  const list = document.getElementById('task-list');
  list.innerHTML = '';

  if (state.tasks.length === 0) {
    list.innerHTML = '<li class="loading">No tasks yet — add one below.</li>';
    updateProgress();
    return;
  }

  state.tasks.forEach(task => {
    const li = document.createElement('li');
    li.className = 'task-item' + (task.done ? ' done' : '');
    li.dataset.id = task.id;

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'task-checkbox';
    cb.checked = task.done;
    cb.addEventListener('change', () => toggleTask(task.id));

    const span = document.createElement('span');
    span.className = 'task-text';
    span.textContent = task.text;
    span.addEventListener('click', () => toggleTask(task.id));

    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.innerHTML = '&#x2715;';
    del.title = 'Remove task';
    del.addEventListener('click', (e) => { e.stopPropagation(); deleteTask(task.id); });

    li.append(cb, span, del);
    list.appendChild(li);
  });

  updateProgress();

  const allDone = state.tasks.length > 0 && state.tasks.every(t => t.done);
  if (allDone) showAllDoneBanner();
}

function showAllDoneBanner() {
  const existing = document.querySelector('.all-done-banner');
  if (existing) return;
  const banner = document.createElement('div');
  banner.className = 'all-done-banner';
  banner.innerHTML = `
    <span class="emoji">🎉</span>
    <p>All wrapped up!</p>
    <small>Great work today. See you tomorrow.</small>
  `;
  document.getElementById('task-list').after(banner);
}

function removeAllDoneBanner() {
  document.querySelector('.all-done-banner')?.remove();
}

async function toggleTask(id) {
  try {
    state = await api('POST', `/api/tasks/${id}/toggle`);
    removeAllDoneBanner();
    renderTasks();
  } catch (e) {
    showToast('Failed to update task');
  }
}

async function deleteTask(id) {
  try {
    state = await api('DELETE', `/api/tasks/${id}`);
    removeAllDoneBanner();
    renderTasks();
  } catch (e) {
    showToast('Failed to delete task');
  }
}

document.getElementById('add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('new-task-input');
  const text = input.value.trim();
  if (!text) return;
  try {
    state = await api('POST', '/api/tasks', { text });
    input.value = '';
    removeAllDoneBanner();
    renderTasks();
  } catch (e) {
    showToast('Failed to add task');
  }
});

document.getElementById('reset-btn').addEventListener('click', async () => {
  if (!confirm('Reset all tasks to unchecked?')) return;
  try {
    state = await api('POST', '/api/reset');
    removeAllDoneBanner();
    renderTasks();
    showToast('Tasks reset');
  } catch (e) {
    showToast('Failed to reset tasks');
  }
});

let toastTimer;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

function updateDateDisplay() {
  const el = document.getElementById('date-display');
  const now = new Date();
  el.textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

// Poll for server-side reset every 60 seconds so the UI stays in sync
function scheduleSync() {
  setTimeout(async () => {
    try {
      state = await api('GET', '/api/tasks');
      removeAllDoneBanner();
      renderTasks();
    } catch (_) {}
    scheduleSync();
  }, 60_000);
}

async function init() {
  updateDateDisplay();
  try {
    state = await api('GET', '/api/tasks');
  } catch (e) {
    document.getElementById('task-list').innerHTML = '<li class="loading">Could not reach server.</li>';
    return;
  }
  renderTasks();
  scheduleSync();
}

init();

document.addEventListener('DOMContentLoaded', async () => {
  const levelBadge = document.getElementById('user-level');
  const nextBreakSpan = document.getElementById('next-break');
  const reminderToggle = document.getElementById('reminder-toggle');
  const focusBtn = document.getElementById('focus-mode-btn');
  const dashboardBtn = document.getElementById('open-dashboard');

  // Load state
  const data = await chrome.storage.local.get(['level', 'nextBreak', 'remindersEnabled', 'focusMode']);
  
  if (data.level) levelBadge.textContent = `LVL ${data.level}`;
  if (data.nextBreak) nextBreakSpan.textContent = data.nextBreak;
  reminderToggle.checked = data.remindersEnabled !== false;
  
  if (data.focusMode) {
    focusBtn.textContent = 'Désactiver Focus Mode';
    focusBtn.style.background = '#ef4444';
  }

  // Event Listeners
  reminderToggle.onchange = (e) => {
    chrome.storage.local.set({ remindersEnabled: e.target.checked });
    chrome.runtime.sendMessage({ action: 'toggleReminders', enabled: e.target.checked });
  };

  focusBtn.onclick = () => {
    const active = focusBtn.textContent.includes('Désactiver');
    const newState = !active;
    
    chrome.storage.local.set({ focusMode: newState });
    chrome.runtime.sendMessage({ action: 'toggleFocusMode', enabled: newState });
    
    focusBtn.textContent = newState ? 'Désactiver Focus Mode' : 'Activer Focus Mode';
    focusBtn.style.background = newState ? '#ef4444' : '#3b82f6';
  };

  dashboardBtn.onclick = () => {
    chrome.tabs.create({ url: 'http://localhost:3000/dashboard.html' });
  };
});

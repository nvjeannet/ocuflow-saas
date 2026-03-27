// OcuFlow Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  console.log('OcuFlow Extension installée.');
  // Initialiser les alarmes par défaut (toutes les 20 min)
  chrome.alarms.create('ocu-reminder', { periodInMinutes: 20 });
  chrome.storage.local.set({ remindersEnabled: true, level: 1 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'ocu-reminder') {
    chrome.storage.local.get(['remindersEnabled'], (data) => {
      if (data.remindersEnabled !== false) {
        showNotification();
      }
    });
  }
});

function showNotification() {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png', // À créer
    title: 'OcuFlow : Pause Visuelle 👁️',
    message: "C'est l'heure ! Regardez à 20 pieds (6m) pendant 20 secondes pour détendre vos muscles oculaires.",
    priority: 2
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleReminders') {
    if (request.enabled) {
      chrome.alarms.create('ocu-reminder', { periodInMinutes: 20 });
    } else {
      chrome.alarms.clear('ocu-reminder');
    }
  }

  if (request.action === 'toggleFocusMode') {
    // Diffuser le message à tous les onglets ouverts
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { action: 'focusMode', enabled: request.enabled }).catch(() => {});
      });
    });
  }
});

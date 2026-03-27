const TRANSLATIONS = {
  fr: {
    welcome: "Bonjour", dashboard: "Tableau de Bord", free_mode: "Mode Libre",
    start_routine: "Lancer une Routine", logout: "Déconnexion", streak: "Série",
    minutes: "Minutes", badges: "Badges", settings: "Réglages", theme: "Thème",
    lang: "Langue", r_2020: "Rappels 20-20-20", session_done: "Session terminée !"
  },
  en: {
    welcome: "Hello", dashboard: "Dashboard", free_mode: "Free Mode",
    start_routine: "Start Routine", logout: "Logout", streak: "Streak",
    minutes: "Minutes", badges: "Badges", settings: "Settings", theme: "Theme",
    lang: "Language", r_2020: "20-20-20 Reminders", session_done: "Session complete!"
  }
};

const getT = (key) => TRANSLATIONS[StorageManager.data.lang || 'fr'][key] || key;

const getApiBaseUrl = () => {
  const isLocalFile = window.location.protocol === 'file:';
  const isWrongPort = window.location.port !== '3000' && window.location.hostname === 'localhost';
  if (isLocalFile || isWrongPort) return 'http://localhost:3000/api';
  return '/api';
};

const API_BASE = getApiBaseUrl();

const DEFAULT_ROUTINES = [
  { id: 'office', name: 'Bureau (Pause)', icon: '💻', desc: 'Soulage la fatigue numérique rapidement.', exs: [17, 18, 0, 14], dur: 120 },
  { id: 'wakeup', name: 'Réveil Matin', icon: '🌅', desc: 'Réveille vos muscles pour la journée.', exs: [4, 5, 8, 9, 13], dur: 180 },
  { id: 'night', name: 'Repos du Soir', icon: '🌙', desc: 'Détend vos yeux avant de dormir.', exs: [18, 0, 1, 15, 17], dur: 300 },
  { id: 'focus', name: 'Focus Intense', icon: '🎯', desc: 'Améliore la concentration et la vue.', exs: [10, 11, 12, 16, 14], dur: 240 }
];

const StorageManager = {
  KEY: 'ocuflow_data_v1',
  data: { 
    sessions: [], streak: 0, lastDate: null, unlockedBadges: [], 
    audioEnabled: false, nightModeEnabled: true, 
    ambianceEnabled: true, ambianceType: 'zen', spatialAudio: true, 
    dailyGoalSecs: 300,
    totalDuration: 60, speed: 3, dotShape: 'circle', dotColor: '#00e5ff', dotSize: 22,
    currentRoutineId: 'office',
    customRoutines: [],
    freeSelectedExs: [0, 1, 4],
    theme: 'dark',
    lang: 'fr',
    xp: 0,
    level: 1,
    reminders: {
      enabled: false,
      type: 'interval', // 'interval', 'fixed', 'goal'
      intervalMin: 20,
      fixedTimes: ['10:00', '14:00', '18:00'],
      dailyGoal: 3,
      pushEnabled: false,
      lastIntervalNotif: 0
    }
  },

  init() {
    const saved = localStorage.getItem(this.KEY);
    if(saved) {
      try { 
        const parsed = JSON.parse(saved);
        this.data = {...this.data, ...parsed}; 
      } catch(_) {}
    } else {
      // First run: detect browser language
      const browserLang = navigator.language.split('-')[0];
      if (['fr', 'en'].includes(browserLang)) {
        this.data.lang = browserLang;
      }
    }
    this.updateStreak();
    this.syncWithBackend();
    this.applyTheme();
    // Migration
    if (typeof this.data.remindersEnabled === 'boolean') {
      if (!this.data.reminders) this.data.reminders = { enabled: this.data.remindersEnabled, type: 'interval', intervalMin: 20, fixedTimes: ['10:00','14:00'], dailyGoal: 3, pushEnabled: false };
      else this.data.reminders.enabled = this.data.remindersEnabled;
      delete this.data.remindersEnabled;
    }
    this.initReminders();
    this.fetchTeamSettings();
  },

  async fetchTeamSettings() {
    const token = localStorage.getItem('ocuflow_token');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/auth/team/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        this.teamSettings = await res.json();
      }
    } catch(e) {}
  },

  applyTheme() {
    document.body.className = `theme-${this.data.theme || 'dark'}`;
  },

  initReminders() {
    if (!this.data.reminders || !this.data.reminders.enabled) return;
    if (!this.data.reminders.lastIntervalNotif) this.data.reminders.lastIntervalNotif = Date.now();
    
    // Check every minute
    if (this._notifInterval) clearInterval(this._notifInterval);
    this._notifInterval = setInterval(() => this.checkReminders(), 60000);
    this.checkReminders(); // Initial check
  },

  checkReminders() {
    const r = this.data.reminders;
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    const day = now.getDay();

    // 1. Check Global Team Reminders
    if (this.teamSettings && this.teamSettings.fixedTimes && this.teamSettings.days) {
      if (this.teamSettings.days.includes(day) && this.teamSettings.fixedTimes.includes(timeStr)) {
        this.sendNotification("Rappel d'Équipe 📢", "C'est l'heure de la pause OcuFlow collective !");
      }
    }

    // 2. Personal Reminders
    if (!r || !r.enabled) return;

    if (r.type === 'interval') {
      const elapsed = (now.getTime() - r.lastIntervalNotif) / 60000;
      if (elapsed >= r.intervalMin) {
        this.sendNotification("Temps écoulé !", `C'est l'heure de votre pause oculaire (${r.intervalMin} min).`);
        r.lastIntervalNotif = now.getTime();
        this.save();
      }
    } else if (r.type === 'fixed') {
      if (r.fixedTimes.includes(timeStr)) {
        this.sendNotification("Rappel Programmé", "Il est l'heure de votre séance OcuFlow !");
      }
    } else if (r.type === 'goal') {
      // Check at end of day (e.g., 20:00) if goal not met
      if (timeStr === '20:00') {
        const today = now.toISOString().split('T')[0];
        const count = this.data.sessions.filter(s => s.date === today).length;
        if (count < r.dailyGoal) {
          this.sendNotification("Objectif Quotidien", `Encore ${r.dailyGoal - count} séance(s) pour atteindre votre objectif !`);
        }
      }
    }
  },

  sendNotification(title, body) {
    if (!this.data.reminders.enabled) return;
    
    // 1. Browser Push (if permitted)
    if (this.data.reminders.pushEnabled && Notification.permission === 'granted') {
      new Notification(title, { body, icon: 'logo.png' });
    } else {
      // 2. Fallback to alert if window is in focus
      if (document.hasFocus()) {
        alert(`${title}\n${body}`);
      }
    }
  },

  async syncWithBackend() {
    const token = localStorage.getItem('ocuflow_token');
    if (!token) return;

    try {
      // 1. Synchroniser les Sessions
      const resSessions = await fetch(`${API_BASE}/sessions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resSessions.ok) {
        const sessions = await resSessions.json();
        this.data.sessions = sessions.map(s => ({
          ...s,
          date: new Date(s.timestamp).toISOString().split('T')[0]
        }));
      }

      // 2. Synchroniser les Routines
      const resRoutines = await fetch(`${API_BASE}/routines`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resRoutines.ok) {
        const routines = await resRoutines.json();
        this.data.customRoutines = routines.map(r => ({
          id: r.id,
          name: r.name,
          icon: r.icon,
          desc: r.description,
          exs: r.config.exs,
          dur: r.config.dur
        }));
      }

      this.updateStreak();
      this.save();
      if (typeof window.refreshUI === 'function') window.refreshUI();
    } catch (err) {
      console.warn('Erreur lors de la synchronisation backend.');
    }
  },

  async saveSession(duration, exercises) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const session = { 
      date: today, 
      timestamp: now.getTime(),
      duration, 
      exercises 
    };
    
    // Sauvegarde locale (immédiate)
    this.data.sessions.push(session);
    this.addXP(duration > 120 ? 100 : 50); // XP based on duration
    this.updateStreak();
    this.save();

    // Sauvegarde Backend (si connecté)
    const token = localStorage.getItem('ocuflow_token');
    if (token) {
      try {
        await fetch(`${API_BASE}/sessions`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            duration, 
            exercises,
            xp: this.data.xp,
            level: this.data.level
          })
        });
      } catch (err) {
        console.warn('Erreur lors de l\'envoi de la session au serveur.');
      }
    }
  },

  getRoutines() {
    const routines = [...DEFAULT_ROUTINES];
    this.data.customRoutines.forEach(custom => {
      const idx = routines.findIndex(r => r.id === custom.id);
      if (idx !== -1) routines[idx] = custom;
      else routines.push(custom);
    });
    return routines;
  },

  async saveRoutine(routine) {
    // 1. Sauvegarde locale (immédiate pour réactivité)
    const idx = this.data.customRoutines.findIndex(r => r.id === routine.id);
    if (idx !== -1) this.data.customRoutines[idx] = routine;
    else this.data.customRoutines.push(routine);
    this.save();

    // 2. Synchronisation Backend
    const token = localStorage.getItem('ocuflow_token');
    if (token) {
      try {
        const res = await fetch(`${API_BASE}/routines`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            id: isNaN(routine.id) ? null : routine.id,
            name: routine.name,
            icon: routine.icon,
            description: routine.desc,
            config: { exs: routine.exs, dur: routine.dur }
          })
        });
        
        if (res.ok) {
          const saved = await res.json();
          // Mettre à jour l'ID local avec l'ID réel de la DB
          if (isNaN(routine.id)) {
            const tempIdx = this.data.customRoutines.findIndex(r => r.id === routine.id);
            if (tempIdx !== -1) {
              this.data.customRoutines[tempIdx].id = saved.id;
              this.save();
            }
          }
          return saved;
        }
      } catch (err) {
        console.warn('Erreur lors de l\'envoi de la routine au serveur.');
      }
    }
  },

  async deleteRoutine(id) {
    // Locale
    this.data.customRoutines = this.data.customRoutines.filter(r => r.id !== id);
    this.save();

    // Backend
    const token = localStorage.getItem('ocuflow_token');
    if (token && !isNaN(id)) {
      try {
        await fetch(`${API_BASE}/routines/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (err) {
        console.warn('Erreur lors de la suppression sur le serveur.');
      }
    }
  },

  save() { localStorage.setItem(this.KEY, JSON.stringify(this.data)); },

  updateStreak() {
    const sessions = this.data.sessions;
    if(!sessions.length) return;
    const dates = [...new Set(sessions.map(s => s.date))].sort();
    let streak = 0;
    let current = new Date();
    const todayStr = current.toISOString().split('T')[0];
    current.setDate(current.getDate() - 1);
    const yesterdayStr = current.toISOString().split('T')[0];
    const lastDate = dates[dates.length - 1];
    if(lastDate !== todayStr && lastDate !== yesterdayStr) {
      this.data.streak = 0;
    } else {
      let checkDate = new Date(lastDate);
      for(let i = dates.length - 1; i >= 0; i--) {
        const dStr = checkDate.toISOString().split('T')[0];
        if(dates[i] === dStr) { streak++; checkDate.setDate(checkDate.getDate() - 1); }
        else break;
      }
      this.data.streak = streak;
    }
  },

  addXP(amount) {
    this.data.xp = (this.data.xp || 0) + amount;
    const newLevel = Math.floor(Math.sqrt(this.data.xp / 100)) + 1;
    if (newLevel > (this.data.level || 1)) {
      this.data.level = newLevel;
      // You could trigger a custom event here for the UI
    }
  },
  getEyeHealthScore() {
    const last7Days = this.data.sessions.filter(s => {
      const diff = Date.now() - new Date(s.timestamp || s.date).getTime();
      return diff < 7 * 24 * 60 * 60 * 1000;
    });
    const dailyGoal = this.data.reminders?.dailyGoal || 3;
    const weeklyGoal = dailyGoal * 7;
    const ratio = Math.min(last7Days.length / weeklyGoal, 1);
    return Math.round(ratio * 100);
  }
};

const SoundManager = {
  ctx: null,
  panner: null,
  ambianceSource: null,
  
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.panner = this.ctx.createStereoPanner();
    this.panner.connect(this.ctx.destination);
  },

  playSpatialBeep(freq = 440, dur = 0.2, pan = 0) {
    if (!this.ctx) this.init();
    if (!StorageManager.data.audioEnabled) return;
    
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const p = this.ctx.createStereoPanner();
    
    osc.connect(g);
    g.connect(p);
    p.connect(this.ctx.destination);
    
    p.pan.setValueAtTime(pan, this.ctx.currentTime);
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.05, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    
    osc.start();
    osc.stop(this.ctx.currentTime + dur);
  },

  startAmbiance(type = 'zen') {
    if (!StorageManager.data.ambianceEnabled) return;
    if (!this.ctx) this.init();
    this.stopAmbiance();

    if (type === 'binaural') {
        const oscL = this.ctx.createOscillator();
        const oscR = this.ctx.createOscillator();
        const pL = this.ctx.createStereoPanner();
        const pR = this.ctx.createStereoPanner();
        const g = this.ctx.createGain();

        oscL.frequency.value = 200; // Base
        oscR.frequency.value = 210; // 10Hz Alpha beat
        pL.pan.value = -1;
        pR.pan.value = 1;
        g.gain.value = 0.03;

        oscL.connect(pL);
        oscR.connect(pR);
        pL.connect(g);
        pR.connect(g);
        g.connect(this.ctx.destination);

        oscL.start();
        oscR.start();
        this._binauralSources = [oscL, oscR];
        return;
    }

    const bufferSize = 2 * this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);

    // Pink Noise / Brown Noise generation
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
        let white = Math.random() * 2 - 1;
        if (type === 'rain') {
            // Simple Pink Noise filt
            lastOut = (lastOut + (0.02 * white)) / 1.02;
            output[i] = lastOut * 1.5;
        } else if (type === 'ocean') {
            // Brown Noise + Sine LFO
            lastOut = (lastOut + (0.01 * white)) / 1.01;
            const lfo = Math.sin(i * 0.0001) * 0.5 + 0.5;
            output[i] = lastOut * lfo;
        } else {
            // Zen: Soft low hum (Sine + low noise)
            output[i] = (Math.sin(i * 0.01) * 0.1) + (Math.random() * 0.01);
        }
    }

    this.ambianceSource = this.ctx.createBufferSource();
    this.ambianceSource.buffer = buffer;
    this.ambianceSource.loop = true;
    
    const g = this.ctx.createGain();
    g.gain.value = 0.05;
    
    this.ambianceSource.connect(g);
    g.connect(this.panner);
    this.ambianceSource.start();

    // 8D Effect (Slow panning)
    if (this._8dInterval) clearInterval(this._8dInterval);
    this._8dInterval = setInterval(() => {
        const pan = Math.sin(Date.now() / 2000);
        this.panner.pan.setTargetAtTime(pan, this.ctx.currentTime, 0.5);
    }, 100);
  },

  stopAmbiance() {
    if (this.ambianceSource) {
      try { this.ambianceSource.stop(); } catch(e) {}
      this.ambianceSource = null;
    }
    if (this._binauralSources) {
      this._binauralSources.forEach(s => { try { s.stop(); } catch(e) {} });
      this._binauralSources = null;
    }
    if (this._8dInterval) clearInterval(this._8dInterval);
  }
};

const BADGES = [
  { id: 'first', name: 'Premier Pas', icon: '🌱', desc: '1ère session terminée', check: (data) => data.sessions.length >= 1 },
  { id: 'streak3', name: 'Régulier', icon: '🔥', desc: 'Série de 3 jours', check: (data) => data.streak >= 3 },
  { id: 'owl', name: 'Hibou Attentif', icon: '🦉', desc: '10 sessions au total', check: (data) => data.sessions.length >= 10 },
  { id: 'master', name: 'Maître Focus', icon: '👑', desc: "60 minutes d'entraînement", check: (data) => {
    const totalSecs = data.sessions.reduce((acc, s) => acc + s.duration, 0);
    return totalSecs >= 3600;
  }},
  { id: 'night', name: 'Repos Nocturne', icon: '🌙', desc: 'Session terminée après 21h', check: (data) => {
    return data.sessions.some(s => {
      const h = new Date(s.timestamp || s.date).getHours();
      return h >= 21 || h < 5;
    });
  }},
];

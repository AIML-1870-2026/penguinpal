const Logger = {
  levels: { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 },
  currentLevel: 1,
  logs: [],

  _log(level, levelName, consoleFn, icon, args) {
    if (this.currentLevel > level) return;
    const entry = { level: levelName, time: new Date().toLocaleTimeString(), args };
    this.logs.push(entry);
    consoleFn(`${icon} [${levelName}]`, ...args);
    this._appendToPanel(entry);
  },

  debug(...args) { this._log(0, 'DEBUG', console.log.bind(console), '🌱', args); },
  info(...args)  { this._log(1, 'INFO',  console.log.bind(console), '🌷', args); },
  warn(...args)  { this._log(2, 'WARN',  console.warn.bind(console), '🌼', args); },
  error(...args) { this._log(3, 'ERROR', console.error.bind(console), '🥀', args); },

  _appendToPanel(entry) {
    const output = document.getElementById('log-output');
    if (!output) return;
    const div = document.createElement('div');
    div.className = `log-line log-${entry.level.toLowerCase()}`;
    const text = entry.args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    div.textContent = `[${entry.time}] [${entry.level}] ${text}`;
    output.appendChild(div);
    output.scrollTop = output.scrollHeight;
  },

  clear() {
    this.logs = [];
    const output = document.getElementById('log-output');
    if (output) output.innerHTML = '';
  },

  export() {
    const text = this.logs.map(e =>
      `[${e.time}] [${e.level}] ${e.args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`
    ).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'blackjack-logs.txt';
    a.click();
    URL.revokeObjectURL(url);
  }
};

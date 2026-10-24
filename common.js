const ACTIONS = [
  { id: "moveForward", label: "Move Forward", defaultKey: "w" },
  { id: "moveBackward", label: "Move Backward", defaultKey: "s" },
  { id: "moveLeft", label: "Move Left", defaultKey: "a" },
  { id: "moveRight", label: "Move Right", defaultKey: "d" },
  { id: "jump", label: "Jump", defaultKey: "space" },
  { id: "cycleWeapon", label: "Cycle Weapon", defaultKey: "1" },
  { id: "useEquipment", label: "Use Equipment", defaultKey: "2" },
  { id: "useAbility", label: "Use Ability", defaultKey: "3" },
  { id: "useItem", label: "Use Item", defaultKey: "4" },
  { id: "reload", label: "Reload", defaultKey: "r" },
  { id: "melee", label: "Melee", defaultKey: "q" },
  { id: "use", label: "Use", defaultKey: "e" },
  { id: "matchOptions", label: "Match Options", defaultKey: "tab" },
  { id: "chat", label: "Chat", defaultKey: "enter" },
  { id: "teamChat", label: "Team Chat", defaultKey: "backspace" },
  { id: "doEmote", label: "Do Emote", defaultKey: "b" },
];

const SPECIAL_FEATURES = [
  {
    id: "holdScope",
    group: "Scope",
    label: "Hold",
    defaultKey: "z",
    desc: "Hold to look through your scope; release to close it.",
  },
  {
    id: "toggleScope",
    group: "Scope",
    label: "Toggle",
    defaultKey: "p",
    desc: "Press once to open your scope and again to close it. No need to hold the key.",
  },
  {
    id: "holdSprint",
    group: "Sprint",
    label: "Hold",
    defaultKey: "shift",
    desc: "Hold to sprint; release to return to walking. Matches the game's standard sprint behavior.",
  },
  {
    id: "toggleSprint",
    group: "Sprint",
    label: "Toggle",
    defaultKey: "m",
    desc: "Press once to start holding sprint; press again to release it.",
  },
  {
    id: "fire",
    group: "Fire",
    label: "Hold",
    defaultKey: "f",
    desc: "Hold to fire continuously, equivalent to holding left-click. Release to stop.",
  },
];

const KEY_INFO = {
  w: { key: "w", code: "KeyW", keyCode: 87 },
  s: { key: "s", code: "KeyS", keyCode: 83 },
  a: { key: "a", code: "KeyA", keyCode: 65 },
  d: { key: "d", code: "KeyD", keyCode: 68 },
  q: { key: "q", code: "KeyQ", keyCode: 81 },
  e: { key: "e", code: "KeyE", keyCode: 69 },
  r: { key: "r", code: "KeyR", keyCode: 82 },
  b: { key: "b", code: "KeyB", keyCode: 66 },
  "1": { key: "1", code: "Digit1", keyCode: 49 },
  "2": { key: "2", code: "Digit2", keyCode: 50 },
  "3": { key: "3", code: "Digit3", keyCode: 51 },
  "4": { key: "4", code: "Digit4", keyCode: 52 },
  space: { key: " ", code: "Space", keyCode: 32 },
  shift: { key: "Shift", code: "ShiftLeft", keyCode: 16, shiftKey: true },
  tab: { key: "Tab", code: "Tab", keyCode: 9 },
  enter: { key: "Enter", code: "Enter", keyCode: 13 },
  backspace: { key: "Backspace", code: "Backspace", keyCode: 8 },
};

const KEY_DISPLAY_NAMES = {
  space: "Space",
  shift: "Shift",
  tab: "Tab",
  enter: "Enter",
  backspace: "Backspace",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  control: "Ctrl",
  alt: "Alt",
  capslock: "Caps Lock",
  escape: "Esc",
};

function normalizeKey(e) {
  if (e.key === " ") return "space";
  if (/^Digit\d$/.test(e.code)) return e.code.slice(5);
  return e.key.toLowerCase();
}

const MODIFIER_KEYS = new Set(["control", "alt", "shift", "meta"]);

function comboFromEvent(e) {
  const key = normalizeKey(e);
  if (MODIFIER_KEYS.has(key)) return null;
  const parts = [];
  if (e.ctrlKey) parts.push("ctrl");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  if (e.metaKey) parts.push("meta");
  parts.push(key);
  return parts.join("+");
}

const MODIFIER_DISPLAY_NAMES = { ctrl: "Ctrl", alt: "Alt", shift: "Shift", meta: "Cmd" };

function displayKeyName(canonical) {
  if (!canonical) return "?";
  if (KEY_DISPLAY_NAMES[canonical]) return KEY_DISPLAY_NAMES[canonical];
  return canonical.length === 1 ? canonical.toUpperCase() : canonical;
}

function displayCombo(combo) {
  if (!combo) return "?";
  const parts = combo.split("+");
  const mainKey = parts.pop();
  const modLabels = parts.map((p) => MODIFIER_DISPLAY_NAMES[p] || p);
  return [...modLabels, displayKeyName(mainKey)].join(" + ");
}

function buildDefaultSettings() {
  const actions = {};
  ACTIONS.forEach((a) => {
    actions[a.id] = { enabled: true, key: a.defaultKey };
  });
  const special = {};
  SPECIAL_FEATURES.forEach((f) => {
    special[f.id] = { enabled: true, key: f.defaultKey };
  });
  return { actions, special, conveyor: { on: true, combo: "ctrl+k" }, updatedAt: 0 };
}

function mergeSettings(stored) {
  const defaults = buildDefaultSettings();
  const merged = { actions: {}, special: {}, conveyor: {} };
  ACTIONS.forEach((a) => {
    merged.actions[a.id] = {
      ...defaults.actions[a.id],
      ...((stored && stored.actions && stored.actions[a.id]) || {}),
    };
  });
  SPECIAL_FEATURES.forEach((f) => {
    merged.special[f.id] = {
      ...defaults.special[f.id],
      ...((stored && stored.special && stored.special[f.id]) || {}),
    };
  });
  merged.conveyor = { ...defaults.conveyor, ...((stored && stored.conveyor) || {}) };
  merged.updatedAt = Number(stored && stored.updatedAt) || 0;
  return merged;
}

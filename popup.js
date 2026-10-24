let settings = buildDefaultSettings();
let listeningFor = null;
let errorState = null;
let pendingModifier = null;

const listEl = document.getElementById("keybindList");
const statusEl = document.getElementById("status");
const resetBtn = document.getElementById("resetBtn");
const conflictWarningEl = document.getElementById("conflictWarning");

let statusTimer = null;
function showStatus(text) {
  statusEl.textContent = text;
  statusEl.classList.add("visible");
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    statusEl.classList.remove("visible");
  }, 900);
}

function save() {
  settings.updatedAt = Date.now();
  chrome.storage.sync.set({ repulsSettings: settings }, () => showStatus("Saved"));
}

function currentKeyFor(kind, id) {
  if (kind === "conveyor") return settings.conveyor.combo;
  return (kind === "special" ? settings.special[id] : settings.actions[id]).key;
}

function displayFor(kind, value) {
  return kind === "conveyor" ? displayCombo(value) : displayKeyName(value);
}

function cancelListening() {
  if (listeningFor && listeningFor.buttonEl) {
    listeningFor.buttonEl.classList.remove("listening");
    listeningFor.buttonEl.textContent = displayFor(
      listeningFor.kind,
      currentKeyFor(listeningFor.kind, listeningFor.id)
    );
  }
  listeningFor = null;
}

function makeKeyButton(kind, meta) {
  const keyBtn = document.createElement("button");
  keyBtn.className = "key-btn";
  keyBtn.type = "button";
  keyBtn.textContent = displayFor(kind, currentKeyFor(kind, meta.id));

  keyBtn.addEventListener("click", () => {
    cancelListening();
    clearError();
    pendingModifier = null;
    listeningFor = { kind, id: meta.id, buttonEl: keyBtn };
    keyBtn.classList.add("listening");
    keyBtn.textContent = kind === "conveyor" ? "Press a combo" : "Press any key";
  });

  return keyBtn;
}

function makeActionRow(meta) {
  const row = document.createElement("div");
  row.className = "row";

  const textWrap = document.createElement("div");
  textWrap.className = "row-text";
  const title = document.createElement("strong");
  title.textContent = meta.label;
  textWrap.appendChild(title);

  row.appendChild(textWrap);
  row.appendChild(makeKeyButton("action", meta));
  return row;
}

function makeSpecialRow(meta) {
  const cfg = settings.special[meta.id];
  const row = document.createElement("div");
  row.className = "row";

  const switchLabel = document.createElement("label");
  switchLabel.className = "switch";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = !!cfg.enabled;
  const slider = document.createElement("span");
  slider.className = "slider";
  switchLabel.appendChild(checkbox);
  switchLabel.appendChild(slider);

  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      const owners = ownersOf(cfg.key, "special", meta.id);
      if (owners.length) {
        checkbox.checked = false;
        const btn = row.querySelector(".key-btn");
        clearError();
        btn.classList.add("error");
        shake(btn);
        errorState = { btn, kind: "special", id: meta.id };
        showWarning(`⚠ "${displayKeyName(cfg.key)}" is already used by ${owners[0]}. Choose a different key first.`);
        return;
      }
    }
    cfg.enabled = checkbox.checked;
    save();
    checkKeyConflicts();
  });

  const textWrap = document.createElement("div");
  textWrap.className = "row-text";
  const title = document.createElement("strong");
  title.textContent = meta.label;
  textWrap.appendChild(title);
  if (meta.desc) {
    const desc = document.createElement("span");
    desc.className = "row-desc";
    desc.textContent = meta.desc;
    textWrap.appendChild(desc);
  }

  row.appendChild(switchLabel);
  row.appendChild(textWrap);
  row.appendChild(makeKeyButton("special", meta));
  return row;
}

const GROUP_ICONS = {
  Scope: '<svg viewBox="0 0 16 16" width="11" height="11"><circle cx="8" cy="8" r="4.5" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="8" r="1.1" fill="currentColor"/><line x1="8" y1="0.5" x2="8" y2="2.6" stroke="currentColor" stroke-width="1.4"/><line x1="8" y1="13.4" x2="8" y2="15.5" stroke="currentColor" stroke-width="1.4"/><line x1="0.5" y1="8" x2="2.6" y2="8" stroke="currentColor" stroke-width="1.4"/><line x1="13.4" y1="8" x2="15.5" y2="8" stroke="currentColor" stroke-width="1.4"/></svg>',
  Sprint: '<svg viewBox="0 0 16 16" width="11" height="11"><path d="M1 4 L7 8 L1 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 4 L14 8 L8 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  Fire: '<svg viewBox="0 0 16 16" width="11" height="11"><path d="M8 1 C 6 4, 5 6, 6.5 8 C 5.2 8, 4.5 6.8, 4.5 6.8 C 3.6 8.4, 4 11, 6 12.5 C 5.6 11.5, 5.7 10.7, 6.3 10 C 6.8 11.2, 8 11.6, 8 11.6 C 8 10.6, 8.4 10, 8.4 10 C 9 11, 9.6 11.5, 9.4 12.8 C 11 11.4, 11.6 9, 10.6 7 C 10.2 7.6, 9.6 7.8, 9.6 7.8 C 10 5.6, 9 3, 8 1 Z" fill="currentColor"/></svg>',
};

function makeDivider(text) {
  const div = document.createElement("div");
  div.className = "divider";
  const icon = document.createElement("span");
  icon.className = "divider-icon";
  icon.innerHTML = GROUP_ICONS[text] || "";
  const label = document.createElement("span");
  label.textContent = text;
  div.appendChild(icon);
  div.appendChild(label);
  return div;
}

function render() {
  errorState = null;
  listEl.innerHTML = "";
  let rowIndex = 0;

  const stampIndex = (el) => {
    el.style.setProperty("--row-index", rowIndex);
    rowIndex++;
    return el;
  };

  ACTIONS.forEach((meta) => listEl.appendChild(stampIndex(makeActionRow(meta))));

  let lastGroup = null;
  SPECIAL_FEATURES.forEach((meta) => {
    if (meta.group !== lastGroup) {
      listEl.appendChild(stampIndex(makeDivider(meta.group)));
      lastGroup = meta.group;
    }
    listEl.appendChild(stampIndex(makeSpecialRow(meta)));
  });

  checkKeyConflicts();
}

function checkKeyConflicts() {
  const owners = {};
  ACTIONS.forEach((a) => {
    const k = settings.actions[a.id].key;
    (owners[k] = owners[k] || []).push(a.label);
  });
  SPECIAL_FEATURES.forEach((f) => {
    if (!settings.special[f.id].enabled) return;
    const k = settings.special[f.id].key;
    (owners[k] = owners[k] || []).push(`${f.group} ${f.label}`);
  });

  const conflictKey = Object.keys(owners).find((k) => owners[k].length > 1);
  if (!conflictKey) {
    conflictWarningEl.classList.remove("visible");
    conflictWarningEl.textContent = "";
    return;
  }
  conflictWarningEl.textContent = `⚠ "${displayKeyName(conflictKey)}" is bound to more than one thing: ${owners[conflictKey].join(" & ")}`;
  conflictWarningEl.classList.add("visible");
}

const conveyorSwitch = document.getElementById("conveyorSwitch");
const conveyorKeyBtn = document.getElementById("conveyorKeyBtn");

function renderConveyor() {
  conveyorSwitch.checked = !!settings.conveyor.on;
  conveyorKeyBtn.textContent = displayCombo(settings.conveyor.combo);
}

conveyorSwitch.addEventListener("change", () => {
  settings.conveyor.on = conveyorSwitch.checked;
  save();
});

conveyorKeyBtn.addEventListener("click", () => {
  cancelListening();
  clearError();
  pendingModifier = null;
  listeningFor = { kind: "conveyor", id: null, buttonEl: conveyorKeyBtn };
  conveyorKeyBtn.classList.add("listening");
  conveyorKeyBtn.textContent = "Press a combo";
});

function ownersOf(key, skipKind, skipId) {
  const owners = [];
  ACTIONS.forEach((a) => {
    if (skipKind === "action" && skipId === a.id) return;
    if (settings.actions[a.id].key === key) owners.push(a.label);
  });
  SPECIAL_FEATURES.forEach((f) => {
    if (skipKind === "special" && skipId === f.id) return;
    const cfg = settings.special[f.id];
    if (cfg.enabled && cfg.key === key) owners.push(`${f.group} ${f.label}`);
  });
  if (skipKind !== "conveyor" && settings.conveyor.combo === key) owners.push("Extension On/Off");
  return owners;
}

function showWarning(text) {
  conflictWarningEl.textContent = text;
  conflictWarningEl.classList.add("visible");
}

function shake(btn) {
  btn.classList.remove("shake");
  void btn.offsetWidth;
  btn.classList.add("shake");
  setTimeout(() => btn.classList.remove("shake"), 450);
}

function clearError() {
  if (!errorState) return;
  errorState.btn.classList.remove("error", "shake");
  errorState.btn.textContent = displayFor(errorState.kind, currentKeyFor(errorState.kind, errorState.id));
  errorState = null;
  checkKeyConflicts();
}

function rejectKey(value, text) {
  const { kind, id, buttonEl } = listeningFor;
  buttonEl.classList.remove("listening");
  buttonEl.classList.add("error");
  buttonEl.textContent = displayFor(kind, value);
  shake(buttonEl);
  errorState = { btn: buttonEl, kind, id };
  listeningFor = null;
  showWarning(text);
}

function tryAssign(value) {
  const { kind, id, buttonEl } = listeningFor;
  const owners = ownersOf(value, kind, id);
  if (owners.length) {
    rejectKey(value, `⚠ "${displayFor(kind, value)}" is already used by ${owners[0]}. Choose a different key.`);
    return;
  }
  if (kind === "conveyor") settings.conveyor.combo = value;
  else (kind === "special" ? settings.special[id] : settings.actions[id]).key = value;
  buttonEl.classList.remove("listening");
  buttonEl.textContent = displayFor(kind, value);
  listeningFor = null;
  save();
  checkKeyConflicts();
}

document.addEventListener("keydown", (e) => {
  if (!listeningFor) return;
  e.preventDefault();
  e.stopPropagation();

  if (e.key === "Escape") {
    cancelListening();
    return;
  }

  if (listeningFor.kind === "conveyor") {
    const combo = comboFromEvent(e);
    if (combo) tryAssign(combo);
    return;
  }

  const key = normalizeKey(e);
  const modifiersHeld = [e.ctrlKey, e.altKey, e.shiftKey, e.metaKey].filter(Boolean).length;
  if (MODIFIER_KEYS.has(key)) {
    if (modifiersHeld > 1) {
      pendingModifier = null;
      shake(listeningFor.buttonEl);
      showWarning("⚠ Shortcuts aren't allowed for this. Press a single key.");
    } else if (!e.repeat) {
      pendingModifier = key;
    }
    return;
  }

  pendingModifier = null;
  if (modifiersHeld > 0) {
    shake(listeningFor.buttonEl);
    showWarning("⚠ Shortcuts aren't allowed for this. Press a single key.");
    return;
  }
  tryAssign(key);
});

document.addEventListener("keyup", (e) => {
  if (!listeningFor || listeningFor.kind === "conveyor" || !pendingModifier) return;
  e.preventDefault();
  if (normalizeKey(e) !== pendingModifier) return;
  pendingModifier = null;
  tryAssign(normalizeKey(e));
});

resetBtn.addEventListener("click", () => {
  settings = buildDefaultSettings();
  save();
  render();
  renderConveyor();
});

try {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes.repulsSettings) return;
    settings = mergeSettings(changes.repulsSettings.newValue);
    render();
    renderConveyor();
  });
} catch (err) {}

chrome.storage.sync.get({ repulsSettings: buildDefaultSettings() }, (stored) => {
  settings = mergeSettings(stored.repulsSettings);
  render();
  renderConveyor();
});

const guidePanel = document.getElementById("guidePanel");
const guideBtn = document.getElementById("guideBtn");
const guideCloseBtn = document.getElementById("guideCloseBtn");
const guideDoneBtn = document.getElementById("guideDoneBtn");
const guideBody = guidePanel.querySelector(".guide-body");

function openGuide() {
  cancelListening();
  guideBody.scrollTop = 0;
  guidePanel.classList.add("open");
  guidePanel.setAttribute("aria-hidden", "false");
}

function closeGuide() {
  guidePanel.classList.remove("open");
  guidePanel.setAttribute("aria-hidden", "true");
}

guideBtn.addEventListener("click", openGuide);
guideCloseBtn.addEventListener("click", closeGuide);
guideDoneBtn.addEventListener("click", closeGuide);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !listeningFor && guidePanel.classList.contains("open")) {
    closeGuide();
  }
});

try {
  chrome.storage.local.get({ repulsGuideSeen: false }, (res) => {
    if (res.repulsGuideSeen) return;
    setTimeout(() => {
      openGuide();
      chrome.storage.local.set({ repulsGuideSeen: true });
    }, 1900);
  });
} catch (err) {}

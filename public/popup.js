const SETTINGS_KEY = "settings";
const STATUS_TIMEOUT = 2000;

const defaultSettings = {
  enableMuteButton: true,
  enableBlockButton: true,
  confirmActions: true,
  enableAutoAction: true,
  theme: "auto",
};

const elements = new Map();

async function init() {
  cacheElements();
  await loadSettings();
  attachEventListeners();
}

function cacheElements() {
  const ids = [
    "enableMuteButton",
    "enableBlockButton",
    "confirmActions",
    "enableAutoAction",
    "theme",
    "status",
  ];
  ids.forEach((id) => {
    const element = document.getElementById(id);
    if (element) elements.set(id, element);
  });
}

async function loadSettings() {
  try {
    const { settings = {} } = await chrome.storage.local.get(SETTINGS_KEY);
    const merged = { ...defaultSettings, ...settings };

    for (const [key, value] of Object.entries(merged)) {
      const element = elements.get(key);
      if (element) {
        if (element.type === "checkbox") {
          element.checked = value;
        } else if (element.tagName === "SELECT") {
          element.value = value;
        }
      }
    }
  } catch (error) {
    showStatus("Failed to load settings", "error");
  }
}

async function saveSettings() {
  const settings = {};

  for (const [key, element] of elements) {
    if (key === "status") continue;

    if (element.type === "checkbox") {
      settings[key] = element.checked;
    } else if (element.tagName === "SELECT") {
      settings[key] = element.value;
    }
  }

  try {
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
    showStatus("Settings saved");
  } catch (error) {
    showStatus("Failed to save settings", "error");
  }
}

function showStatus(message, type = "success") {
  const status = elements.get("status");
  if (!status) return;

  status.textContent = message;
  status.className = `status status--${type} show`;

  setTimeout(() => {
    status.classList.remove("show");
  }, STATUS_TIMEOUT);
}

function attachEventListeners() {
  document.addEventListener("change", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") {
      saveSettings();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

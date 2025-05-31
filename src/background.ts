import { Settings, Message, ActionResponse } from "./types";

const STORAGE_SETTINGS_KEY = "settings";
const VALID_ACTIONS = ["mute", "block"] as const;
const TWITTER_USERNAME_PATTERN = /^[a-zA-Z0-9_]{1,15}$/;

const defaultUserSettings: Settings = {
  enableMuteButton: true,
  enableBlockButton: true,
  confirmActions: true,
  enableAutoAction: true,
  theme: "auto",
};

chrome.runtime.onInstalled.addListener(async () => {
  const storedData = await chrome.storage.local.get(STORAGE_SETTINGS_KEY);
  if (!storedData[STORAGE_SETTINGS_KEY]) {
    await chrome.storage.local.set({
      [STORAGE_SETTINGS_KEY]: defaultUserSettings,
    });
  }
});

chrome.runtime.onMessage.addListener(
  (
    request: Message | any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: ActionResponse | Settings) => void,
  ) => {
    if (request.type === "openProfile") {
      executeProfileAction(request)
        .then(sendResponse)
        .catch((error: Error) =>
          sendResponse({ success: false, error: error.message }),
        );
      return true;
    }

    if (request.type === "getSettings") {
      chrome.storage.local
        .get(STORAGE_SETTINGS_KEY)
        .then((data) =>
          sendResponse(data[STORAGE_SETTINGS_KEY] || defaultUserSettings),
        )
        .catch(() => sendResponse(defaultUserSettings));
      return true;
    }

    if (request.type === "autoActionFailed") {
      if (sender.tab?.id) {
        chrome.tabs.remove(sender.tab.id);
      }
    }
  },
);

async function executeProfileAction(request: {
  username: string;
  action: string;
}): Promise<ActionResponse> {
  const { username, action } = request;

  if (!username || !TWITTER_USERNAME_PATTERN.test(username)) {
    throw new Error("Invalid username");
  }

  if (!VALID_ACTIONS.includes(action as any)) {
    throw new Error("Invalid action");
  }

  try {
    await chrome.tabs.create({
      url: `https://x.com/${username}?${action}=true`,
      active: false,
    });

    return { success: true };
  } catch (error) {
    console.error(`[EBX] Failed to open profile for ${action}:`, error);
    throw new Error(`Failed to ${action} user. Please try again.`);
  }
}

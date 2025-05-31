import { ActionType, Settings, Message, ActionResponse } from "./types";

const TWITTER_SELECTORS = {
  TWEET: '[data-testid="tweet"]',
  USER_LINK: 'a[href^="/"][role="link"]:has(> div > span)',
  DROPDOWN_BUTTON: '[data-testid="caret"]',
  USER_ACTIONS: '[data-testid="userActions"]',
  BLOCK_BUTTON: '[data-testid="block"]',
  MUTE_BUTTON: '[data-testid="mute"]',
  CONFIRM_BUTTON: '[data-testid="confirmationSheetConfirm"]',
  CONFIRMATION_DIALOG: '[data-testid="confirmationSheetDialog"]',
  PRIMARY_COLUMN: '[data-testid="primaryColumn"]',
  PLACEMENT_TRACKING: '[data-testid="placementTracking"]',
} as const;

const EXTENSION_BUTTON_CLASS = "ebx-action-button";
const PROCESSED_TWEET_ATTRIBUTE = "data-ebx-processed";

const defaultUserSettings: Settings = {
  enableMuteButton: true,
  enableBlockButton: true,
  confirmActions: true,
  enableAutoAction: true,
  theme: "auto",
};

let currentUserSettings: Settings = { ...defaultUserSettings };
const processedTweets = new WeakSet<Element>();
let tweetObserver: MutationObserver | null = null;
let isProcessingAutoAction = false;
let hasAutoActionCompleted = false;

async function initializeExtension(): Promise<void> {
  await loadUserSettings();
  setupMessageListeners();

  if (isUserProfilePage()) {
    checkForAutoActionParameters();
  }

  startTweetObserver();
}

function isUserProfilePage(): boolean {
  const pathSegments = window.location.pathname.split("/");

  return (
    pathSegments.length >= 2 &&
    Boolean(pathSegments[1]) &&
    !pathSegments[1].includes("?") &&
    ![
      "home",
      "explore",
      "notifications",
      "messages",
      "bookmarks",
      "lists",
      "i",
    ].includes(pathSegments[1])
  );
}

function checkForAutoActionParameters(): void {
  if (!currentUserSettings.enableAutoAction) return;

  const urlParameters = new URLSearchParams(window.location.search);
  const shouldBlockUser = urlParameters.get("block") === "true";
  const shouldMuteUser = urlParameters.get("mute") === "true";

  if (shouldBlockUser || shouldMuteUser) {
    isProcessingAutoAction = true;
    const actionToPerform = shouldBlockUser ? "block" : "mute";

    waitForUserActionsButton(actionToPerform);
  }
}

async function waitForUserActionsButton(
  actionToPerform: ActionType,
): Promise<void> {
  const maxAttempts = 50;
  let currentAttempt = 0;

  const checkForButton = setInterval(() => {
    currentAttempt++;

    const pageContent = document.querySelector(
      TWITTER_SELECTORS.PRIMARY_COLUMN,
    );
    if (pageContent?.textContent?.includes("Something went wrong")) {
      clearInterval(checkForButton);
      chrome.runtime.sendMessage({ type: "autoActionFailed" });
      window.close();
      return;
    }

    const placementTracker = document.querySelector(
      TWITTER_SELECTORS.PLACEMENT_TRACKING,
    );
    if (
      placementTracker?.querySelector(`[data-testid*="un${actionToPerform}"]`)
    ) {
      clearInterval(checkForButton);
      window.close();
      return;
    }

    const userActionsButton = document.querySelector(
      TWITTER_SELECTORS.USER_ACTIONS,
    ) as HTMLElement;
    if (userActionsButton && !hasAutoActionCompleted) {
      clearInterval(checkForButton);

      userActionsButton.click();

      setTimeout(() => {
        executeActionFromMenu(actionToPerform);
      }, 300);
    }

    if (currentAttempt >= maxAttempts) {
      clearInterval(checkForButton);
      chrome.runtime.sendMessage({ type: "autoActionFailed" });
      window.close();
    }
  }, 100);
}

function executeActionFromMenu(actionToPerform: ActionType): void {
  const actionButton =
    actionToPerform === "mute"
      ? (document.querySelector(TWITTER_SELECTORS.MUTE_BUTTON) as HTMLElement)
      : (document.querySelector(TWITTER_SELECTORS.BLOCK_BUTTON) as HTMLElement);

  if (actionButton) {
    actionButton.click();

    setTimeout(() => {
      const confirmationButton = document.querySelector(
        TWITTER_SELECTORS.CONFIRM_BUTTON,
      ) as HTMLElement;
      if (confirmationButton) {
        confirmationButton.click();
        hasAutoActionCompleted = true;

        setTimeout(() => {
          window.close();
        }, 500);
      }
    }, 300);
  } else {
    chrome.runtime.sendMessage({ type: "autoActionFailed" });
    window.close();
  }
}

async function loadUserSettings(): Promise<void> {
  try {
    const storedSettings = await chrome.storage.local.get("settings");
    if (storedSettings.settings) {
      currentUserSettings = {
        ...defaultUserSettings,
        ...storedSettings.settings,
      };
    }
  } catch (error) {
    console.error("[EBX] Failed to load settings:", error);
  }
}

function setupMessageListeners(): void {
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.settings?.newValue) {
      currentUserSettings = {
        ...defaultUserSettings,
        ...changes.settings.newValue,
      };
      reprocessAllTweets();
    }
  });

  chrome.runtime.onMessage.addListener(
    (request: Message, _sender, sendResponse) => {
      if (request.type === "executeAction") {
        sendResponse({
          success: false,
          error: "Direct execution not supported",
        });
        return true;
      }
    },
  );
}

function startTweetObserver(): void {
  tweetObserver = new MutationObserver((mutations) => {
    if (isProcessingAutoAction) return;

    const tweetsToProcess = new Set<Element>();

    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;

            if (element.matches(TWITTER_SELECTORS.TWEET)) {
              tweetsToProcess.add(element);
            }

            element
              .querySelectorAll(TWITTER_SELECTORS.TWEET)
              .forEach((tweet) => {
                tweetsToProcess.add(tweet);
              });
          }
        });
      }
    }

    if (tweetsToProcess.size > 0) {
      requestAnimationFrame(() => {
        tweetsToProcess.forEach(addActionButtonsToTweet);
      });
    }
  });

  tweetObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });

  document
    .querySelectorAll(TWITTER_SELECTORS.TWEET)
    .forEach(addActionButtonsToTweet);
}

function addActionButtonsToTweet(tweetElement: Element): void {
  if (processedTweets.has(tweetElement)) return;

  const dropdownButton = tweetElement.querySelector(
    TWITTER_SELECTORS.DROPDOWN_BUTTON,
  );
  if (!dropdownButton) return;

  const tweetAuthorUsername = extractUsernameFromTweet(tweetElement);
  if (!tweetAuthorUsername) return;

  const buttonContainer = createActionButtonContainer(tweetAuthorUsername);
  dropdownButton.parentElement?.insertBefore(buttonContainer, dropdownButton);

  processedTweets.add(tweetElement);
  tweetElement.setAttribute(PROCESSED_TWEET_ATTRIBUTE, "true");
}

function extractUsernameFromTweet(tweetElement: Element): string | null {
  const authorLink = tweetElement.querySelector(TWITTER_SELECTORS.USER_LINK);
  if (!authorLink) return null;

  const profileHref = authorLink.getAttribute("href");
  if (!profileHref || profileHref === "/") return null;

  return profileHref.substring(1).split("/")[0].split("?")[0];
}

function createActionButtonContainer(username: string): HTMLElement {
  const container = document.createElement("div");
  container.className = "ebx-container";

  if (currentUserSettings.enableMuteButton) {
    container.appendChild(createActionButton("mute", username));
  }

  if (currentUserSettings.enableBlockButton) {
    container.appendChild(createActionButton("block", username));
  }

  return container;
}

function createActionButton(
  actionType: ActionType,
  username: string,
): HTMLElement {
  const button = document.createElement("button");
  button.className = `${EXTENSION_BUTTON_CLASS} ${EXTENSION_BUTTON_CLASS}--${actionType}`;
  button.setAttribute("aria-label", `${actionType} @${username}`);
  button.title = `${actionType.charAt(0).toUpperCase() + actionType.slice(1)} @${username}`;

  button.innerHTML =
    actionType === "mute"
      ? '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M18 6.59V1.2L8.71 7H5.5C4.12 7 3 8.12 3 9.5v5C3 15.88 4.12 17 5.5 17h2.09l-2.3 2.29 1.42 1.42 15.5-15.5-1.42-1.42L18 6.59zm-8 8V8.55l6-3.75v3.79l-6 6zM5 9.5c0-.28.22-.5.5-.5H8v6H5.5c-.28 0-.5-.22-.5-.5v-5zm6.5 9.24l1.45-1.45L16 19.2V14l2 .02v8.78l-6.5-4.06z"/></svg>'
      : '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 3.75c-4.55 0-8.25 3.69-8.25 8.25 0 1.92.66 3.68 1.75 5.08L17.09 5.5C15.68 4.4 13.92 3.75 12 3.75zm6.5 3.17L6.92 18.5c1.4 1.1 3.16 1.75 5.08 1.75 4.56 0 8.25-3.69 8.25-8.25 0-1.92-.65-3.68-1.75-5.08zM1.75 12C1.75 6.34 6.34 1.75 12 1.75S22.25 6.34 22.25 12 17.66 22.25 12 22.25 1.75 17.66 1.75 12z"/></svg>';

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    handleActionButtonClick(actionType, username, button);
  });

  return button;
}

async function handleActionButtonClick(
  actionType: ActionType,
  username: string,
  buttonElement: HTMLElement,
): Promise<void> {
  if (currentUserSettings.confirmActions) {
    const userConfirmed = confirm(
      `Are you sure you want to ${actionType} @${username}?`,
    );
    if (!userConfirmed) return;
  }

  const buttonAsInput = buttonElement as HTMLButtonElement;
  buttonAsInput.disabled = true;
  buttonElement.classList.add(`${EXTENSION_BUTTON_CLASS}--loading`);

  try {
    const response = (await chrome.runtime.sendMessage({
      type: "openProfile",
      action: actionType,
      username,
    })) as ActionResponse;

    if (response.success) {
      buttonElement.classList.add(`${EXTENSION_BUTTON_CLASS}--success`);
      setTimeout(() => {
        buttonElement.style.display = "none";
      }, 1000);
    } else {
      throw new Error(response.error || "Action failed");
    }
  } catch (error) {
    console.error(`[EBX] ${actionType} failed:`, error);
    buttonElement.classList.add(`${EXTENSION_BUTTON_CLASS}--error`);
    buttonAsInput.disabled = false;
    setTimeout(() => {
      buttonElement.classList.remove(
        `${EXTENSION_BUTTON_CLASS}--loading`,
        `${EXTENSION_BUTTON_CLASS}--error`,
      );
    }, 2000);
  }
}

function reprocessAllTweets(): void {
  document
    .querySelectorAll(".ebx-container")
    .forEach((element) => element.remove());

  document
    .querySelectorAll(TWITTER_SELECTORS.TWEET)
    .forEach(addActionButtonsToTweet);
}

function cleanupResources(): void {
  tweetObserver?.disconnect();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeExtension);
} else {
  initializeExtension();
}

window.addEventListener("unload", cleanupResources);

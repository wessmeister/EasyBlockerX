export type ActionType = "mute" | "block";

export interface Settings {
  enableMuteButton: boolean;
  enableBlockButton: boolean;
  confirmActions: boolean;
  enableAutoAction: boolean;
  theme: "auto" | "light" | "dark";
}

export interface ActionMessage {
  type: "performAction";
  action: ActionType;
  username: string;
  isAutoAction?: boolean;
}

export interface ExecuteActionMessage {
  type: "executeAction";
  action: ActionType;
  username: string;
  isAutoAction?: boolean;
}

export interface GetSettingsMessage {
  type: "getSettings";
}

export interface OpenProfileMessage {
  type: "openProfile";
  action: ActionType;
  username: string;
}

export interface AutoActionFailedMessage {
  type: "autoActionFailed";
}

export type Message =
  | ActionMessage
  | ExecuteActionMessage
  | GetSettingsMessage
  | OpenProfileMessage
  | AutoActionFailedMessage;

export interface ActionResponse {
  success: boolean;
  error?: string;
  result?: unknown;
}

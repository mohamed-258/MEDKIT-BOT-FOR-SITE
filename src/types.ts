export interface Setting {
  botToken: string;
  adminChatId: string;
  welcomeMessage: string;
  seededMenus?: boolean;
  dashboardPassword?: string; // Password to access the dashboard
  devPollingEnabled?: boolean; // toggle for local development polling
  activeInstanceUrl?: string; // The URL of the instance allowed to respond to Telegram
  masterInstanceId?: string; // The ID of the instance allowed to process Telegram updates
}

export interface SupportMessage {
  id: string;
  telegramUserId: string;
  telegramUsername: string;
  telegramName: string;
  messageText: string;
  messagePhotoUrl?: string;
  createdAt: string;
  replied: boolean;
  replyText?: string;
  repliedAt?: string;
}

export interface Menu {
  id: string;
  title: string;
  price: string;
  description: string;
  details: string;
}

export interface Ticket {
  id: string;
  telegramUserId: string;
  telegramUsername: string;
  telegramName: string;
  email: string;
  menuId: string;
  menuTitle: string;
  price?: string;
  receiptPhotoUrl: string; // Base64 data URL
  status: 'new' | 'approved' | 'rejected';
  adminComment: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserSession {
  telegramUserId: string;
  telegramUsername: string;
  telegramName: string;
  state: 'idle' | 'awaiting_email' | 'awaiting_receipt' | 'support';
  // حقول إضافية تستخدمها server.ts (step-based session)
  step?: 'idle' | 'awaiting_info' | 'awaiting_receipt';
  selectedPlanId?: string;
  email?: string | null;
  menuId?: string | null;
  menuTitle?: string | null;
  updatedAt: string;
}

// --- New Types added for the Render Bot ---
export interface AutoResponse {
  id: string;
  trigger: string;
  response: string;
  buttonType?: 'reply' | 'inline';
  buttonColumns?: number;
  buttons?: any[];
}

export interface BotSettings {
  token: string;
  webhookEnabled: boolean;
  aiEnabled: boolean;
  aiSystemPrompt: string;
  autoResponses: AutoResponse[];
  adminPassword?: string;
}

export interface TelegramUser {
  id: string;
  first_name: string;
  username: string;
  last_interaction: string;
  is_simulated: boolean;
}

export interface BotMessage {
  id: string;
  userId: string;
  username: string;
  text: string;
  type: 'incoming' | 'outgoing';
  sender: 'user' | 'bot_rule' | 'ai' | 'bot_manual';
  timestamp: string;
  ruleId?: string;
  buttons?: any[];
  buttonType?: string;
  buttonColumns?: number;
}

export interface BroadcastLog {
  id: string;
  text: string;
  timestamp: string;
  recipientCount: number;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

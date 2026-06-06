export interface Setting {
  botToken: string;
  adminChatId: string;
  welcomeMessage: string;
  seededMenus?: boolean;
  allowedEmails?: string[]; // list of emails authorized to access the dashboard
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
  menuId?: string | null;
  menuTitle?: string | null;
  email?: string | null;
  updatedAt: string;
}

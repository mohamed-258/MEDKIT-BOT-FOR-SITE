import fs from "fs";
import path from "path";
import admin from "firebase-admin";

const LOCAL_DB_PATH = path.join(process.cwd(), "local-db.json");

interface Setting {
  botToken: string;
  adminChatId: string;
  welcomeMessage: string;
  seededMenus?: boolean;
  allowedEmails?: string[];
}

interface Menu {
  id: string;
  title: string;
  price: string;
  description: string;
  details: string;
}

interface SupportMessage {
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

interface Ticket {
  id: string;
  userId: string;
  username: string;
  fullName: string;
  planId: string;
  planTitle: string;
  email: string;
  transactionImage: string;
  status: string;
  adminComment: string;
  createdAt: string;
  updatedAt: string;
  telegramUserId?: string;
  telegramUsername?: string;
  telegramName?: string;
  menuTitle?: string;
  menuId?: string;
  receiptPhotoUrl?: string;
}

interface Session {
  userId: string;
  step: string;
  selectedPlanId?: string;
  email?: string;
  transactionImage?: string;
}

interface LocalDB {
  settings: Record<string, Setting>;
  menus: Record<string, Menu>;
  tickets: Record<string, Ticket>;
  sessions: Record<string, Session>;
  supportMessages?: Record<string, SupportMessage>;
}

const DEFAULT_DB: LocalDB = {
  settings: {
    global: {
      botToken: "",
      adminChatId: "",
      welcomeMessage: "أهلاً بك في بوت تفعيل اشتراكات منصة ميدكيت (MedKit) المعتمد! 🏥✨\n\nيرجى تحديد خطة الاشتراك المراد تفعيلها من القائمة بالأسفل لعرض تفاصيلها وطريقة التحويل وسنقوم بتفعيل حسابك فوراً:",
      allowedEmails: []
    }
  },
  menus: {
    mid_rrs: {
      id: "mid_rrs",
      title: "mid RRS",
      price: "300 جنيه مصري",
      description: "باقة كود التشخيص والمراجعة السريعة RRS (سنتين)",
      details: "📍 باقة تفعيل كود منصة ميدكيت الطبية RRS:\n\nتشمل باقة التفعيل الميزات التالية:\n🟢 صلاحية كاملة لمدة سنتين كاملتين (24 شهراً).\n🟢 الوصول السريع إلى تشخيص الحالات والدعم اللا محدود.\n🟢 كود مراجعة مخصص.\n\n💰 قيمة الاشتراك: 300 جنيه مصري فقط.\n\n👈 لإتمام التفعيل، يرجى كتابة بريدك الإلكتروني المسجل في المنصة بالأسفل."
    },
    mid_ecg: {
      id: "mid_ecg",
      title: "mid ECG",
      price: "200 جنيه مصري",
      description: "باقة كورس رسم القلب واشتراك 12 شهر",
      details: "📍 باقة التفعيل لكورس رسم القلب الشامل mid ECG:\n\nتشمل الباقة الميزات التالية:\n🟢 كورس رسم القلب الشامل لجميع المستويات.\n🟢 صلاحية وصول للمواد الطبية لمدة 12 شهر.\n🟢 شهادة إتمام رقمية مجانية للطلاب والممارسين.\n\n💰 قيمة الاشتراك: 200 جنيه مصري فقط.\n\n👈 لإتمام التفعيل، يرجى كتابة بريدك الإلكتروني المسجل في المنصة بالأسفل."
    },
    mid_premium: {
      id: "mid_premium",
      title: "mid Premium الشامل",
      price: "500 جنيه مصري",
      description: "الاشتراك المميز لكافة كورسات وخدمات منصة ميدكيت",
      details: "📍 باقة التفعيل الشاملة mid Premium:\n\nتشمل هذه الباقة الحصرية الميزات التالية:\n🟢 الوصول لكافة الكورسات الطبية المتاحة بالمنصة والمستقبلية.\n🟢 تفعيل كود RRS وكورس ECG مدى الحياة.\n🟢 دعم طبي واستشارات فنية VIP.\n\n💰 قيمة الاشتراك: 500 جنيه مصري فقط.\n\n👈 لإتمام التفعيل، يرجى كتابة بريدك الإلكتروني المسجل في المنصة بالأسفل."
    }
  },
  tickets: {},
  sessions: {},
  supportMessages: {}
};

// Read JSON DB
function readLocalDB(): LocalDB {
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const data = fs.readFileSync(LOCAL_DB_PATH, "utf-8");
      return { ...DEFAULT_DB, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error("Failed to read local DB, fallback to default:", error);
  }
  return DEFAULT_DB;
}

// Write JSON DB
function writeLocalDB(db: LocalDB) {
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(db, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to write local DB:", error);
  }
}

// Check if Firestore is Operational (not disabled or permissions denied)
let firestoreWorking = true;

export async function checkDatabaseStatus(firestoreInstance: admin.firestore.Firestore): Promise<boolean> {
  try {
    // Try to get setting/global with a short 2s timeout
    const testPromise = firestoreInstance.collection("settings").doc("global").get();
    const timeoutPromise = new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Timeout")), 2500));
    const snap = await Promise.race([testPromise, timeoutPromise]);
    firestoreWorking = snap.exists || !snap.exists; // operational
    console.log(`Database Link: FIRESTORE ACTIVE (operational=${firestoreWorking})`);
  } catch (err: any) {
    console.error("Database Link: FIRESTORE RESTRICTED (using local JSON storage layer). Error:", err.message);
    firestoreWorking = false;
  }
  return firestoreWorking;
}

// Expose Methods with Auto Fallback
export class DatabaseController {
  private fsDb: admin.firestore.Firestore;

  constructor(fsDb: admin.firestore.Firestore) {
    this.fsDb = fsDb;
  }

  // settings/global
  async getSettings(): Promise<Setting> {
    if (firestoreWorking) {
      try {
        const snap = await this.fsDb.collection("settings").doc("global").get();
        if (snap.exists) {
          return snap.data() as Setting;
        }
      } catch (err) {
        console.warn("Firestore getSettings failed, using fallback:", err);
        firestoreWorking = false;
      }
    }
    const ldb = readLocalDB();
    return ldb.settings.global;
  }

  async saveSettings(settings: Setting): Promise<void> {
    const ldb = readLocalDB();
    const existing = ldb.settings.global || {};
    const updated = { ...existing, ...settings };

    if (firestoreWorking) {
      try {
        await this.fsDb.collection("settings").doc("global").set(updated, { merge: true });
      } catch (err) {
        console.warn("Firestore saveSettings failed, using fallback:", err);
        firestoreWorking = false;
      }
    }
    ldb.settings.global = updated;
    writeLocalDB(ldb);
  }

  // menus
  async getMenus(): Promise<Menu[]> {
    if (firestoreWorking) {
      try {
        const snap = await this.fsDb.collection("menus").get();
        const list: Menu[] = [];
        if (!snap.empty) {
          snap.forEach((doc) => {
            list.push({ id: doc.id, ...doc.data() } as Menu);
          });
        }
        return list;
      } catch (err) {
        console.warn("Firestore getMenus failed, using fallback:", err);
        firestoreWorking = false;
      }
    }
    const ldb = readLocalDB();
    return Object.values(ldb.menus);
  }

  async saveMenu(menu: Menu): Promise<void> {
    if (firestoreWorking) {
      try {
        await this.fsDb.collection("menus").doc(menu.id).set(menu);
      } catch (err) {
        console.warn("Firestore saveMenu failed, using fallback:", err);
        firestoreWorking = false;
      }
    }
    const ldb = readLocalDB();
    ldb.menus[menu.id] = menu;
    writeLocalDB(ldb);
  }

  async deleteMenu(id: string): Promise<void> {
    if (firestoreWorking) {
      try {
        await this.fsDb.collection("menus").doc(id).delete();
      } catch (err) {
        console.warn("Firestore deleteMenu failed, using fallback:", err);
        firestoreWorking = false;
      }
    }
    const ldb = readLocalDB();
    delete ldb.menus[id];
    writeLocalDB(ldb);
  }

  // tickets
  async getTickets(): Promise<Ticket[]> {
    if (firestoreWorking) {
      try {
        const snap = await this.fsDb.collection("tickets").orderBy("createdAt", "desc").get();
        const list: Ticket[] = [];
        snap.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Ticket);
        });
        return list;
      } catch (err) {
        console.warn("Firestore getTickets failed, using fallback:", err);
        firestoreWorking = false;
      }
    }
    const ldb = readLocalDB();
    return Object.values(ldb.tickets).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async saveTicket(ticket: Ticket): Promise<void> {
    if (firestoreWorking) {
      try {
        await this.fsDb.collection("tickets").doc(ticket.id).set(ticket);
      } catch (err) {
        console.warn("Firestore saveTicket failed, using fallback:", err);
        firestoreWorking = false;
      }
    }
    const ldb = readLocalDB();
    ldb.tickets[ticket.id] = ticket;
    writeLocalDB(ldb);
  }

  async getTicket(id: string): Promise<Ticket | null> {
    if (firestoreWorking) {
      try {
        const snap = await this.fsDb.collection("tickets").doc(id).get();
        if (snap.exists) {
          return { id: snap.id, ...snap.data() } as Ticket;
        }
      } catch (err) {
        console.warn("Firestore getTicket failed, using fallback:", err);
        firestoreWorking = false;
      }
    }
    const ldb = readLocalDB();
    return ldb.tickets[id] || null;
  }

  // sessions (Telegram bot session tracking)
  async getSession(userId: string): Promise<Session> {
    if (firestoreWorking) {
      try {
        const snap = await this.fsDb.collection("sessions").doc(userId).get();
        if (snap.exists) {
          return { userId, ...snap.data() } as Session;
        }
      } catch (err) {
        console.warn("Firestore getSession failed, using fallback:", err);
        firestoreWorking = false;
      }
    }
    const ldb = readLocalDB();
    return ldb.sessions[userId] || { userId, step: "idle" };
  }

  async saveSession(session: Session): Promise<void> {
    if (firestoreWorking) {
      try {
        await this.fsDb.collection("sessions").doc(session.userId).set(session);
      } catch (err) {
        console.warn("Firestore saveSession failed, using fallback:", err);
        firestoreWorking = false;
      }
    }
    const ldb = readLocalDB();
    ldb.sessions[session.userId] = session;
    writeLocalDB(ldb);
  }

  // support messages
  async getSupportMessages(): Promise<SupportMessage[]> {
    if (firestoreWorking) {
      try {
        const snap = await this.fsDb.collection("support_messages").orderBy("createdAt", "desc").get();
        const list: SupportMessage[] = [];
        snap.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as SupportMessage);
        });
        return list;
      } catch (err) {
        console.warn("Firestore getSupportMessages failed, using fallback:", err);
        firestoreWorking = false;
      }
    }
    const ldb = readLocalDB();
    if (!ldb.supportMessages) ldb.supportMessages = {};
    return Object.values(ldb.supportMessages).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async saveSupportMessage(msg: SupportMessage): Promise<void> {
    if (firestoreWorking) {
      try {
        await this.fsDb.collection("support_messages").doc(msg.id).set(msg);
      } catch (err) {
        console.warn("Firestore saveSupportMessage failed, using fallback:", err);
        firestoreWorking = false;
      }
    }
    const ldb = readLocalDB();
    if (!ldb.supportMessages) ldb.supportMessages = {};
    ldb.supportMessages[msg.id] = msg;
    writeLocalDB(ldb);
  }

  async deleteSupportMessage(id: string): Promise<void> {
    if (firestoreWorking) {
      try {
        await this.fsDb.collection("support_messages").doc(id).delete();
      } catch (err) {
        console.warn("Firestore deleteSupportMessage failed, using fallback:", err);
        firestoreWorking = false;
      }
    }
    const ldb = readLocalDB();
    if (!ldb.supportMessages) ldb.supportMessages = {};
    delete ldb.supportMessages[id];
    writeLocalDB(ldb);
  }
}

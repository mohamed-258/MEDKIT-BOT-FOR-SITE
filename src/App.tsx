import { useState, useEffect, FormEvent } from "react";
import { 
  Bot, Key, LogIn, RefreshCw, AlertCircle, Bold, Italic, Underline, Strikethrough, Code, Quote
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Menu, Ticket as TicketType, Setting, SupportMessage } from "./types";

// Import custom redesigned modular components
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import DashboardOverview from "./components/DashboardOverview";
import DashboardMenus from "./components/DashboardMenus";
import DashboardTickets from "./components/DashboardTickets";
import DashboardSupport from "./components/DashboardSupport";
import DashboardSettings from "./components/DashboardSettings";
import MenuModal from "./components/MenuModal";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem("dashboard_auth") === "true";
  });
  const [checkingAuth, setCheckingAuth] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");

  // DB Sync states
  const [settings, setSettings] = useState<Setting | null>(null);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);

  // Active UI tab
  const [activeTab, setActiveTab] = useState<"overview" | "tickets" | "menus" | "support" | "settings">("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedTicket, setSelectedTicket] = useState<TicketType | null>(null);
  const [ticketToDeleteId, setTicketToDeleteId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replySuccess, setReplySuccess] = useState(false);

  // Support messages states
  const [selectedSupportMessage, setSelectedSupportMessage] = useState<SupportMessage | null>(null);
  const [supportReplyText, setSupportReplyText] = useState("");
  const [submittingSupportReply, setSubmittingSupportReply] = useState(false);
  const [supportReplySuccess, setSupportReplySuccess] = useState(false);
  const [dashboardPasswordInput, setDashboardPasswordInput] = useState("");

  // Webhook and Polling states
  const [webhookStatus, setWebhookStatus] = useState<any>(null);
  const [fetchingWebhook, setFetchingWebhook] = useState(false);
  const [webhookSettingStatus, setWebhookSettingStatus] = useState<"idle" | "success" | "error">("idle");
  const [webhookErrorMsg, setWebhookErrorMsg] = useState("");

  // Global settings inputs
  const [tokenInput, setTokenInput] = useState("");
  const [adminChatIdInput, setAdminChatIdInput] = useState("");
  const [welcomeMsgInput, setWelcomeMsgInput] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Railway DB Cloud Sync states
  const [railwayUrl, setRailwayUrl] = useState(() => localStorage.getItem("sync_railway_url") || "");
  const [syncToken, setSyncToken] = useState(() => localStorage.getItem("sync_token") || "");
  const [syncStatus, setSyncStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [syncMessage, setSyncMessage] = useState("");

  // Menu/Package Editor Modal states
  const [editingMenu, setEditingMenu] = useState<Partial<Menu> | null>(null);
  const [isEditingExistingMenu, setIsEditingExistingMenu] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [menuActionStatus, setMenuActionStatus] = useState<"idle" | "success" | "error">("idle");
  const [menuActionMessage, setMenuActionMessage] = useState("");

  // Copy feedbacks
  const [copiedSetting, setCopiedSetting] = useState<string | null>(null);

  // Helper formatting for Telegram Markdown/HTML
  const insertFormatTag = (
    tag: string,
    value: string,
    setValue: (val: string) => void,
    textareaId: string,
    isExpandableQuote?: boolean
  ) => {
    const textarea = document.getElementById(textareaId) as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);

    let openTag = `<${tag}>`;
    let closeTag = `</${tag}>`;
    
    if (tag === 'blockquote' && isExpandableQuote) {
      openTag = '<blockquote expandable>';
    }

    const replacement = openTag + selectedText + closeTag;
    const newValue = value.substring(0, start) + replacement + value.substring(end);

    setValue(newValue);

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + openTag.length + selectedText.length + closeTag.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 50);
  };

  const insertFormatForMenuDetails = (tag: string, isExpandableQuote?: boolean) => {
    if (!editingMenu) return;
    const currentVal = editingMenu.details || "";
    insertFormatTag(tag, currentVal, (val) => {
      setEditingMenu({ ...editingMenu, details: val });
    }, "menu-details-textarea", isExpandableQuote);
  };

  const renderFormatToolbar = (
    textareaId: string,
    value: string,
    setValue: (val: string) => void,
    customInserter?: (tag: string, isExpandableQuote?: boolean) => void
  ) => {
    const handleInsert = (tag: string, isExpandableQuote?: boolean) => {
      if (customInserter) {
        customInserter(tag, isExpandableQuote);
      } else {
        insertFormatTag(tag, value, setValue, textareaId, isExpandableQuote);
      }
    };

    return (
      <div className="flex flex-wrap items-center gap-1 p-1.5 bg-slate-900 border border-white/5 rounded-t-xl text-xs select-none">
        <button
          type="button"
          onClick={() => handleInsert("b")}
          className="p-1 hover:bg-slate-800 text-slate-300 hover:text-white rounded flex items-center gap-1 cursor-pointer font-bold transition-colors"
          title="عريض (Bold) - <b>"
        >
          <Bold className="h-3 w-3" />
          <span className="text-[10px] hidden md:inline">عريض</span>
        </button>
        <button
          type="button"
          onClick={() => handleInsert("i")}
          className="p-1 hover:bg-slate-800 text-slate-300 hover:text-white rounded flex items-center gap-1 cursor-pointer italic transition-colors"
          title="مائل (Italic) - <i>"
        >
          <Italic className="h-3 w-3" />
          <span className="text-[10px] hidden md:inline">مائل</span>
        </button>
        <button
          type="button"
          onClick={() => handleInsert("u")}
          className="p-1 hover:bg-slate-800 text-slate-300 hover:text-white rounded flex items-center gap-1 cursor-pointer underline transition-colors"
          title="مسطر (Underline) - <u>"
        >
          <Underline className="h-3 w-3" />
          <span className="text-[10px] hidden md:inline">مسطر</span>
        </button>
        <button
          type="button"
          onClick={() => handleInsert("s")}
          className="p-1 hover:bg-slate-800 text-slate-300 hover:text-white rounded flex items-center gap-1 cursor-pointer line-through transition-colors"
          title="مشطوب (Strike) - <s>"
        >
          <Strikethrough className="h-3 w-3" />
          <span className="text-[10px] hidden md:inline">مشطوب</span>
        </button>
        <button
          type="button"
          onClick={() => handleInsert("code")}
          className="p-1 hover:bg-slate-800 text-slate-300 hover:text-white rounded flex items-center gap-1 cursor-pointer font-mono transition-colors"
          title="كود مدمج (Code) - <code>"
        >
          <Code className="h-3 w-3" />
          <span className="text-[10px] hidden md:inline">كود</span>
        </button>
        <button
          type="button"
          onClick={() => handleInsert("pre")}
          className="p-1 hover:bg-slate-800 text-slate-300 hover:text-white rounded flex items-center gap-1 cursor-pointer font-mono transition-colors"
          title="كتلة برمجية (Preformatted) - <pre>"
        >
          <Code className="h-3 w-3 text-cyan-400" />
          <span className="text-[10px] hidden md:inline">كتلة برمجية</span>
        </button>
        <button
          type="button"
          onClick={() => handleInsert("blockquote")}
          className="p-1 hover:bg-slate-800 text-slate-300 hover:text-white rounded flex items-center gap-1 cursor-pointer transition-colors"
          title="اقتباس (Quote) - <blockquote>"
        >
          <Quote className="h-3 w-3" />
          <span className="text-[10px] hidden md:inline">اقتباس</span>
        </button>
        <button
          type="button"
          onClick={() => handleInsert("blockquote", true)}
          className="p-1 hover:bg-slate-800 text-cyan-400 hover:text-cyan-300 rounded flex items-center gap-1 cursor-pointer transition-colors"
          title="اقتباس قابل للطي (Expandable Quote) - <blockquote expandable>"
        >
          <Quote className="h-3 w-3 text-cyan-400" />
          <span className="text-[10px] hidden md:inline">اقتباس مطوي</span>
        </button>
        <div className="mr-auto text-[9px] text-slate-500 font-sans hidden sm:block pl-1">
          تنسيقات تليجرام المدعومة
        </div>
      </div>
    );
  };

  // REST API Loaders
  const fetchRESTSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setSettings((prev) => {
            if (!prev) {
              setTokenInput(data.botToken || "");
              setAdminChatIdInput(data.adminChatId || "");
              setWelcomeMsgInput(data.welcomeMessage || "");
              setDashboardPasswordInput(data.dashboardPassword || "");
            }
            return data;
          });
        }
      }
    } catch (err) {
      console.warn("REST settings fetch failed:", err);
    }
  };

  const fetchRESTMenus = async () => {
    try {
      const res = await fetch("/api/menus");
      if (res.ok) {
        const list = await res.json();
        if (list) {
          setMenus(list);
        }
      }
    } catch (err) {
      console.warn("REST menus fetch failed:", err);
    }
  };

  const fetchRESTTickets = async () => {
    try {
      const res = await fetch("/api/tickets");
      if (res.ok) {
        const list = await res.json();
        if (list) {
          const sorted = list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setTickets(sorted);
        }
      }
    } catch (err) {
      console.warn("REST tickets fetch failed:", err);
    }
  };

  const fetchRESTSupportMessages = async () => {
    try {
      const res = await fetch("/api/support-messages");
      if (res.ok) {
        const list = await res.json();
        if (list) {
          const sorted = list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setSupportMessages(sorted);
        }
      }
    } catch (err) {
      console.warn("REST support messages fetch failed:", err);
    }
  };

  const fetchTelegramWebhookStatus = async () => {
    setFetchingWebhook(true);
    try {
      const res = await fetch("/api/telegram-status");
      const data = await res.json();
      setWebhookStatus(data);
    } catch (err) {
      console.error("Failed to fetch bot webhook state:", err);
    } finally {
      setFetchingWebhook(false);
    }
  };

  // Interval synchronization (realtime feel)
  useEffect(() => {
    fetchRESTSettings();
    fetchRESTMenus();
    fetchRESTTickets();
    fetchRESTSupportMessages();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    fetchRESTSettings();
    const interval = setInterval(fetchRESTSettings, 10000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    fetchRESTSupportMessages();
    const interval = setInterval(fetchRESTSupportMessages, 4000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    fetchRESTMenus();
    const interval = setInterval(fetchRESTMenus, 5000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    fetchRESTTickets();
    const interval = setInterval(fetchRESTTickets, 4000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchTelegramWebhookStatus();
    }
  }, [isAuthenticated, settings]);

  // Handle Login
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setCheckingAuth(true);
    setLoginError("");
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        const correctPassword = data.dashboardPassword || "admin";
        if (passwordInput === correctPassword) {
          localStorage.setItem("dashboard_auth", "true");
          setIsAuthenticated(true);
        } else {
          setLoginError("كلمة المرور غير صحيحة");
        }
      } else {
        setLoginError("فشل استرجاع الإعدادات");
      }
    } catch (error) {
      console.error("Login failed:", error);
      setLoginError("مشكلة في الاتصال بالشبكة");
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("dashboard_auth");
    setIsAuthenticated(false);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSetting(id);
    setTimeout(() => setCopiedSetting(null), 2000);
  };

  // Save Settings
  const saveGlobalSettings = async (e: FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSaveSuccess(false);
    const payload = {
      botToken: tokenInput.trim(),
      adminChatId: adminChatIdInput.trim(),
      welcomeMessage: welcomeMsgInput,
      dashboardPassword: dashboardPasswordInput.trim() || "admin"
    };
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        throw new Error("Failed to save settings via API");
      }

      setSettings(payload);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error("Save global settings errored:", err);
    } finally {
      setSavingSettings(false);
    }
  };

  // Reply to support messages
  const handleReplySupport = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedSupportMessage || !supportReplyText.trim()) return;

    setSubmittingSupportReply(true);
    setSupportReplySuccess(false);

    try {
      const res = await fetch("/api/support-messages/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: selectedSupportMessage.id,
          replyText: supportReplyText
        })
      });

      if (res.ok) {
        setSupportReplySuccess(true);
        setSupportReplyText("");
        fetchRESTSupportMessages();
        setTimeout(() => {
          setSelectedSupportMessage(null);
          setSupportReplySuccess(false);
        }, 1800);
      } else {
        alert("تعذر تسليم الرد تليجرام");
      }
    } catch (err) {
      console.error("Error replying to support message:", err);
    } finally {
      setSubmittingSupportReply(false);
    }
  };

  const handleDeleteSupportMessage = async (msgId: string) => {
    if (!confirm("هل أنت متأكد من رغبتك في حذف رسالة الدعم هذه نهائياً؟")) return;
    try {
      const res = await fetch(`/api/support-messages/${msgId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchRESTSupportMessages();
        if (selectedSupportMessage?.id === msgId) {
          setSelectedSupportMessage(null);
        }
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "فشل حذف الرسالة.");
      }
    } catch (err) {
      console.error("Failed to delete support message:", err);
      alert("حدث خطأ أثناء محاولة الحذف.");
    }
  };

  // Package / Menu Actions
  const transliterateArabicToEnglish = (str: string): string => {
    const map: { [key: string]: string } = {
      'أ': 'a', 'إ': 'a', 'آ': 'a', 'ا': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j',
      'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh',
      'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
      'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'w', 'ي': 'y', 'ى': 'a',
      'ة': 'h', 'ئ': 'e', 'ؤ': 'o', 'لا': 'la'
    };
    return str.split('').map(char => map[char] || char).join('');
  };

  const generateSafeId = (input: string): string => {
    let safe = transliterateArabicToEnglish(input || "");
    safe = safe.toLowerCase().trim().replace(/[^a-z0-9_]/g, "_").replace(/^_+|_+$/g, "");
    if (!safe || safe.length < 2) {
      const randomSuffix = Math.random().toString(36).substring(2, 7);
      safe = `plan_${randomSuffix}`;
    }
    return safe;
  };

  const handleSaveMenu = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingMenu.id || !editingMenu.title) return;
    
    setMenuActionStatus("idle");
    setMenuActionMessage("");
    
    let menuId = isEditingExistingMenu
      ? (editingMenu.id || "").toLowerCase().trim().replace(/[^a-z0-9_]/g, "_").replace(/^_+|_+$/g, "")
      : generateSafeId(editingMenu.id || "");
    
    try {
      if (!menuId || menuId.length < 2) {
        throw new Error("اسم كود الباقة غير صالح أو قصير جداً. يرجى استخدام أحرف إنجليزية وأرقام فقط.");
      }

      const payload = {
        id: menuId,
        title: editingMenu.title,
        price: editingMenu.price || "غير محدد",
        description: editingMenu.description || "",
        details: editingMenu.details || ""
      };

      const res = await fetch("/api/menus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "خطأ أثناء محاولة حفظ وتحديث خطة الاشتراك على المزود.");
      }

      setMenuActionStatus("success");
      setMenuActionMessage("تم حفظ وتحديث باقة الاشتراك بنجاح!");
      setTimeout(() => {
        setMenuActionStatus("idle");
      }, 5000);

      fetchRESTMenus();
      setShowMenuModal(false);
      setEditingMenu(null);
    } catch (err: any) {
      console.error("Save menu errored:", err);
      setMenuActionStatus("error");
      setMenuActionMessage(err.message || "حدث خطأ غير متوقع أثناء حفظ باقة الاشتراك.");
    }
  };

  const handleDeleteMenu = async (id: string) => {
    if (!confirm("هل أنت متأكد من رغبتك في حذف هذه الباقة؟ لن تظهر للمستخدمين على البوت وستتم إزالتها.")) return;
    setMenuActionStatus("idle");
    setMenuActionMessage("");
    try {
      const res = await fetch(`/api/menus/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "فشل حذف الاشتراك من المزود.");
      }

      setMenuActionStatus("success");
      setMenuActionMessage("تم حذف باقة الاشتراك بنجاح!");
      fetchRESTMenus();
      
      setTimeout(() => {
        setMenuActionStatus("idle");
      }, 5000);
    } catch (err: any) {
      console.error("Delete menu errored:", err);
      setMenuActionStatus("error");
      setMenuActionMessage(err.message || "فشل إتمام عملية الحذف.");
    }
  };

  // Sync Database with Railway
  const handleSyncPull = async () => {
    if (!railwayUrl) {
      setSyncStatus("error");
      setSyncMessage("يرجى إدخال رابط سيرفر Railway أولاً.");
      return;
    }
    if (!syncToken) {
      setSyncStatus("error");
      setSyncMessage("يرجى إدخال توكن البوت أو كلمة مرور اللوحة للمصادقة.");
      return;
    }

    setSyncStatus("loading");
    setSyncMessage("جاري الاتصال بسيرفر Railway وسحب البيانات عبر السيرفر لتخطي قيود الحماية (CORS)...");

    try {
      localStorage.setItem("sync_railway_url", railwayUrl);
      localStorage.setItem("sync_token", syncToken);

      const response = await fetch("/api/proxy-sync-pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ railwayUrl, syncToken })
      });

      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.error || "فشل الاتصال بسيرفر Railway عبر البروكسي الآمن. تأكد من صحة الرابط والتوكن.");
      }

      setSyncStatus("success");
      setSyncMessage("🎉 تمت مزامنة وسحب كافة البيانات من السحابة إلى جهازك المحلي بنجاح! تم تحديث المستخدمين والاشتراكات والطلبات وتجاوز قيود CORS.");

      fetchRESTSettings();
      fetchRESTMenus();
      fetchRESTTickets();
      fetchRESTSupportMessages();
      fetchTelegramWebhookStatus();

      const dbData = resData.data;
      if (dbData?.settings?.global) {
        const g = dbData.settings.global;
        setTokenInput(g.botToken || "");
        setAdminChatIdInput(g.adminChatId || "");
        setWelcomeMsgInput(g.welcomeMessage || "");
        setDashboardPasswordInput(g.dashboardPassword || "");
      }
    } catch (err: any) {
      console.error("Sync pull error:", err);
      setSyncStatus("error");
      setSyncMessage(err.message || "حدث خطأ غير متوقع أثناء المزامنة.");
    }
  };

  const handleSyncPush = async () => {
    if (!railwayUrl) {
      setSyncStatus("error");
      setSyncMessage("يرجى إدخال رابط سيرفر Railway أولاً.");
      return;
    }
    if (!syncToken) {
      setSyncStatus("error");
      setSyncMessage("يرجى إدخال توكن البوت أو كلمة مرور اللوحة للمصادقة.");
      return;
    }

    if (!confirm("⚠️ تنبيه: هذا الإجراء سيقوم باستبدال قاعدة البيانات على سيرفر Railway بالكامل بقاعدتك المحلية الحالية (شاملاً باقات الاشتراكات والمستخدمين والرسائل). هل تريد الاستمرار؟")) {
      return;
    }

    setSyncStatus("loading");
    setSyncMessage("جاري نقل ورفع قاعدة البيانات المحلية إلى Railway عبر البروكسي لتخطي قيود CORS...");

    try {
      localStorage.setItem("sync_railway_url", railwayUrl);
      localStorage.setItem("sync_token", syncToken);

      const response = await fetch("/api/proxy-sync-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ railwayUrl, syncToken })
      });

      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.error || "فشل رفع قاعدة البيانات إلى سيرفر Railway عبر البروكسي. تأكد من صحة الرابط والتوكن.");
      }

      setSyncStatus("success");
      setSyncMessage("🚀 تم رفع وتحديث قاعدة بيانات سيرفر Railway بالكامل بنجاح عبر البروكسي! جميع الباقات والمستخدمين المحدثين الآن نشطون سحابياً.");
    } catch (err: any) {
      console.error("Sync push error:", err);
      setSyncStatus("error");
      setSyncMessage(err.message || "حدث خطأ غير متوقع أثناء دفع البيانات.");
    }
  };

  const handleResetLocalDB = async () => {
    if (!confirm("⚠️ هل أنت متأكد من رغبتك في حذف وإفراغ كافة الطلبات والرسائل وجلسات البوت المحفوظة على السيرفر المحلي نهائياً؟ لا يمكن التراجع عن هذا الإجراء.")) {
      return;
    }
    setSyncStatus("loading");
    setSyncMessage("جاري إفراغ قاعدة البيانات المحلية وحذف كافة الطلبات والرسائل والمحادثات...");
    try {
      const res = await fetch("/api/local-db/reset", {
        method: "POST"
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل مسح البيانات المحلية.");
      }
      setSyncStatus("success");
      setSyncMessage("🎉 " + data.message);
      
      // refresh lists
      fetchRESTTickets();
      fetchRESTSupportMessages();
      
      // clear selected
      setSelectedTicket(null);
      setSelectedSupportMessage(null);
    } catch (err: any) {
      console.error("Reset local DB error:", err);
      setSyncStatus("error");
      setSyncMessage(err.message || "حدث خطأ غير متوقع أثناء تصفير البيانات.");
    }
  };

  // Bot Webhooks Actions
  const activateBotWebhook = async () => {
    setWebhookSettingStatus("idle");
    setWebhookErrorMsg("");
    try {
      const res = await fetch("/api/register-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل تفعيل الويب هوك");
      }
      setWebhookSettingStatus("success");
      fetchTelegramWebhookStatus();
    } catch (err: any) {
      setWebhookSettingStatus("error");
      setWebhookErrorMsg(err.message || "حدث خطأ غير متوقع");
    }
  };

  const removeBotWebhook = async () => {
    setWebhookSettingStatus("idle");
    setWebhookErrorMsg("");
    if (!confirm("هل أنت متأكد أنك تريد إيقاف الويب هوك؟ هذا قد يوقف استلام البوت للرسائل إذا لم تكن تشغله محلياً.")) return;
    
    try {
      const res = await fetch("/api/remove-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل إيقاف الويب هوك");
      }
      setWebhookSettingStatus("success");
      fetchTelegramWebhookStatus();
    } catch (err: any) {
      setWebhookSettingStatus("error");
      setWebhookErrorMsg(err.message || "حدث خطأ غير متوقع");
    }
  };

  const handleTogglePolling = async (enabled: boolean, claimMaster: boolean = false) => {
    try {
      const res = await fetch("/api/polling/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, claimMaster })
      });
      if (res.ok) {
        fetchTelegramWebhookStatus();
      }
    } catch (err) {
      console.error("Failed to toggle polling:", err);
    }
  };

  // Direct Ticket Reply (Approvals / Rejections)
  const submitTicketReply = async (status: "approved" | "rejected") => {
    if (!selectedTicket) return;
    if (!replyMessage.trim()) {
      alert("يرجى كتابة رسالة توضيحية أو رد للعميل ليتم إرسالها إلى حسابه على التليجرام.");
      return;
    }

    setSubmittingReply(true);
    setReplySuccess(false);

    try {
      const res = await fetch("/api/admin/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: selectedTicket.id,
          replyMessage: replyMessage.trim(),
          newStatus: status
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "خطأ أثناء محاولة إرسال الرد وتحديث الطلب");
      }

      setReplySuccess(true);
      setReplyMessage("");
      
      setSelectedTicket((prev) => prev ? { ...prev, status, adminComment: replyMessage.trim() } : null);
      fetchRESTTickets();
      setTimeout(() => setReplySuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || "حدث خطأ");
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleDeleteTicket = async (id: string, force = false) => {
    if (!force) {
      setTicketToDeleteId(id);
      return;
    }

    try {
      const ticketToDelete = tickets.find(t => t.id === id);
      setTickets(prev => prev.filter(t => t.id !== id));
      setTicketToDeleteId(null);
      
      const res = await fetch(`/api/tickets/${id}`, {
        method: "DELETE"
      });
      
      if (res.ok) {
        if (selectedTicket?.id === id) {
          setSelectedTicket(null);
        }
        fetchRESTTickets();
      } else {
        if (ticketToDelete) {
          setTickets(prev => [ticketToDelete, ...prev].sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          ));
        }
        alert("فشل حذف الطلب من الخادم. يرجى المحاولة مرة أخرى.");
      }
    } catch (err) {
      console.error("Failed to delete ticket:", err);
      alert("حدث خطأ أثناء محاولة الحذف. تأكد من اتصالك بالإنترنت.");
    }
  };

  // Filter & Search Tickets
  const filteredTickets = tickets.filter(t => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = 
      t.telegramName.toLowerCase().includes(query) ||
      t.email.toLowerCase().includes(query) ||
      t.menuTitle.toLowerCase().includes(query) ||
      (t.telegramUsername && t.telegramUsername.toLowerCase().includes(query));
    
    if (statusFilter === "all") return matchesSearch;
    return matchesSearch && t.status === statusFilter;
  });

  const pendingCount = tickets.filter((t) => t.status === "new").length;
  const totalCount = tickets.length;
  const approvedCount = tickets.filter((t) => t.status === "approved").length;

  const renderFormatToolbarForMenu = (textareaId: string, value: string, setValue: (val: string) => void) => {
    return renderFormatToolbar(textareaId, value, setValue, insertFormatForMenuDetails);
  };

  // Render Login Screen if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans" dir="rtl">
        {/* Decorative Ambient Lights */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-md bg-zinc-900/60 backdrop-blur-xl border border-white/[0.06] p-8 rounded-3xl shadow-2xl relative z-10 space-y-6 text-center"
        >
          {/* Logo / Title */}
          <div className="space-y-2">
            <div className="mx-auto w-16 h-16 bg-violet-500/10 border border-violet-500/20 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/10">
              <Bot className="h-8 w-8 text-violet-400 animate-pulse" />
            </div>
            <h1 className="text-xl font-black text-white tracking-tight">بوابة إدارة MedKit 🛡️</h1>
            <p className="text-xs text-zinc-400">يرجى كتابة كلمة مرور الإدارة لتأمين الدخول السحابي</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4 text-right">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-zinc-300 block mr-1">كلمة مرور اللوحة الرئيسية:</label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="أدخل كلمة المرور الحالية للوحة"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/5 rounded-2xl py-3 px-4 text-xs text-slate-100 placeholder-zinc-700 focus:outline-none focus:border-violet-500/50 text-left font-mono"
                  required
                />
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
              </div>
            </div>

            <AnimatePresence>
              {loginError && (
                <motion.div 
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2 justify-end"
                >
                  <span>{loginError}</span>
                  <AlertCircle className="h-4 w-4" />
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={checkingAuth}
              className="w-full py-3.5 bg-gradient-to-l from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black rounded-2xl text-xs transition-all shadow-lg shadow-violet-500/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {checkingAuth ? <RefreshCw className="h-4.5 w-4.5 animate-spin" /> : <LogIn className="h-4.5 w-4.5" />}
              تسجيل الدخول الآمن للوحة
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 flex flex-col md:flex-row font-sans relative overflow-x-hidden selection:bg-violet-500/20 selection:text-violet-300" dir="rtl">
      {/* Absolute Ambient Glowing Lights */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-violet-500/5 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none z-0" />

      {/* 1. RIGHT SIDEBAR */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingCount={pendingCount}
        menusCount={menus.length}
        unreadSupportCount={supportMessages.filter(m => !m.replied).length}
        webhookStatus={webhookStatus}
        handleLogout={handleLogout}
      />

      {/* 2. MAIN WORKSPACE */}
      <main className="flex-1 flex flex-col min-h-screen relative overflow-x-hidden z-10 bg-zinc-950/20">
        
        {/* Upper Dashboard header bar */}
        <Header 
          activeTab={activeTab} 
          webhookStatus={webhookStatus} 
        />

        {/* Core workspace content tabs container */}
        <div className="flex-1 p-6 sm:p-8 overflow-y-auto">
          <AnimatePresence mode="wait">
            
            {/* TAB 1: OVERVIEW */}
            {activeTab === "overview" && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="w-full text-right"
              >
                <DashboardOverview
                  tickets={tickets}
                  menusCount={menus.length}
                  pendingCount={pendingCount}
                  approvedCount={approvedCount}
                  totalCount={totalCount}
                  onSelectTicket={(t) => {
                    setSelectedTicket(t);
                    setActiveTab("tickets");
                  }}
                  setActiveTab={setActiveTab}
                  railwayUrl={railwayUrl}
                  syncToken={syncToken}
                  webhookStatus={webhookStatus}
                  activateBotWebhook={activateBotWebhook}
                />
              </motion.div>
            )}

            {/* TAB 2: SUBSCRIPTIONS & MENUS */}
            {activeTab === "menus" && (
              <motion.div
                key="menus"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="w-full text-right"
              >
                <DashboardMenus
                  menus={menus}
                  onAddMenu={() => {
                    setIsEditingExistingMenu(false);
                    setEditingMenu({ id: "", title: "", price: "", description: "", details: "" });
                    setShowMenuModal(true);
                  }}
                  onEditMenu={(menu) => {
                    setIsEditingExistingMenu(true);
                    setEditingMenu({ ...menu });
                    setShowMenuModal(true);
                  }}
                  onDeleteMenu={handleDeleteMenu}
                  menuActionStatus={menuActionStatus}
                  menuActionMessage={menuActionMessage}
                />
              </motion.div>
            )}

            {/* TAB 3: TICKETS / ORDER MANAGER */}
            {activeTab === "tickets" && (
              <motion.div
                key="tickets"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="w-full text-right"
              >
                <DashboardTickets
                  tickets={tickets}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  selectedTicket={selectedTicket}
                  setSelectedTicket={setSelectedTicket}
                  replyMessage={replyMessage}
                  setReplyMessage={setReplyMessage}
                  submittingReply={submittingReply}
                  replySuccess={replySuccess}
                  submitTicketReply={submitTicketReply}
                  onDeleteTicket={handleDeleteTicket}
                  ticketToDeleteId={ticketToDeleteId}
                  setTicketToDeleteId={setTicketToDeleteId}
                />
              </motion.div>
            )}

            {/* TAB 4: SUPPORT MESSAGES CHAT */}
            {activeTab === "support" && (
              <motion.div
                key="support"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="w-full text-right"
              >
                <DashboardSupport
                  supportMessages={supportMessages}
                  selectedSupportMessage={selectedSupportMessage}
                  setSelectedSupportMessage={setSelectedSupportMessage}
                  supportReplyText={supportReplyText}
                  setSupportReplyText={setSupportReplyText}
                  submittingSupportReply={submittingSupportReply}
                  supportReplySuccess={supportReplySuccess}
                  handleReplySupport={handleReplySupport}
                  onDeleteSupportMessage={handleDeleteSupportMessage}
                  renderFormatToolbar={renderFormatToolbar}
                />
              </motion.div>
            )}

            {/* TAB 5: SETTINGS & CLOUD SYNC */}
            {activeTab === "settings" && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="w-full text-right"
              >
                <DashboardSettings
                  settings={settings}
                  webhookStatus={webhookStatus}
                  tokenInput={tokenInput}
                  setTokenInput={setTokenInput}
                  adminChatIdInput={adminChatIdInput}
                  setAdminChatIdInput={setAdminChatIdInput}
                  welcomeMsgInput={welcomeMsgInput}
                  setWelcomeMsgInput={setWelcomeMsgInput}
                  dashboardPasswordInput={dashboardPasswordInput}
                  setDashboardPasswordInput={setDashboardPasswordInput}
                  savingSettings={savingSettings}
                  saveSuccess={saveSuccess}
                  saveGlobalSettings={saveGlobalSettings}
                  railwayUrl={railwayUrl}
                  setRailwayUrl={setRailwayUrl}
                  syncToken={syncToken}
                  setSyncToken={setSyncToken}
                  syncStatus={syncStatus}
                  syncMessage={syncMessage}
                  handleSyncPull={handleSyncPull}
                  handleSyncPush={handleSyncPush}
                  handleResetLocalDB={handleResetLocalDB}
                  activateBotWebhook={activateBotWebhook}
                  removeBotWebhook={removeBotWebhook}
                  handleTogglePolling={handleTogglePolling}
                  fetchingWebhook={fetchingWebhook}
                  copiedSetting={copiedSetting}
                  handleCopy={handleCopy}
                  renderFormatToolbar={renderFormatToolbar}
                />
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </main>

      {/* Delete Ticket Confirmation Dialog */}
      <AnimatePresence>
        {ticketToDeleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-white/5 rounded-2xl p-6 max-w-sm w-full space-y-4 text-right"
            >
              <h3 className="text-sm font-black text-white">حذف طلب تفعيل العميل نهائياً؟</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                هل أنت متأكد من رغبتك في إزالة هذا الطلب بشكل دائم من قاعدة البيانات؟ لا يمكن التراجع عن هذا الإجراء.
              </p>
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setTicketToDeleteId(null)}
                  className="py-2 px-4 bg-zinc-950 hover:bg-zinc-800 text-zinc-400 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  تراجع
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteTicket(ticketToDeleteId, true);
                  }}
                  className="py-2 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-black transition-all cursor-pointer"
                >
                  تأكيد الحذف النهائي
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. PLAN/MENU ADD & EDIT MODAL SCREEN */}
      <AnimatePresence>
        {showMenuModal && editingMenu && (
          <MenuModal
            showMenuModal={showMenuModal}
            editingMenu={editingMenu}
            setEditingMenu={setEditingMenu}
            isEditingExistingMenu={isEditingExistingMenu}
            handleSaveMenu={handleSaveMenu}
            renderFormatToolbar={renderFormatToolbar}
            insertFormatForMenuDetails={insertFormatForMenuDetails}
            setShowMenuModal={setShowMenuModal}
          />
        )}
      </AnimatePresence>

    </div>
  );
}

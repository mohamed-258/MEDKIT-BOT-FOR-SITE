import { useState, useEffect, FormEvent } from "react";
import { 
  Bot, Key, Send, Copy, Check, X, ShieldAlert, Sparkles, 
  LayoutDashboard, Ticket, Settings, MenuSquare, CheckCircle2, 
  AlertCircle, Clock, ExternalLink, Image, RefreshCw, Plus, Trash2, 
  Edit2, LogOut, LogIn, UserCheck, HelpCircle, HeartPulse, ShieldCheck,
  ChevronLeft, MessageSquare, Bold, Italic, Underline, Strikethrough, Code, Quote,
  Database, ArrowDownCircle, ArrowUpCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Menu, Ticket as TicketType, Setting, SupportMessage } from "./types";

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
    if (!confirm("هل أنت متأكد من رغبتك في حذف رسالة الدعم هذه؟")) return;
    try {
      const res = await fetch(`/api/support-messages/${msgId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchRESTSupportMessages();
        if (selectedSupportMessage?.id === msgId) {
          setSelectedSupportMessage(null);
        }
      }
    } catch (err) {
      console.error("Failed to delete support message:", err);
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

  // Calculate high-level stats
  const totalCount = tickets.length;
  const pendingCount = tickets.filter((t) => t.status === "new").length;
  const approvedCount = tickets.filter((t) => t.status === "approved").length;
  const rejectedCount = tickets.filter((t) => t.status === "rejected").length;
  const activeCount = approvedCount;

  // Render Login Screen if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans" dir="rtl">
        {/* Decorative Grid and Ambient Lights */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:4rem_4rem]" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-md bg-slate-900/85 backdrop-blur-xl border border-white/5 p-8 rounded-3xl shadow-2xl relative z-10 space-y-6 text-center"
        >
          {/* Logo / Title */}
          <div className="space-y-2">
            <div className="mx-auto w-16 h-16 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl flex items-center justify-center">
              <Bot className="h-8 w-8 text-cyan-400" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">لوحة تحكم MedKit 🛡️</h1>
            <p className="text-xs text-slate-400">يرجى تسجيل الدخول للتحقق وإدارة باقات وطلبات العملاء.</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4 text-right">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 block mr-1">كلمة مرور اللوحة:</label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="أدخل كلمة مرور المسؤول"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full bg-slate-950 border border-white/5 rounded-2xl py-3 px-4 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                  required
                />
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
              </div>
            </div>

            <AnimatePresence>
              {loginError && (
                <motion.div 
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center gap-2"
                >
                  <AlertCircle className="h-4 w-4" />
                  <span>{loginError}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={checkingAuth}
              className="w-full py-3.5 bg-gradient-to-l from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black rounded-2xl text-xs transition-all shadow-lg shadow-cyan-500/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {checkingAuth ? <RefreshCw className="h-4.5 w-4.5 animate-spin" /> : <LogIn className="h-4.5 w-4.5" />}
              تسجيل الدخول الآمن
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col md:flex-row font-sans" dir="rtl">
      
      {/* 1. RIGHT SIDEBAR - MODERN GLOWING NAVIGATION */}
      <aside className="w-full md:w-80 bg-slate-900 border-l border-white/5 flex flex-col justify-between shrink-0 relative z-20">
        
        {/* Sidebar Header & Brand info */}
        <div>
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cyan-500/10 border border-cyan-500/20 rounded-xl flex items-center justify-center">
                <Bot className="h-5.5 w-5.5 text-cyan-400" />
              </div>
              <div className="text-right">
                <h2 className="text-sm font-extrabold text-white leading-tight">MedKit Admin 🛡️</h2>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`w-2 h-2 rounded-full ${webhookStatus?.configured ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`}></span>
                  <span className="text-[10px] text-slate-400">
                    {webhookStatus?.configured ? "البوت نشط سحابياً" : "غير نشط / تطوير"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Menu Links */}
          <nav className="p-4 space-y-1.5">
            <button
              onClick={() => setActiveTab("overview")}
              className={`w-full text-right px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer group ${
                activeTab === "overview" 
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
            >
              <div className="flex items-center gap-3">
                <LayoutDashboard className={`h-4.5 w-4.5 ${activeTab === "overview" ? "text-cyan-400" : "text-slate-500 group-hover:text-slate-300"}`} />
                <span>لوحة القيادة (الرئيسية)</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab("menus")}
              className={`w-full text-right px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer group ${
                activeTab === "menus" 
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
            >
              <div className="flex items-center gap-3">
                <MenuSquare className={`h-4.5 w-4.5 ${activeTab === "menus" ? "text-cyan-400" : "text-slate-500 group-hover:text-slate-300"}`} />
                <span>عروض باقات الاشتراك</span>
              </div>
              <span className="text-[10px] font-mono bg-slate-950 px-2 py-0.5 rounded-full border border-white/5 text-slate-400 font-bold">
                {menus.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("tickets")}
              className={`w-full text-right px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer group ${
                activeTab === "tickets" 
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
            >
              <div className="flex items-center gap-3">
                <Ticket className={`h-4.5 w-4.5 ${activeTab === "tickets" ? "text-cyan-400" : "text-slate-500 group-hover:text-slate-300"}`} />
                <span>طلبات التفعيل والكودات</span>
              </div>
              {pendingCount > 0 && (
                <span className="text-[10px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20 font-bold animate-pulse">
                  {pendingCount} معلق
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("support")}
              className={`w-full text-right px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer group ${
                activeTab === "support" 
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
            >
              <div className="flex items-center gap-3">
                <MessageSquare className={`h-4.5 w-4.5 ${activeTab === "support" ? "text-cyan-400" : "text-slate-500 group-hover:text-slate-300"}`} />
                <span>رسائل الدعم الفني</span>
              </div>
              {supportMessages.filter(m => !m.replied).length > 0 && (
                <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-500/20 font-bold">
                  {supportMessages.filter(m => !m.replied).length} غير مقروء
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("settings")}
              className={`w-full text-right px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer group ${
                activeTab === "settings" 
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
            >
              <div className="flex items-center gap-3">
                <Settings className={`h-4.5 w-4.5 ${activeTab === "settings" ? "text-cyan-400" : "text-slate-500 group-hover:text-slate-300"}`} />
                <span>الإعدادات والمزامنة (Railway)</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer with user session and log-out */}
        <div className="p-4 border-t border-white/5 space-y-3.5 bg-slate-950/20">
          <div className="flex items-center justify-between flex-row-reverse text-xs">
            <span className="text-[10px] text-slate-500">حساب المسؤول</span>
            <span className="font-mono text-[11px] text-slate-400 font-bold">Admin Panel</span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full py-2.5 bg-slate-950 hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-white/5 hover:border-red-500/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            تسجيل الخروج
          </button>
        </div>

      </aside>

      {/* 2. MAIN WORKSPACE / LEFT PANEL */}
      <main className="flex-1 flex flex-col min-h-screen relative overflow-x-hidden">
        
        {/* Upper Dashboard header bar */}
        <header className="h-16 border-b border-white/5 px-6 sm:px-8 flex items-center justify-between bg-slate-900/45 backdrop-blur-md relative z-10">
          <div className="text-right">
            <h1 className="text-sm font-black text-white">
              {activeTab === "overview" && "الرئيسية 📈"}
              {activeTab === "menus" && "إدارة باقات الاشتراك 💳"}
              {activeTab === "tickets" && "طلبات كودات التفعيل 🎟️"}
              {activeTab === "support" && "دردشات الدعم الفني 💬"}
              {activeTab === "settings" && "المزامنة السحابية والإعدادات ⚙️"}
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <a 
              href={webhookStatus?.botUser ? `https://t.me/${webhookStatus.botUser.username}` : "#"} 
              target="_blank" 
              rel="noreferrer" 
              className="text-xs text-slate-400 hover:text-cyan-400 font-semibold transition-colors flex items-center gap-1.5"
            >
              <span>رابط البوت المباشر</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </header>

        {/* Content body wrapper */}
        <div className="flex-1 p-6 sm:p-8 space-y-6">
          <AnimatePresence mode="wait">
            
            {/* TAB 1: DASHBOARD OVERVIEW */}
            {activeTab === "overview" && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="space-y-6 text-right"
              >
                {/* 4 Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  
                  <div className="bg-slate-900 border border-white/5 p-6 rounded-2xl flex items-center justify-between relative overflow-hidden group hover:border-cyan-500/20 transition-all">
                    <div className="space-y-1">
                      <p className="text-xs text-slate-400 font-bold">طلبات بانتظار المراجعة ⏳</p>
                      <p className="text-3xl font-extrabold text-amber-400 font-mono">{pendingCount}</p>
                    </div>
                    <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400">
                      <Clock className="h-6 w-6" />
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-white/5 p-6 rounded-2xl flex items-center justify-between relative overflow-hidden group hover:border-cyan-500/20 transition-all">
                    <div className="space-y-1">
                      <p className="text-xs text-slate-400 font-bold">الاشتراكات المفعّلة ✅</p>
                      <p className="text-3xl font-extrabold text-emerald-400 font-mono">{approvedCount}</p>
                    </div>
                    <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-white/5 p-6 rounded-2xl flex items-center justify-between relative overflow-hidden group hover:border-cyan-500/20 transition-all">
                    <div className="space-y-1">
                      <p className="text-xs text-slate-400 font-bold">إجمالي الطلبات المستلمة 📦</p>
                      <p className="text-3xl font-extrabold text-slate-100 font-mono">{totalCount}</p>
                    </div>
                    <div className="p-3 bg-slate-800 rounded-xl text-slate-400">
                      <Ticket className="h-6 w-6" />
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-white/5 p-6 rounded-2xl flex items-center justify-between relative overflow-hidden group hover:border-cyan-500/20 transition-all">
                    <div className="space-y-1">
                      <p className="text-xs text-slate-400 font-bold">باقات الاشتراك النشطة 💳</p>
                      <p className="text-3xl font-extrabold text-cyan-400 font-mono">{menus.length}</p>
                    </div>
                    <div className="p-3 bg-cyan-500/10 rounded-xl text-cyan-400">
                      <MenuSquare className="h-6 w-6" />
                    </div>
                  </div>

                </div>

                {/* Grid layout with pending lists and cloud sync actions */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left Column: Recent Orders */}
                  <div className="lg:col-span-2 bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between flex-row-reverse">
                      <button
                        onClick={() => setActiveTab("tickets")}
                        className="text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        عرض كافة الطلبات
                      </button>
                      <h3 className="text-base font-black text-white flex items-center gap-2">
                        <Ticket className="h-5 w-5 text-cyan-400" />
                        آخر الطلبات المعلقة التي بحاجة لتفعيل الكود
                      </h3>
                    </div>

                    {tickets.filter(t => t.status === "new").length === 0 ? (
                      <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-3">
                        <Check className="h-10 w-10 text-emerald-500/30 p-2 bg-emerald-500/10 rounded-full animate-bounce" />
                        <p className="text-sm font-semibold">رائع! لا يوجد أي طلبات اشتراك معلقة بانتظارك حالياً.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-white/5">
                        {tickets.filter(t => t.status === "new").slice(0, 4).map((ticket) => (
                          <div
                            key={ticket.id}
                            onClick={() => {
                              setSelectedTicket(ticket);
                              setActiveTab("tickets");
                            }}
                            className="py-4 flex items-center justify-between hover:bg-slate-800/20 px-3 rounded-xl transition-all cursor-pointer border border-transparent hover:border-white/5"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] text-slate-500 font-mono">
                                {new Date(ticket.createdAt).toLocaleDateString("ar-EG")}
                              </span>
                              <ChevronLeft className="h-4 w-4 text-slate-600" />
                            </div>
                            <div className="space-y-1">
                              <p className="font-bold text-xs text-white sm:text-sm">{ticket.telegramName}</p>
                              <div className="flex items-center gap-3 text-xs text-slate-400 justify-end">
                                <span className="text-cyan-400 font-bold">{ticket.menuTitle}</span>
                                <span className="text-slate-600">•</span>
                                <span className="font-mono text-slate-500">{ticket.email}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Connection & Quick Sync block */}
                  <div className="space-y-6">
                    
                    {/* Cloud status overview */}
                    <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-4">
                      <h3 className="text-sm font-black text-white flex items-center gap-2 justify-end">
                        المزامنة مع Railway 🔁
                        <Database className="h-4.5 w-4.5 text-cyan-400" />
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        تسمح لك أداة المزامنة برفع أو سحب البيانات لحماية الباقات والطلبات والمستخدمين من الفقدان والتشغيل الدائم.
                      </p>

                      <div className="pt-2 border-t border-white/5 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono text-slate-300 max-w-[150px] truncate block">
                            {railwayUrl ? railwayUrl.replace("https://", "") : "غير محدد"}
                          </span>
                          <span className="text-slate-400">سيرفر Railway:</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-cyan-400">
                            {syncToken ? "🔑 جاهز وموثق" : "⚠️ غير مدخل"}
                          </span>
                          <span className="text-slate-400">توكن المصادقة:</span>
                        </div>
                      </div>

                      <button
                        onClick={() => setActiveTab("settings")}
                        className="w-full py-2.5 bg-slate-950 hover:bg-slate-850 text-cyan-400 hover:text-cyan-300 border border-cyan-500/20 hover:border-cyan-500/40 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Settings className="h-4 w-4" />
                        الذهاب إلى لوحة المزامنة والإعدادات
                      </button>
                    </div>

                    {/* Bot active status */}
                    <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-4">
                      <h3 className="text-sm font-black text-white flex items-center gap-2 justify-end">
                        تفعيل البوت والويب هوك 🤖
                        <Bot className="h-4.5 w-4.5 text-cyan-400" />
                      </h3>

                      <div className="p-3 bg-slate-950 rounded-xl text-xs flex items-center justify-between">
                        <span className={`w-2.5 h-2.5 rounded-full ${webhookStatus?.configured ? "bg-emerald-500" : "bg-amber-500"}`}></span>
                        <span className="font-bold">
                          {webhookStatus?.configured ? "البوت متصل بالكامل" : "وضعية التطوير المحلي"}
                        </span>
                      </div>

                      <button
                        onClick={activateBotWebhook}
                        className="w-full py-3 bg-gradient-to-l from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <RefreshCw className="h-4 w-4 animate-spin-slow" />
                        تنشيط/تحديث الويب هوك السحابي
                      </button>
                    </div>

                  </div>

                </div>
              </motion.div>
            )}

            {/* TAB 2: PLANS / SUBSCRIPTIONS MANAGEMENT */}
            {activeTab === "menus" && (
              <motion.div
                key="menus"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="space-y-6 text-right"
              >
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div className="mr-auto sm:mr-0">
                    <button
                      onClick={() => {
                        setEditingMenu({ id: "", title: "", price: "", description: "", details: "" });
                        setIsEditingExistingMenu(false);
                        setShowMenuModal(true);
                      }}
                      className="py-3 px-5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold rounded-xl text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/10"
                    >
                      <Plus className="h-4.5 w-4.5" />
                      إضافة باقة جديدة 💳
                    </button>
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-xl font-black text-white">باقات الاشتراك وعروض تليجرام 💳</h2>
                    <p className="text-xs text-slate-400">تحكم بالباقات التي تظهر لعملائك بالبوت، وعروض الأسعار التفعيلية مع الكودات.</p>
                  </div>
                </div>

                {menuActionMessage && (
                  <div className={`p-4 rounded-xl border text-xs font-semibold ${
                    menuActionStatus === "success" 
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                      : "bg-red-500/10 border-red-500/20 text-red-400"
                  }`}>
                    {menuActionMessage}
                  </div>
                )}

                {/* Grid of packages */}
                {menus.length === 0 ? (
                  <div className="bg-slate-900 border border-white/5 rounded-2xl p-16 text-center text-slate-500 space-y-4 flex flex-col items-center justify-center">
                    <MenuSquare className="h-12 w-12 text-slate-700 animate-pulse" />
                    <p className="text-sm font-semibold">لم تقم بإضافة أي باقة اشتراك حتى الآن.</p>
                    <button
                      onClick={() => {
                        setEditingMenu({ id: "", title: "", price: "", description: "", details: "" });
                        setIsEditingExistingMenu(false);
                        setShowMenuModal(true);
                      }}
                      className="text-xs font-bold text-cyan-400 hover:underline cursor-pointer"
                    >
                      اضغط هنا لإضافة باقتك الأولى وسحبها للتليجرام
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {menus.map((menu) => (
                      <div 
                        key={menu.id} 
                        className="bg-slate-900 border border-white/5 rounded-2xl p-6 flex flex-col justify-between hover:border-cyan-500/20 transition-all group relative"
                      >
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <span className="font-mono text-[10px] bg-slate-950 text-slate-400 px-2.5 py-1 rounded-lg border border-white/5 font-bold uppercase">
                              ID: {menu.id}
                            </span>
                            <div className="text-right">
                              <h3 className="font-black text-white text-base leading-tight group-hover:text-cyan-400 transition-colors">
                                {menu.title}
                              </h3>
                              <p className="text-cyan-400 text-xs font-extrabold mt-1.5 font-mono">{menu.price}</p>
                            </div>
                          </div>

                          <p className="text-xs text-slate-400 leading-relaxed text-right min-h-[40px] line-clamp-3">
                            {menu.description || "لا يوجد وصف مختصر."}
                          </p>

                          {menu.details && (
                            <div className="p-3 bg-slate-950/60 rounded-xl border border-white/5 text-[11px] text-slate-500 font-mono text-left max-h-[100px] overflow-y-auto overflow-x-hidden">
                              {menu.details}
                            </div>
                          )}
                        </div>

                        {/* Card actions */}
                        <div className="flex items-center gap-2 border-t border-white/5 pt-4 mt-6">
                          <button
                            onClick={() => {
                              setEditingMenu(menu);
                              setIsEditingExistingMenu(true);
                              setShowMenuModal(true);
                            }}
                            className="flex-1 py-2 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            تعديل الباقة
                          </button>
                          
                          <button
                            onClick={() => handleDeleteMenu(menu.id)}
                            className="py-2 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer"
                            title="حذف الباقة"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* TAB 3: TICKETS / ORDER MANAGER */}
            {activeTab === "tickets" && (
              <motion.div
                key="tickets"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="space-y-6 text-right"
              >
                {/* Upper control filters */}
                <div className="bg-slate-900 border border-white/5 p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between">
                  {/* Filter Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
                    <button
                      onClick={() => setStatusFilter("all")}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        statusFilter === "all" ? "bg-cyan-500 text-slate-950" : "bg-slate-950 text-slate-400 hover:text-white"
                      }`}
                    >
                      الكل ({tickets.length})
                    </button>
                    <button
                      onClick={() => setStatusFilter("new")}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        statusFilter === "new" ? "bg-amber-400 text-slate-950" : "bg-slate-950 text-slate-400 hover:text-white"
                      }`}
                    >
                      قيد الانتظار ({tickets.filter(t => t.status === "new").length})
                    </button>
                    <button
                      onClick={() => setStatusFilter("approved")}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        statusFilter === "approved" ? "bg-emerald-400 text-slate-950" : "bg-slate-950 text-slate-400 hover:text-white"
                      }`}
                    >
                      مقبولة ({tickets.filter(t => t.status === "approved").length})
                    </button>
                    <button
                      onClick={() => setStatusFilter("rejected")}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        statusFilter === "rejected" ? "bg-red-400 text-slate-950" : "bg-slate-950 text-slate-400 hover:text-white"
                      }`}
                    >
                      مرفوضة ({tickets.filter(t => t.status === "rejected").length})
                    </button>
                  </div>

                  {/* Search box input */}
                  <input
                    type="text"
                    placeholder="ابحث باسم العميل أو الباقة أو البريد الإلكتروني..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full md:w-80 bg-slate-950 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                  />
                </div>

                {/* Main Tickets Screen split panel */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Left Column: Ticket details screen */}
                  <div className="lg:col-span-7 bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-6">
                    {selectedTicket ? (
                      <motion.div 
                        key={selectedTicket.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-6"
                      >
                        {/* Upper card info */}
                        <div className="flex items-start justify-between border-b border-white/5 pb-4">
                          <button
                            onClick={() => handleDeleteTicket(selectedTicket.id, true)}
                            className="py-2 px-3.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                            حذف الطلب نهائياً
                          </button>

                          <div className="text-right">
                            <h3 className="font-black text-white text-lg">{selectedTicket.telegramName}</h3>
                            <div className="flex items-center gap-2 mt-1.5 justify-end">
                              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                                selectedTicket.status === "new" 
                                  ? "bg-amber-400/10 text-amber-400 border border-amber-400/20" 
                                  : selectedTicket.status === "approved"
                                    ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20"
                                    : "bg-red-400/10 text-red-400 border border-red-400/20"
                              }`}>
                                {selectedTicket.status === "new" && "قيد المراجعة ⏳"}
                                {selectedTicket.status === "approved" && "مقبول ومفعّل ✅"}
                                {selectedTicket.status === "rejected" && "مرفوض ❌"}
                              </span>
                              <span className="text-xs text-slate-400 font-mono">
                                {new Date(selectedTicket.createdAt).toLocaleString("ar-EG")}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Bento attributes specs */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-right">
                          <div className="p-3.5 bg-slate-950 rounded-xl space-y-1">
                            <span className="text-[10px] text-slate-500">الباقة المختارة</span>
                            <span className="text-xs text-cyan-400 font-bold block">{selectedTicket.menuTitle}</span>
                          </div>
                          
                          <div className="p-3.5 bg-slate-950 rounded-xl space-y-1">
                            <span className="text-[10px] text-slate-500">البريد الإلكتروني</span>
                            <span className="text-xs text-slate-200 font-mono block truncate">{selectedTicket.email}</span>
                          </div>

                          <div className="p-3.5 bg-slate-950 rounded-xl space-y-1">
                            <span className="text-[10px] text-slate-500">معرف التليجرام (@)</span>
                            {selectedTicket.telegramUsername ? (
                              <a 
                                href={`https://t.me/${selectedTicket.telegramUsername}`} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-xs text-cyan-400 font-bold hover:underline block"
                              >
                                @{selectedTicket.telegramUsername}
                              </a>
                            ) : (
                              <span className="text-xs text-slate-500 block">لا يوجد</span>
                            )}
                          </div>

                          <div className="p-3.5 bg-slate-950 rounded-xl space-y-1">
                            <span className="text-[10px] text-slate-500">شات ID تليجرام</span>
                            <span className="text-xs text-slate-400 font-mono block">{selectedTicket.telegramUserId}</span>
                          </div>
                        </div>

                        {/* Image receipt */}
                        <div className="space-y-2">
                          <span className="text-xs text-slate-400 font-bold block">لقطة شاشة أو إيصال تفعيل الاشتراك:</span>
                          <div className="relative bg-slate-950 border border-white/5 rounded-2xl overflow-hidden flex items-center justify-center min-h-[250px] p-2">
                            {selectedTicket.receiptPhotoUrl ? (
                              <img 
                                src={selectedTicket.receiptPhotoUrl} 
                                alt="Payment Receipt" 
                                className="max-w-full max-h-[350px] object-contain rounded-lg"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="text-slate-600 text-center space-y-2">
                                <Image className="h-10 w-10 text-slate-700 mx-auto" />
                                <p className="text-xs">لم يتم رفع صورة إيصال الدفع</p>
                              </div>
                            )}
                            {selectedTicket.receiptPhotoUrl && (
                              <a 
                                href={selectedTicket.receiptPhotoUrl} 
                                download={`receipt-${selectedTicket.telegramName}.jpg`}
                                target="_blank"
                                rel="noreferrer"
                                className="absolute top-3 left-3 bg-slate-900/90 hover:bg-slate-850 border border-white/5 px-3 py-1.5 rounded-lg text-[10px] font-bold text-white flex items-center gap-1.5 transition-all shadow-md"
                              >
                                <ExternalLink className="h-3 w-3" />
                                فتح الصورة بكامل حجمها
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Admin comment displaying */}
                        {selectedTicket.adminComment && (
                          <div className="p-4 bg-slate-950 border-r-2 border-cyan-500 rounded-xl space-y-1 text-xs">
                            <span className="text-slate-500 font-bold">تعليق الإدارة السابق:</span>
                            <p className="text-slate-300 leading-relaxed font-semibold">{selectedTicket.adminComment}</p>
                          </div>
                        )}

                        {/* Actions Response editor box */}
                        <div className="space-y-4 pt-4 border-t border-white/5">
                          <label className="text-xs text-slate-400 font-bold block">
                            توجيه الرد والقرار للعميل (سيصله الرد والتفعيل مباشرة على التليجرام):
                          </label>
                          <div className="space-y-0">
                            {renderFormatToolbar("ticket-reply-textarea", replyMessage, setReplyMessage)}
                            <textarea
                              id="ticket-reply-textarea"
                              value={replyMessage}
                              onChange={(e) => setReplyMessage(e.target.value)}
                              placeholder="اكتب هنا تفعيل الكود، أو إرشادات المشاهدة، أو سبب رفض الإيصال..."
                              rows={4}
                              className="w-full bg-slate-950 border border-white/5 border-t-0 rounded-b-xl p-4 text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                            />
                          </div>

                          <div className="flex flex-col sm:flex-row gap-3">
                            <button
                              onClick={() => submitTicketReply("approved")}
                              disabled={submittingReply}
                              className="flex-1 py-3 bg-gradient-to-l from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-black rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer bg-emerald-400 disabled:opacity-50"
                            >
                              <Check className="h-4 w-4" />
                              قبول وتفعيل كود الاشتراك العميل
                            </button>

                            <button
                              onClick={() => submitTicketReply("rejected")}
                              disabled={submittingReply}
                              className="flex-1 py-3 bg-gradient-to-l from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                              <X className="h-4.5 w-4.5" />
                              رفض الطلب وإرسال توضيح
                            </button>
                          </div>

                          <AnimatePresence>
                            {replySuccess && (
                              <motion.div 
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs text-center flex items-center justify-center gap-2"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                تم إرسال رد الإدارة إلى المستخدم على حسابه التليجرام بنجاح وتحديث قاعدة البيانات!
                              </motion.div>
                            )}
                          </AnimatePresence>

                        </div>

                      </motion.div>
                    ) : (
                      <div className="bg-slate-900 border border-white/5 rounded-2xl p-12 text-center text-slate-500 space-y-4 flex flex-col items-center justify-center min-h-[350px]">
                        <div className="h-14 w-14 bg-slate-950 rounded-full border border-white/5 flex items-center justify-center">
                          <Ticket className="h-6 w-6 text-slate-700 animate-pulse" />
                        </div>
                        <h3 className="text-white font-bold text-sm">لم يتم اختيار أي طلب بعد</h3>
                        <p className="text-xs leading-relaxed max-w-sm">
                          اختر أي طلب اشتراك من قائمة الطلبات في اليسار للتحقق من الإيصال وبدء إجراءات القبول أو الرفض الفوري.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Ticket Lists */}
                  <div className="lg:col-span-5 bg-slate-900 border border-white/5 rounded-2xl p-4 space-y-3.5">
                    <h3 className="text-sm font-black text-white px-2">قائمة طلبات التفعيل</h3>
                    
                    {filteredTickets.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-12">لا توجد طلبات تفعيل تطابق البحث أو الفلتر.</p>
                    ) : (
                      <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
                        {filteredTickets.map((t) => (
                          <div
                            key={t.id}
                            onClick={() => {
                              setSelectedTicket(t);
                              setReplyMessage("");
                            }}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer text-right space-y-2 ${
                              selectedTicket?.id === t.id
                                ? "bg-cyan-500/10 border-cyan-500/30 text-white"
                                : "bg-slate-950/60 border-white/5 hover:border-white/10 text-slate-300"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] text-slate-500 font-mono">
                                {new Date(t.createdAt).toLocaleDateString("ar-EG")}
                              </span>
                              <p className="font-extrabold text-xs">{t.telegramName}</p>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-slate-400">
                              <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${
                                t.status === "new"
                                  ? "bg-amber-400/10 text-amber-400"
                                  : t.status === "approved"
                                    ? "bg-emerald-400/10 text-emerald-400"
                                    : "bg-red-400/10 text-red-400"
                              }`}>
                                {t.status === "new" && "قيد الانتظار"}
                                {t.status === "approved" && "مقبول"}
                                {t.status === "rejected" && "مرفوض"}
                              </span>
                              <span className="text-cyan-400 font-bold">{t.menuTitle}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </motion.div>
            )}

            {/* TAB 4: SUPPORT MESSAGES CHAT */}
            {activeTab === "support" && (
              <motion.div
                key="support"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="space-y-6 text-right"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Left panel: Selected message conversation reply */}
                  <div className="lg:col-span-7 bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-6">
                    {selectedSupportMessage ? (
                      <motion.div 
                        key={selectedSupportMessage.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-6"
                      >
                        <div className="flex items-center justify-between border-b border-white/5 pb-4">
                          <button
                            onClick={() => handleDeleteSupportMessage(selectedSupportMessage.id)}
                            className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                            title="حذف الرسالة"
                          >
                            <Trash2 className="h-4.5 w-4.5" />
                          </button>

                          <div className="text-right">
                            <h3 className="font-extrabold text-white text-base">{selectedSupportMessage.telegramName}</h3>
                            <div className="flex items-center gap-1.5 justify-end text-xs text-slate-500 mt-1">
                              {selectedSupportMessage.telegramUsername && (
                                <a 
                                  href={`https://t.me/${selectedSupportMessage.telegramUsername}`} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="text-cyan-400 font-bold hover:underline"
                                >
                                  @{selectedSupportMessage.telegramUsername}
                                </a>
                              )}
                              <span>•</span>
                              <span className="font-mono">{new Date(selectedSupportMessage.createdAt).toLocaleString("ar-EG")}</span>
                            </div>
                          </div>
                        </div>

                        {/* Customer incoming text card */}
                        <div className="space-y-2 text-right">
                          <span className="text-[10px] text-slate-500 block">رسالة الاستفسار من العميل:</span>
                          <div className="p-4 bg-slate-950 border border-white/5 rounded-2xl text-xs text-slate-200 leading-relaxed font-semibold">
                            {selectedSupportMessage.messageText}
                          </div>
                          {selectedSupportMessage.messagePhotoUrl && (
                            <div className="bg-slate-950 border border-white/5 rounded-2xl overflow-hidden p-2 flex items-center justify-center max-h-[250px]">
                              <img 
                                src={selectedSupportMessage.messagePhotoUrl} 
                                alt="Support message attachment" 
                                className="max-h-[240px] rounded-lg object-contain"
                              />
                            </div>
                          )}
                        </div>

                        {/* Display reply details if already replied */}
                        {selectedSupportMessage.replied && (
                          <div className="p-4 bg-emerald-500/5 border-r-2 border-emerald-500 rounded-2xl space-y-1.5 text-xs text-right">
                            <span className="text-emerald-400 font-bold block">تم الرد بواسطة الإدارة:</span>
                            <p className="text-slate-300 leading-relaxed font-mono">{selectedSupportMessage.replyText}</p>
                            {selectedSupportMessage.repliedAt && (
                              <span className="text-[10px] text-slate-500 font-mono block">
                                في {new Date(selectedSupportMessage.repliedAt).toLocaleString("ar-EG")}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Direct Reply Form controls */}
                        <form onSubmit={handleReplySupport} className="space-y-4 pt-4 border-t border-white/5">
                          <label className="text-xs text-slate-400 font-bold block">توجيه الرد السريع للتليجرام:</label>
                          <div className="space-y-0">
                            {renderFormatToolbar("support-reply-textarea", supportReplyText, setSupportReplyText)}
                            <textarea
                              id="support-reply-textarea"
                              value={supportReplyText}
                              onChange={(e) => setSupportReplyText(e.target.value)}
                              placeholder="اكتب ردك الوافي هنا لحل مشكلة العميل وإرسالها لتليجرام..."
                              rows={4}
                              className="w-full bg-slate-950 border border-white/5 border-t-0 rounded-b-xl p-4 text-xs text-slate-200 focus:outline-none"
                              required
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={submittingSupportReply}
                            className="w-full py-3 bg-gradient-to-l from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                          >
                            <Send className="h-4 w-4" />
                            إرسال الرد المباشر لتليجرام
                          </button>

                          <AnimatePresence>
                            {supportReplySuccess && (
                              <motion.div 
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs text-center flex items-center justify-center gap-2"
                              >
                                <Check className="h-4 w-4" />
                                تم إرسال رد الدعم وتوصيله للعميل بنجاح!
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </form>
                      </motion.div>
                    ) : (
                      <div className="bg-slate-900 border border-white/5 rounded-2xl p-12 text-center text-slate-500 space-y-4 flex flex-col items-center justify-center min-h-[350px]">
                        <div className="h-14 w-14 bg-slate-950 border border-white/5 rounded-full flex items-center justify-center">
                          <MessageSquare className="h-6 w-6 text-slate-700 animate-pulse" />
                        </div>
                        <h3 className="text-white font-bold text-sm">محادثات الدعم الفني</h3>
                        <p className="text-xs leading-relaxed max-w-sm">
                          اختر أي رسالة دعم فني أو استفسار عميل من القائمة الموجودة على اليسار للرد المباشر وتوفير الدعم.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right panel: Messages checklist */}
                  <div className="lg:col-span-5 bg-slate-900 border border-white/5 rounded-2xl p-4 space-y-3.5">
                    <h3 className="text-sm font-black text-white px-2">رسائل العملاء</h3>
                    
                    {supportMessages.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-12">لا توجد رسائل دعم فني متوفرة حالياً.</p>
                    ) : (
                      <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
                        {supportMessages.map((msg) => (
                          <div
                            key={msg.id}
                            onClick={() => {
                              setSelectedSupportMessage(msg);
                              setSupportReplyText("");
                            }}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer text-right space-y-1.5 ${
                              selectedSupportMessage?.id === msg.id
                                ? "bg-cyan-500/10 border-cyan-500/30 text-white"
                                : "bg-slate-950/60 border-white/5 hover:border-white/10 text-slate-300"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[8px] text-slate-500 font-mono">
                                {new Date(msg.createdAt).toLocaleDateString("ar-EG")}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {msg.replied ? (
                                  <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[8px] font-bold">تم الرد</span>
                                ) : (
                                  <span className="px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 rounded text-[8px] font-bold animate-pulse">جديدة</span>
                                )}
                                <p className="font-extrabold text-xs">{msg.telegramName}</p>
                              </div>
                            </div>
                            <p className="text-[11px] text-slate-400 truncate leading-relaxed text-right pr-2">
                              {msg.messageText}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </motion.div>
            )}

            {/* TAB 5: SETTINGS & CLOUD SYNC */}
            {activeTab === "settings" && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="space-y-6 text-right"
              >
                
                {/* 1. Railway Database Sync Card (Main requirement for safe storage and push/pull) */}
                <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-2 justify-end border-b border-white/5 pb-4">
                    <h3 className="text-base font-black text-white flex items-center gap-1.5 justify-end">
                      مزامنة قاعدة البيانات السحابية (Railway ↔️ Local) 🔁
                      <Database className="h-5 w-5 text-cyan-400" />
                    </h3>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed max-w-4xl">
                    هذا القسم يسمح لك بالحفاظ على باقات الاشتراك والطلبات والعملاء دون أن تضيع أو تختفي. عند إضافة باقات جديدة أو حذف الطلبات والرسائل، يمكنك الضغط على <strong>دفع البيانات (Push)</strong> لرفعها وحفظها نهائياً على سيرفر Railway السحابي. وعند تحديث سيرفر السحاب، اضغط على <strong>سحب البيانات (Pull)</strong> لتنزيل كافة البيانات الحديثة لجهازك.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1.5 text-right">
                      <label className="text-xs text-slate-400 font-bold block mr-1">رابط سيرفر Railway السحابي:</label>
                      <input
                        type="text"
                        placeholder="مثال: https://my-app.railway.app"
                        value={railwayUrl}
                        onChange={(e) => setRailwayUrl(e.target.value)}
                        className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-xs text-slate-200 font-mono text-left focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5 text-right">
                      <label className="text-xs text-slate-400 font-bold block mr-1">توكن البوت أو كلمة مرور اللوحة للمصادقة:</label>
                      <input
                        type="password"
                        placeholder="أدخل توكن البوت أو كلمة سر اللوحة"
                        value={syncToken}
                        onChange={(e) => setSyncToken(e.target.value)}
                        className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-xs text-slate-200 font-mono text-left focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Sync buttons container */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
                    <button
                      type="button"
                      onClick={handleSyncPull}
                      disabled={syncStatus === "loading"}
                      className="py-3.5 bg-slate-950 hover:bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:border-cyan-500/40 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <ArrowDownCircle className="h-4.5 w-4.5" />
                      سحب وتنزيل كافة البيانات السحابية (Pull)
                    </button>

                    <button
                      type="button"
                      onClick={handleSyncPush}
                      disabled={syncStatus === "loading"}
                      className="py-3.5 bg-gradient-to-l from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md hover:shadow-cyan-500/10"
                    >
                      <ArrowUpCircle className="h-4.5 w-4.5" />
                      رفع وتثبيت البيانات المحلية على السحاب (Push)
                    </button>
                  </div>

                  <AnimatePresence>
                    {syncStatus !== "idle" && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={`p-3.5 rounded-xl border text-xs text-right leading-relaxed font-semibold ${
                          syncStatus === "loading"
                            ? "bg-cyan-500/5 border-cyan-500/10 text-cyan-400 animate-pulse"
                            : syncStatus === "success"
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                              : "bg-red-500/10 border-red-500/20 text-red-400"
                        }`}
                      >
                        {syncMessage}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* 2. Global Bot Settings Form */}
                <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4 flex-row-reverse">
                    <h3 className="text-base font-black text-white">إعدادات البوت والتحكم تليجرام</h3>
                    <Bot className="h-5 w-5 text-cyan-400" />
                  </div>

                  <form onSubmit={saveGlobalSettings} className="space-y-5 text-right">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 block mr-1">توكن البوت (Telegram Bot Token):</label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="مثال: 123456789:ABCdefGhIJKlmNoPQRsT"
                            value={tokenInput}
                            onChange={(e) => setTokenInput(e.target.value)}
                            className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-xs text-slate-200 font-mono text-left focus:outline-none"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 block mr-1">رقم معرف مسؤول الإدارة (Admin Chat ID):</label>
                        <input
                          type="text"
                          placeholder="مثال: 987654321"
                          value={adminChatIdInput}
                          onChange={(e) => setAdminChatIdInput(e.target.value)}
                          className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-xs text-slate-200 font-mono text-left focus:outline-none"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 block mr-1">رسالة الترحيب والتعليمات بالبوت للعملاء الجدد:</label>
                      <textarea
                        value={welcomeMsgInput}
                        onChange={(e) => setWelcomeMsgInput(e.target.value)}
                        placeholder="اكتب هنا رسالة التعليمات التفصيلية التي تظهر للمستخدم فور اشتغاله للبوت..."
                        rows={4}
                        className="w-full bg-slate-950 border border-white/5 rounded-xl p-4 text-xs text-slate-200 focus:outline-none font-sans"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 block mr-1">تغيير كلمة مرور اللوحة المسؤول 🔐:</label>
                        <input
                          type="text"
                          placeholder="كلمة المرور الجديدة (الافتراضية: admin)"
                          value={dashboardPasswordInput}
                          onChange={(e) => setDashboardPasswordInput(e.target.value)}
                          className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-xs text-slate-200 font-mono text-left focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 pt-4 border-t border-white/5">
                      <AnimatePresence>
                        {saveSuccess && (
                          <motion.span
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0 }}
                            className="text-xs text-emerald-400 font-bold"
                          >
                            ✓ تم حفظ كافة الإعدادات بنجاح في قاعدة البيانات المحلية!
                          </motion.span>
                        )}
                      </AnimatePresence>

                      <button
                        type="submit"
                        disabled={savingSettings}
                        className="py-3 px-8 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-xl text-xs transition-all cursor-pointer shadow-lg shadow-cyan-500/10 disabled:opacity-50"
                      >
                        {savingSettings ? "جاري الحفظ..." : "حفظ الإعدادات الفورية"}
                      </button>
                    </div>

                  </form>
                </div>

                {/* 3. Webhook detail statuses */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Webhook configurations and toggle polling */}
                  <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-4">
                    <h3 className="text-sm font-black text-white">حالة الويب هوك وتطوير البوت</h3>
                    
                    <div className="p-4 bg-slate-950 border border-white/5 rounded-xl space-y-3.5 text-xs text-right">
                      {webhookStatus?.configured ? (
                        <>
                          <div className="flex items-center gap-2 justify-end">
                            <span className="font-bold text-emerald-400">البوت متصل بالويب هوك نشط ⚡</span>
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          </div>
                          <div className="p-3 bg-slate-900 border border-white/5 rounded-lg text-left text-[11px] text-slate-400 font-mono space-y-1">
                            <div className="text-xs text-cyan-400 truncate">URL: {webhookStatus.webhookInfo?.url}</div>
                            <div>Pending update count: {webhookStatus.webhookInfo?.pending_update_count || 0}</div>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 justify-end text-amber-400 font-bold">
                          <span>البوت مغلق الويب هوك أو وضع تطوير محلي</span>
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                        </div>
                      )}

                      <div className="pt-2 border-t border-white/5 flex gap-2">
                        <button
                          type="button"
                          onClick={activateBotWebhook}
                          className="flex-1 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg text-[10px] font-bold cursor-pointer"
                        >
                          ربط الويب هوك وتنشيط البوت
                        </button>
                        {webhookStatus?.configured && (
                          <button
                            type="button"
                            onClick={removeBotWebhook}
                            className="py-2 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-[10px] font-bold cursor-pointer"
                          >
                            حذف الويب هوك
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Helpers quick guide info */}
                  <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-4">
                    <h3 className="text-sm font-black text-white">دليل المساعدة السريع 💡</h3>
                    <div className="space-y-3 text-xs text-slate-400 text-right leading-relaxed">
                      <p>
                        <strong>توكن تليجرام:</strong> ابحث في تليجرام عن حساب <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">@BotFather</a> وأرسل له الأمر <code className="bg-slate-950 border border-white/5 px-1 rounded font-mono text-cyan-400">/newbot</code> لإنشاء بوتك الجديد والحصول على مفتاح التوكن الآمن.
                      </p>
                      <hr className="border-white/5" />
                      <p>
                        <strong>معرف الشات (Chat ID):</strong> ابحث في تليجرام عن حساب <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">@userinfobot</a> أو <a href="https://t.me/GetMyID_Bot" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">@GetMyID_Bot</a> وأرسل له أي رسالة وسيعطيك رقم المعرف الخاص بك لتقوم بوضعه هنا.
                      </p>
                    </div>
                  </div>

                </div>

              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </main>

      {/* 3. PLAN/MENU ADD & EDIT MODAL SCREEN */}
      <AnimatePresence>
        {showMenuModal && editingMenu && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md font-sans" dir="rtl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-slate-900 border border-white/5 rounded-3xl p-6 space-y-6 relative overflow-hidden shadow-2xl text-right"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowMenuModal(false);
                    setEditingMenu(null);
                  }}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
                <h3 className="text-base font-black text-white">
                  {isEditingExistingMenu ? "تعديل باقة الاشتراك الحالية 💳" : "إضافة باقة اشتراك جديدة 💳"}
                </h3>
              </div>

              <form onSubmit={handleSaveMenu} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 block mr-1">رمز كود الباقة الفريد (ID):</label>
                    <input
                      type="text"
                      placeholder="مثال: plan_ultra (أحرف إنجليزية وأرقام فقط)"
                      value={editingMenu.id || ""}
                      onChange={(e) => setEditingMenu({ ...editingMenu, id: e.target.value })}
                      disabled={isEditingExistingMenu}
                      className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-slate-100 font-mono text-left focus:outline-none disabled:opacity-50"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 block mr-1">عنوان اسم الباقة (العربي):</label>
                    <input
                      type="text"
                      placeholder="مثال: اشتراك بريميوم 6 أشهر"
                      value={editingMenu.title || ""}
                      onChange={(e) => setEditingMenu({ ...editingMenu, title: e.target.value })}
                      className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 block mr-1">سعر الباقة وعرض التفعيل:</label>
                    <input
                      type="text"
                      placeholder="مثال: 150 ريال / $40"
                      value={editingMenu.price || ""}
                      onChange={(e) => setEditingMenu({ ...editingMenu, price: e.target.value })}
                      className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none font-mono"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 block mr-1">الوصف المختصر بالباقة:</label>
                    <input
                      type="text"
                      placeholder="وصف مختصر يظهر كعنوان ترويجي للباقة"
                      value={editingMenu.description || ""}
                      onChange={(e) => setEditingMenu({ ...editingMenu, description: e.target.value })}
                      className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 block mr-1">معلومات تفاصيل الدفع والتحويل للباقة (تظهر للعميل بعد الاختيار):</label>
                  <div className="space-y-0">
                    {renderFormatToolbar("menu-details-textarea", editingMenu.details || "", () => {}, insertFormatForMenuDetails)}
                    <textarea
                      id="menu-details-textarea"
                      placeholder="اكتب تفاصيل الدفع الكاملة للباقة (رقم الحساب، اسم البنك، الايميل، تعليمات الارسال...) مع تفعيل التنسيق تليجرام..."
                      value={editingMenu.details || ""}
                      onChange={(e) => setEditingMenu({ ...editingMenu, details: e.target.value })}
                      rows={5}
                      className="w-full bg-slate-950 border border-white/5 border-t-0 rounded-b-xl p-4 text-xs text-slate-200 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenuModal(false);
                      setEditingMenu(null);
                    }}
                    className="py-2.5 px-5 bg-slate-950 hover:bg-slate-800 text-slate-400 rounded-xl text-xs font-bold cursor-pointer transition-all"
                  >
                    إلغاء الأمر
                  </button>
                  <button
                    type="submit"
                    className="py-2.5 px-6 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-xl text-xs transition-all cursor-pointer shadow-lg shadow-cyan-500/10"
                  >
                    حفظ الباقة والتحديث 💾
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

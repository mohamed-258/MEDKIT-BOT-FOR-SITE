import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, Ticket, Filter, ExternalLink, Mail, User, ShieldAlert,
  Calendar, MessageSquare, Check, X, ShieldCheck, RefreshCw, Copy, Trash2
} from "lucide-react";
import { Ticket as TicketType } from "../types";

interface DashboardTicketsProps {
  tickets: TicketType[];
  selectedTicket: TicketType | null;
  setSelectedTicket: (ticket: TicketType | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: string;
  setStatusFilter: (filter: string) => void;
  replyMessage: string;
  setReplyMessage: (msg: string) => void;
  submittingReply: boolean;
  replySuccess: boolean;
  submitTicketReply: (status: "approved" | "rejected") => void;
  onDeleteTicket: (id: string, force?: boolean) => void;
  ticketToDeleteId: string | null;
  setTicketToDeleteId: (id: string | null) => void;
}

export default function DashboardTickets({
  tickets,
  selectedTicket,
  setSelectedTicket,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  replyMessage,
  setReplyMessage,
  submittingReply,
  replySuccess,
  submitTicketReply,
  onDeleteTicket,
  ticketToDeleteId,
  setTicketToDeleteId,
}: DashboardTicketsProps) {
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  // Generate randomized license code helper
  const handleGenerateCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const segment = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    const generated = `MED-${segment()}-${segment()}`;
    
    setReplyMessage(`أهلاً بك يا غالي! تم تفعيل اشتراكك بنجاح. كود التفعيل الخاص بك هو: \n\n<code>${generated}</code>\n\nشكراً لثقتك بـ MedKit! 🛡️🩺`);
  };

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("تم نسخ النص والرد التوضيحي للحافظة!");
  };

  // Filters count
  const pendingCount = tickets.filter(t => t.status === "new").length;
  const approvedCount = tickets.filter(t => t.status === "approved").length;
  const rejectedCount = tickets.filter(t => t.status === "rejected").length;

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 text-right font-sans"
    >
      {/* Upper Filters and Search Control Panel */}
      <div className="bg-zinc-900/60 backdrop-blur-xl border border-white/[0.06] p-4 rounded-2xl flex flex-col lg:flex-row gap-4 items-center justify-between">
        
        {/* Search Field */}
        <div className="relative w-full lg:w-96">
          <input
            type="text"
            placeholder="البحث باسم العميل، الإيميل، أو اسم الباقة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950 border border-white/5 rounded-xl py-2.5 pr-4 pl-10 text-xs text-slate-200 placeholder-zinc-500 focus:outline-none"
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        </div>

        {/* Tab-styled Filters */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-zinc-950 border border-white/5 rounded-xl w-full lg:w-auto">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-4 py-2 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
              statusFilter === "all" ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white"
            }`}
          >
            الكل ({tickets.length})
          </button>
          
          <button
            onClick={() => setStatusFilter("new")}
            className={`px-4 py-2 rounded-lg text-[11px] font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === "new" ? "bg-amber-500/10 text-amber-400 border border-amber-500/15" : "text-zinc-400 hover:text-white"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            المعلقة ({pendingCount})
          </button>

          <button
            onClick={() => setStatusFilter("approved")}
            className={`px-4 py-2 rounded-lg text-[11px] font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === "approved" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15" : "text-zinc-400 hover:text-white"
            }`}
          >
            المقبولة ({approvedCount})
          </button>

          <button
            onClick={() => setStatusFilter("rejected")}
            className={`px-4 py-2 rounded-lg text-[11px] font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === "rejected" ? "bg-rose-500/10 text-rose-400 border border-rose-500/15" : "text-zinc-400 hover:text-white"
            }`}
          >
            المرفوضة ({rejectedCount})
          </button>
        </div>

      </div>

      {/* Two-Column Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Tickets feed (5 cols) */}
        <div className="lg:col-span-5 bg-zinc-900/60 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-4 space-y-3 max-h-[750px] overflow-y-auto">
          <div className="px-1 border-b border-white/5 pb-2.5 flex items-center justify-between flex-row-reverse">
            <span className="text-[10px] text-zinc-500 font-mono">Real-time database feed</span>
            <h3 className="text-xs font-black text-white flex items-center gap-2">
              <Ticket className="h-4 w-4 text-violet-400" />
              قائمة طلبات التفعيل
            </h3>
          </div>

          {filteredTickets.length === 0 ? (
            <div className="py-20 text-center text-zinc-500 text-xs">
              لا توجد أي طلبات تفعيل تطابق خيارات التصفية الحالية.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTickets.map((ticket) => {
                const isSelected = selectedTicket?.id === ticket.id;
                return (
                  <div
                    key={ticket.id}
                    onClick={() => {
                      setSelectedTicket(ticket);
                      setReplyMessage(ticket.status === "approved" ? (ticket.adminComment || "") : "");
                    }}
                    className={`p-3.5 rounded-xl transition-all border cursor-pointer text-right flex flex-col space-y-2 ${
                      isSelected 
                        ? "bg-violet-500/10 border-violet-500/30 shadow-md shadow-violet-500/5" 
                        : "bg-zinc-950/40 hover:bg-zinc-950 border-white/5 hover:border-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {new Date(ticket.createdAt).toLocaleDateString("ar-EG")}
                      </span>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${
                        ticket.status === "new" 
                          ? "bg-amber-400/10 text-amber-400 border-amber-400/20" 
                          : ticket.status === "approved"
                            ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20"
                            : "bg-rose-400/10 text-rose-400 border-rose-400/20"
                      }`}>
                        {ticket.status === "new" ? "معلق" : ticket.status === "approved" ? "مقبول" : "مرفوض"}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <p className="font-bold text-xs text-white">{ticket.telegramName}</p>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-400 justify-end">
                        <span className="text-violet-400 font-semibold">{ticket.menuTitle}</span>
                        <span className="text-zinc-700">•</span>
                        <span className="font-mono text-zinc-500 truncate max-w-[150px]">{ticket.email}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Active Ticket Inspector (7 cols) */}
        <div className="lg:col-span-7 bg-zinc-900/60 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 min-h-[500px] flex flex-col justify-between">
          <AnimatePresence mode="wait">
            {selectedTicket ? (
              <motion.div
                key={selectedTicket.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                {/* Header Information */}
                <div className="flex items-start justify-between border-b border-white/5 pb-5">
                  <button
                    onClick={() => onDeleteTicket(selectedTicket.id, true)}
                    className="py-2 px-3.5 bg-rose-500/5 hover:bg-rose-500/10 hover:border-rose-500/20 border border-rose-500/10 text-rose-400 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                    حذف الطلب نهائياً
                  </button>

                  <div className="text-right">
                    <h3 className="font-black text-white text-base">{selectedTicket.telegramName}</h3>
                    <div className="flex items-center gap-2 mt-1.5 justify-end">
                      {selectedTicket.telegramUsername && (
                        <a
                          href={`https://t.me/${selectedSelectedTelegramUsername(selectedTicket.telegramUsername)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-violet-400 hover:underline flex items-center gap-1 font-mono"
                        >
                          @{selectedTicket.telegramUsername}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      <span className="text-zinc-600 font-mono">•</span>
                      <span className="text-xs text-zinc-400 font-mono">Chat ID: {selectedTicket.telegramUserId}</span>
                    </div>
                  </div>
                </div>

                {/* Grid details (2 columns) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-zinc-950/40 border border-white/5 p-4 rounded-xl space-y-1">
                    <span className="text-[10px] text-zinc-500 block">الباقة المطلوبة وتكلفتها</span>
                    <span className="font-bold text-white text-xs block">{selectedTicket.menuTitle}</span>
                    <span className="font-mono text-xs text-violet-400 block">{selectedTicket.price || "سعر غير مسجل"}</span>
                  </div>

                  <div className="bg-zinc-950/40 border border-white/5 p-4 rounded-xl space-y-1">
                    <span className="text-[10px] text-zinc-500 block">البريد الإلكتروني للعميل</span>
                    <span className="font-mono text-white text-xs block truncate">{selectedTicket.email}</span>
                    <span className="text-[10px] text-zinc-500 block">تاريخ الإرسال: {new Date(selectedTicket.createdAt).toLocaleTimeString("ar-EG")}</span>
                  </div>
                </div>

                {/* Proof of Payment Section */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-white">إثبات التحويل المالي (صورة الإيصال):</h4>
                  {selectedTicket.receiptPhotoUrl ? (
                    <div className="relative group overflow-hidden max-h-72 rounded-xl border border-white/5 bg-zinc-950 flex items-center justify-center">
                      <img
                        src={selectedTicket.receiptPhotoUrl}
                        alt="إيصال الدفع"
                        referrerPolicy="no-referrer"
                        className="object-contain max-h-72 w-full hover:scale-105 transition-transform duration-500 cursor-pointer"
                        onClick={() => setZoomImage(selectedTicket.receiptPhotoUrl)}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <span className="text-xs font-black text-white bg-zinc-900/80 px-4 py-2 rounded-xl backdrop-blur-md">انقر لتكبير صورة الإيصال 🔍</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 bg-zinc-950/40 border border-dashed border-white/5 rounded-xl text-center text-zinc-500 text-xs">
                      ⚠️ لم يرفق العميل صورة إيصال، أو تم رفع المعاملة بدون إثبات. يرجى مراجعة العميل تليجرام.
                    </div>
                  )}
                </div>

                {/* Status Indicator */}
                {selectedTicket.status !== "new" && (
                  <div className={`p-4 rounded-xl text-xs flex flex-col gap-1 border text-right ${
                    selectedTicket.status === "approved" 
                      ? "bg-emerald-500/10 border-emerald-500/15 text-emerald-400" 
                      : "bg-rose-500/10 border-rose-500/15 text-rose-400"
                  }`}>
                    <span className="font-black">حالة هذا الطلب حالياً: {selectedTicket.status === "approved" ? "تم القبول والتنشيط" : "تم الرفض"}</span>
                    {selectedTicket.adminComment && (
                      <span className="text-zinc-300 mt-1 block font-mono text-[11px] bg-zinc-950/40 p-2.5 rounded-lg border border-white/5">
                        <b>الرد المرسل:</b> {selectedTicket.adminComment}
                      </span>
                    )}
                  </div>
                )}

                {/* Actions & Code Generation Form */}
                <div className="space-y-3.5 pt-2">
                  <div className="flex items-center justify-between flex-row-reverse">
                    <button
                      type="button"
                      onClick={handleGenerateCode}
                      className="py-1.5 px-3 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/15 rounded-lg text-[10px] font-black transition-all cursor-pointer"
                    >
                      توليد كود تفعيل عشوائي تلقائياً 🪄
                    </button>
                    <label className="text-xs font-black text-zinc-300 block">نص الرد ورسالة التفعيل للعميل:</label>
                  </div>

                  <textarea
                    placeholder="اكتب رد التفعيل (الترخيص) للعميل، أو سبب الرفض لتبليغه تليجرام فوراً..."
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    rows={4}
                    className="w-full bg-zinc-950 border border-white/5 rounded-xl p-3.5 text-xs text-slate-200 focus:outline-none"
                  />

                  {/* Approve / Reject buttons */}
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    
                    <button
                      type="button"
                      disabled={submittingReply || !replyMessage.trim()}
                      onClick={() => submitTicketReply("approved")}
                      className="w-full sm:flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10 disabled:opacity-50"
                    >
                      {submittingReply ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      قبول وتنشيط الاشتراك (إرسال الكود) ✅
                    </button>

                    <button
                      type="button"
                      disabled={submittingReply || !replyMessage.trim()}
                      onClick={() => submitTicketReply("rejected")}
                      className="w-full sm:w-auto py-3 px-5 bg-rose-600/10 hover:bg-rose-600 hover:text-white border border-rose-600/20 text-rose-400 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {submittingReply ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
                      رفض الطلب مع تبليغ السبب ❌
                    </button>

                  </div>
                </div>

              </motion.div>
            ) : (
              <div className="py-20 flex flex-col items-center justify-center text-zinc-500 gap-4">
                <Ticket className="h-14 w-14 text-zinc-700 animate-pulse" />
                <p className="text-xs font-semibold">الرجاء اختيار أحد طلبات التفعيل من القائمة الجانبية لمعاينتها والتحقق من إيصال الدفع وإرسال الكود للعميل.</p>
              </div>
            )}
          </AnimatePresence>
        </div>

      </div>

      {/* Lightbox Photo zoom overlay modal */}
      <AnimatePresence>
        {zoomImage && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 cursor-zoom-out"
            onClick={() => setZoomImage(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative max-w-4xl w-full max-h-[90vh] flex items-center justify-center"
            >
              <img
                src={zoomImage}
                alt="Zoomed"
                referrerPolicy="no-referrer"
                className="max-w-full max-h-[90vh] object-contain rounded-xl"
              />
              <button
                onClick={() => setZoomImage(null)}
                className="absolute top-4 right-4 p-2 bg-zinc-900/80 hover:bg-zinc-800 text-white rounded-full backdrop-blur cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation of delete modal */}
      {ticketToDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-zinc-900 border border-white/5 rounded-2xl p-6 max-w-sm w-full text-right space-y-4">
            <h3 className="font-black text-white text-sm">تأكيد حذف الطلب نهائياً ⚠️</h3>
            <p className="text-xs text-zinc-400">هل أنت متأكد من رغبتك في حذف طلب العميل نهائياً من قاعدة البيانات المحلية؟ لا يمكن استرجاع هذا الطلب لاحقاً.</p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setTicketToDeleteId(null)}
                className="py-2 px-4 bg-zinc-950 hover:bg-zinc-800 text-zinc-400 text-xs rounded-xl cursor-pointer font-bold transition-all"
              >
                إلغاء الأمر
              </button>
              <button
                onClick={() => onDeleteTicket(ticketToDeleteId, true)}
                className="py-2 px-4 bg-rose-600 hover:bg-rose-500 text-white text-xs rounded-xl cursor-pointer font-black transition-all"
              >
                نعم، احذفه
              </button>
            </div>
          </div>
        </div>
      )}

    </motion.div>
  );
}

// Safely parse telegram usernames
function selectedSelectedTelegramUsername(name: string) {
  if (!name) return "";
  return name.replace("@", "").trim();
}

import { motion, AnimatePresence } from "motion/react";
import { 
  MessageSquare, User, ExternalLink, Calendar, Send, Trash2, Check, HelpCircle, FileText
} from "lucide-react";
import { SupportMessage } from "../types";

interface DashboardSupportProps {
  supportMessages: SupportMessage[];
  selectedSupportMessage: SupportMessage | null;
  setSelectedSupportMessage: (msg: SupportMessage | null) => void;
  supportReplyText: string;
  setSupportReplyText: (text: string) => void;
  submittingSupportReply: boolean;
  supportReplySuccess: boolean;
  handleReplySupport: (e: any) => void;
  onDeleteSupportMessage: (id: string) => void;
  renderFormatToolbar: (textareaId: string, value: string, setValue: (val: string) => void) => any;
}

export default function DashboardSupport({
  supportMessages,
  selectedSupportMessage,
  setSelectedSupportMessage,
  supportReplyText,
  setSupportReplyText,
  submittingSupportReply,
  supportReplySuccess,
  handleReplySupport,
  onDeleteSupportMessage,
  renderFormatToolbar,
}: DashboardSupportProps) {
  const unrepliedMessages = supportMessages.filter((m) => !m.replied);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 text-right font-sans"
    >
      {/* Two-column chat split interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left column: Feed of messages (5 cols) */}
        <div className="lg:col-span-5 bg-zinc-900/60 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-4 space-y-3.5 max-h-[750px] overflow-y-auto">
          <div className="px-1 border-b border-white/5 pb-2.5 flex items-center justify-between flex-row-reverse">
            <span className="text-[10px] text-zinc-500 font-mono">Telegram messages inbox</span>
            <h3 className="text-xs font-black text-white flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-violet-400" />
              صندوق رسائل الدعم الفني ({supportMessages.length})
            </h3>
          </div>

          {unrepliedMessages.length > 0 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/15 text-amber-400 rounded-xl text-xs flex items-center gap-1.5 justify-end">
              <span>لديك <b>{unrepliedMessages.length}</b> رسالة جديدة بانتظار ردّك الفني.</span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            </div>
          )}

          {supportMessages.length === 0 ? (
            <div className="py-20 text-center text-zinc-500 text-xs">
              لا توجد رسائل دعم فني واردة حتى الآن.
            </div>
          ) : (
            <div className="space-y-2">
              {supportMessages.map((msg) => {
                const isSelected = selectedSupportMessage?.id === msg.id;
                return (
                  <div
                    key={msg.id}
                    onClick={() => {
                      setSelectedSupportMessage(msg);
                      setSupportReplyText("");
                    }}
                    className={`p-3.5 rounded-xl transition-all border cursor-pointer text-right flex flex-col space-y-2.5 ${
                      isSelected 
                        ? "bg-violet-500/10 border-violet-500/30 shadow-md shadow-violet-500/5" 
                        : "bg-zinc-950/40 hover:bg-zinc-950 border-white/5 hover:border-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-zinc-500 font-mono">
                        {new Date(msg.createdAt).toLocaleDateString("ar-EG")}
                      </span>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${
                        msg.replied 
                          ? "bg-emerald-400/5 text-emerald-400 border-emerald-400/15" 
                          : "bg-amber-400/10 text-amber-400 border-amber-400/20"
                      }`}>
                        {msg.replied ? "تم الرد" : "بانتظار ردك"}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 justify-end">
                        <p className="font-bold text-xs text-white truncate max-w-[150px]">{msg.telegramName}</p>
                      </div>
                      <p className="text-zinc-400 text-xs truncate leading-relaxed line-clamp-1">{msg.messageText}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column: Active Message Inspector & Chat Box (7 cols) */}
        <div className="lg:col-span-7 bg-zinc-900/60 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 min-h-[500px] flex flex-col justify-between">
          <AnimatePresence mode="wait">
            {selectedSupportMessage ? (
              <motion.div
                key={selectedSupportMessage.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6 flex flex-col justify-between h-full"
              >
                {/* Chat Header */}
                <div className="flex items-center justify-between border-b border-white/5 pb-5">
                  <button
                    onClick={() => onDeleteSupportMessage(selectedSupportMessage.id)}
                    className="py-1.5 px-3 bg-rose-500/5 hover:bg-rose-500/10 hover:border-rose-500/20 border border-rose-500/10 text-rose-400 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                    حذف المحادثة
                  </button>

                  <div className="text-right">
                    <h3 className="font-black text-white text-base">{selectedSupportMessage.telegramName}</h3>
                    <div className="flex items-center gap-2 mt-1.5 justify-end">
                      {selectedSupportMessage.telegramUsername && (
                        <a
                          href={`https://t.me/${selectedSupportMessage.telegramUsername.replace("@", "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-violet-400 hover:underline flex items-center gap-1 font-mono"
                        >
                          @{selectedSupportMessage.telegramUsername}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      <span className="text-zinc-600 font-mono">•</span>
                      <span className="text-xs text-zinc-400 font-mono">Chat ID: {selectedSupportMessage.telegramUserId}</span>
                    </div>
                  </div>
                </div>

                {/* Simulated Chat Bubble Feed */}
                <div className="space-y-4 py-2 overflow-y-auto max-h-[350px]">
                  {/* Customer message bubble */}
                  <div className="flex items-start gap-3 flex-row-reverse text-right">
                    <div className="w-8 h-8 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 text-xs font-extrabold shrink-0">
                      C
                    </div>
                    <div className="space-y-1 max-w-[85%]">
                      <div className="p-3.5 bg-zinc-950/60 border border-white/5 rounded-2xl rounded-tr-none text-xs text-slate-100 leading-relaxed font-sans">
                        {selectedSupportMessage.messageText}
                        
                        {/* If message has file/image attachment */}
                        {selectedSupportMessage.messagePhotoUrl && (
                          <div className="mt-3 p-2 bg-zinc-900 border border-white/5 rounded-xl flex items-center justify-between">
                            <a
                              href={selectedSupportMessage.messagePhotoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-violet-400 hover:underline flex items-center gap-1.5 text-[10px]"
                            >
                              عرض المرفق المرسل
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            <FileText className="h-4 w-4 text-zinc-500" />
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono mr-1">
                        {new Date(selectedSupportMessage.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>

                  {/* Admin reply bubble */}
                  {selectedSupportMessage.replied && (
                    <div className="flex items-start gap-3 text-left">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-extrabold shrink-0">
                        A
                      </div>
                      <div className="space-y-1 max-w-[85%] text-right">
                        <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl rounded-tl-none text-xs text-emerald-300 leading-relaxed font-mono">
                          <b>الرد المرسل:</b>
                          <p className="mt-1 whitespace-pre-wrap">{selectedSupportMessage.replyText}</p>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono ml-1 block text-left">
                          تم الرد بنجاح تليجرام ✓
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Reply Form */}
                <form onSubmit={handleReplySupport} className="space-y-3 pt-4 border-t border-white/5">
                  <div className="space-y-0.5">
                    <label className="text-xs font-black text-zinc-300 block mb-1">الرد المباشر وحل الاستفسار:</label>
                    
                    {/* HTML format toolbar */}
                    {renderFormatToolbar("support-reply-textarea", supportReplyText, setSupportReplyText)}
                    
                    <textarea
                      id="support-reply-textarea"
                      placeholder="اكتب رد الدعم الفني، وقم بتنسيقه تليجرام بسهولة..."
                      value={supportReplyText}
                      onChange={(e) => setSupportReplyText(e.target.value)}
                      rows={3}
                      className="w-full bg-zinc-950 border border-white/5 border-t-0 rounded-b-xl p-3 text-xs text-slate-200 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500">سيتم تسليم الرد مباشرة إلى حساب العميل على تليجرام</span>
                    <button
                      type="submit"
                      disabled={submittingSupportReply || !supportReplyText.trim()}
                      className="py-2 px-5 bg-gradient-to-l from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-violet-500/10 disabled:opacity-50"
                    >
                      {submittingSupportReply ? <Check className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      إرسال الرد الفني للمستخدم
                    </button>
                  </div>
                </form>

              </motion.div>
            ) : (
              <div className="py-20 flex flex-col items-center justify-center text-zinc-500 gap-4 h-full">
                <HelpCircle className="h-14 w-14 text-zinc-700 animate-pulse" />
                <p className="text-xs font-semibold">يرجى اختيار أحد تذاكر الدعم الفني المفتوحة للرد على استفسار العميل فوراً تليجرام.</p>
              </div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </motion.div>
  );
}

import { motion } from "motion/react";
import { 
  Bot, Key, RefreshCw, Check, Copy, AlertTriangle, Database, CloudRain,
  ExternalLink, Power, ShieldAlert, CheckCircle2, MessageSquare, Plus, Save
} from "lucide-react";
import { Setting } from "../types";

interface DashboardSettingsProps {
  settings: Setting | null;
  webhookStatus: any;
  tokenInput: string;
  setTokenInput: (val: string) => void;
  adminChatIdInput: string;
  setAdminChatIdInput: (val: string) => void;
  welcomeMsgInput: string;
  setWelcomeMsgInput: (val: string) => void;
  dashboardPasswordInput: string;
  setDashboardPasswordInput: (val: string) => void;
  savingSettings: boolean;
  saveSuccess: boolean;
  saveGlobalSettings: (e: any) => void;
  railwayUrl: string;
  setRailwayUrl: (val: string) => void;
  syncToken: string;
  setSyncToken: (val: string) => void;
  syncStatus: "idle" | "loading" | "success" | "error";
  syncMessage: string;
  handleSyncPull: () => void;
  handleSyncPush: () => void;
  handleResetLocalDB: () => void;
  activateBotWebhook: () => void;
  removeBotWebhook: () => void;
  handleTogglePolling: (enabled: boolean, claimMaster?: boolean) => void;
  fetchingWebhook: boolean;
  copiedSetting: string | null;
  handleCopy: (text: string, id: string) => void;
  renderFormatToolbar: (textareaId: string, value: string, setValue: (val: string) => void) => any;
}

export default function DashboardSettings({
  settings,
  webhookStatus,
  tokenInput,
  setTokenInput,
  adminChatIdInput,
  setAdminChatIdInput,
  welcomeMsgInput,
  setWelcomeMsgInput,
  dashboardPasswordInput,
  setDashboardPasswordInput,
  savingSettings,
  saveSuccess,
  saveGlobalSettings,
  railwayUrl,
  setRailwayUrl,
  syncToken,
  setSyncToken,
  syncStatus,
  syncMessage,
  handleSyncPull,
  handleSyncPush,
  handleResetLocalDB,
  activateBotWebhook,
  removeBotWebhook,
  handleTogglePolling,
  fetchingWebhook,
  copiedSetting,
  handleCopy,
  renderFormatToolbar,
}: DashboardSettingsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 text-right font-sans"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Right Panel: Bot details & form (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Main Bot Settings Credentials */}
          <form onSubmit={saveGlobalSettings} className="bg-zinc-900/60 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 flex-row-reverse">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Bot className="h-4.5 w-4.5 text-violet-400" />
                إعدادات البوت واللوحة الرئيسية ⚙️
              </h3>
              <span className="text-[10px] text-zinc-500 font-mono">Core bot credentials</span>
            </div>

            <div className="space-y-4">
              
              {/* Token Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-zinc-300 block mr-1">توكن البوت (Telegram Bot Token):</label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="أدخل التوكن الخاص بالبوت من @BotFather"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    className="w-full bg-zinc-950 border border-white/5 rounded-xl py-2.5 px-4 text-xs text-slate-200 focus:outline-none font-mono"
                    required
                  />
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600" />
                </div>
              </div>

              {/* Admin Chat ID */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-zinc-300 block mr-1">معرّف المسؤول (Admin Chat ID):</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="مثال: 94819485"
                    value={adminChatIdInput}
                    onChange={(e) => setAdminChatIdInput(e.target.value)}
                    className="w-full bg-zinc-950 border border-white/5 rounded-xl py-2.5 px-4 text-xs text-slate-200 focus:outline-none font-mono text-left"
                    required
                  />
                  <span className="text-[10px] text-zinc-500 absolute right-4 top-1/2 -translate-y-1/2">ID رقمي</span>
                </div>
              </div>

              {/* Dashboard Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-zinc-300 block mr-1">كلمة مرور لوحة التحكم الحالية:</label>
                <input
                  type="text"
                  placeholder="كلمة مرور الدخول للوحة (الافتراضي: admin)"
                  value={dashboardPasswordInput}
                  onChange={(e) => setDashboardPasswordInput(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/5 rounded-xl py-2.5 px-4 text-xs text-slate-200 focus:outline-none font-mono text-left"
                />
              </div>

              {/* Welcome Message Text Area with formatting */}
              <div className="space-y-0.5">
                <label className="text-xs font-black text-zinc-300 block mb-1">الرسالة الترحيبية عند بدء البوت (/start):</label>
                
                {renderFormatToolbar("welcome-msg-textarea", welcomeMsgInput, setWelcomeMsgInput)}
                
                <textarea
                  id="welcome-msg-textarea"
                  placeholder="مرحباً بك في بوت MedKit... مع تنسيقات Telegram HTML المدعومة..."
                  value={welcomeMsgInput}
                  onChange={(e) => setWelcomeMsgInput(e.target.value)}
                  rows={5}
                  className="w-full bg-zinc-950 border border-white/5 border-t-0 rounded-b-xl p-3.5 text-xs text-slate-200 focus:outline-none"
                />
              </div>

            </div>

            {/* Save Buttons & Alerts */}
            <div className="flex items-center justify-between pt-2">
              {saveSuccess && (
                <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                  تم حفظ وتحديث كافة الإعدادات بنجاح! ✓
                </span>
              )}
              <button
                type="submit"
                disabled={savingSettings}
                className="mr-auto py-2.5 px-6 bg-gradient-to-l from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-violet-500/10 disabled:opacity-50"
              >
                {savingSettings ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                حفظ الإعدادات بالكامل
              </button>
            </div>
          </form>

          {/* Webhook & Polling Details Block */}
          <div className="bg-zinc-900/60 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 flex-row-reverse">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Power className="h-4.5 w-4.5 text-violet-400" />
                آلية الاتصال والويب هوك (Telegram Connection) ⚡
              </h3>
              <span className="text-[10px] text-zinc-500 font-mono">Webhooks / Polling</span>
            </div>

            {fetchingWebhook ? (
              <div className="py-6 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-violet-400" />
                جاري جلب تفاصيل الويب هوك من سيرفرات Telegram...
              </div>
            ) : (
              <div className="space-y-4">
                
                {/* Webhook status parameters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-950/40 p-4 rounded-xl border border-white/5 text-xs">
                  <div className="space-y-1 text-right">
                    <span className="text-zinc-500">اسم مستخدم البوت:</span>
                    <p className="font-bold text-white font-mono">
                      {webhookStatus?.botUser ? `@${webhookStatus.botUser.username}` : "غير قادر على سحبه"}
                    </p>
                  </div>
                  <div className="space-y-1 text-right">
                    <span className="text-zinc-500">عنوان الويب هوك الحالي:</span>
                    <p className="font-bold text-white font-mono truncate max-w-[200px]" title={webhookStatus?.webhookInfo?.url}>
                      {webhookStatus?.webhookInfo?.url || "لا يوجد ويب هوك نشط"}
                    </p>
                  </div>
                </div>

                {/* Polling controllers */}
                <div className="p-4 bg-zinc-950/60 border border-white/5 rounded-xl space-y-3">
                  <div className="flex items-center justify-between flex-row-reverse">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                      webhookStatus?.pollingEnabled 
                        ? "bg-emerald-500/10 border-emerald-500/15 text-emerald-400" 
                        : "bg-zinc-800 text-zinc-500 border-white/5"
                    }`}>
                      {webhookStatus?.pollingEnabled ? "مفعّل" : "معطل"}
                    </span>
                    <p className="text-xs font-black text-zinc-300">طريقة الاستعلام الداخلي (Polling Mode):</p>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    مفيدة للتشغيل والتطوير المحلي عندما لا يتوفر سيرفر يدعم الويب هوك. تطلب التحديثات بشكل دوري.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleTogglePolling(!webhookStatus?.pollingEnabled)}
                      className="py-1.5 px-3.5 bg-zinc-900 hover:bg-zinc-800 border border-white/5 text-zinc-300 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                    >
                      {webhookStatus?.pollingEnabled ? "إيقاف الاستعلام" : "تشغيل الاستعلام"}
                    </button>
                    {webhookStatus?.pollingEnabled && (
                      <button
                        type="button"
                        onClick={() => handleTogglePolling(true, true)}
                        className="py-1.5 px-3.5 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/15 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                        title="أخذ صلاحية Polling من السيرفرات الأخرى"
                      >
                        إعلان صلاحية الاستحواذ (Claim Master)
                      </button>
                    )}
                  </div>
                </div>

                {/* Setup Webhook buttons */}
                <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={activateBotWebhook}
                    className="w-full py-2.5 bg-gradient-to-l from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-violet-500/10"
                  >
                    تفعيل الويب هوك السحابي
                  </button>
                  <button
                    type="button"
                    onClick={removeBotWebhook}
                    className="w-full sm:w-auto py-2.5 px-5 bg-rose-600/10 hover:bg-rose-600 hover:text-white border border-rose-600/20 text-rose-400 font-semibold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    حذف وإلغاء الويب هوك
                  </button>
                </div>

              </div>
            )}
          </div>

        </div>

        {/* Left Panel: Sync & DB Maintenance (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Railway Cloud Sync Config */}
          <div className="bg-zinc-900/60 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 flex-row-reverse">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Database className="h-4.5 w-4.5 text-violet-400" />
                المزامنة مع سيرفر Railway السحابي 🔁
              </h3>
              <span className="text-[10px] text-zinc-500 font-mono font-bold">Cloud sync</span>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              تضمن هذه الخاصية حماية باقاتك وحساباتك من الفقدان والقدرة على نقل ونسخ قاعدة البيانات كاملة إلى البيئة السحابية الدائمة.
            </p>

            <div className="space-y-3 text-right">
              
              {/* Railway URL */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-zinc-300 block mr-1">رابط سيرفر Railway السحابي:</label>
                <input
                  type="text"
                  placeholder="مثال: https://my-bot-production.up.railway.app"
                  value={railwayUrl}
                  onChange={(e) => setRailwayUrl(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/5 rounded-xl py-2.5 px-4 text-xs text-slate-200 focus:outline-none font-mono text-left"
                />
              </div>

              {/* Sync Token */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-zinc-300 block mr-1">توكن البوت أو كلمة مرور اللوحة للمصادقة:</label>
                <input
                  type="password"
                  placeholder="التحقق من هوية السيرفر الآخر لإتمام المزامنة"
                  value={syncToken}
                  onChange={(e) => setSyncToken(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/5 rounded-xl py-2.5 px-4 text-xs text-slate-200 focus:outline-none font-mono"
                />
              </div>

              {/* Push & Pull buttons */}
              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleSyncPull}
                  disabled={syncStatus === "loading"}
                  className="py-2.5 bg-zinc-950 hover:bg-zinc-900 text-violet-400 border border-violet-500/10 hover:border-violet-500/20 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="سحب البيانات من السحاب وحفظها محلياً"
                >
                  <CloudRain className="h-4 w-4" />
                  سحب البيانات (Pull)
                </button>

                <button
                  type="button"
                  onClick={handleSyncPush}
                  disabled={syncStatus === "loading"}
                  className="py-2.5 bg-gradient-to-l from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-violet-500/10 disabled:opacity-50"
                  title="استبدال بيانات السيرفر السحابي ببياناتك المحلية"
                >
                  <RefreshCw className="h-4 w-4" />
                  دفع البيانات (Push)
                </button>
              </div>

            </div>

            {/* Sync Progress Logs */}
            {syncStatus !== "idle" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className={`p-3.5 rounded-xl text-xs flex flex-col gap-1 border ${
                  syncStatus === "success" 
                    ? "bg-emerald-500/10 border-emerald-500/15 text-emerald-400" 
                    : syncStatus === "error"
                      ? "bg-rose-500/10 border-rose-500/15 text-rose-400"
                      : "bg-violet-500/10 border-violet-500/15 text-violet-400 animate-pulse"
                }`}
              >
                <div className="flex items-center gap-2 flex-row-reverse">
                  {syncStatus === "success" && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                  {syncStatus === "error" && <ShieldAlert className="h-4 w-4 shrink-0" />}
                  {syncStatus === "loading" && <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />}
                  <span className="font-bold">حالة المزامنة:</span>
                </div>
                <p className="mt-1 leading-relaxed text-[11px] font-mono text-right">{syncMessage}</p>
              </motion.div>
            )}

          </div>

          {/* Local DB Reset Maintenance (Danger Zone) */}
          <div className="bg-zinc-900/60 backdrop-blur-xl border border-rose-500/10 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-black text-rose-400 flex items-center gap-2 justify-end">
              منطقة الخطر والصيانة الفنية ⚠️
              <ShieldAlert className="h-4.5 w-4.5 text-rose-400" />
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              الإجراءات أدناه تقوم بحذف وتصفير كافة الطلبات الواردة والرسائل والعملاء بشكل نهائي من قاعدة البيانات المحلية.
            </p>

            <button
              type="button"
              onClick={handleResetLocalDB}
              className="w-full py-2.5 bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-600/20 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <AlertTriangle className="h-4 w-4" />
              تصفير قاعدة البيانات المحلية بالكامل
            </button>
          </div>

        </div>

      </div>
    </motion.div>
  );
}

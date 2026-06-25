import { motion } from "motion/react";
import { X, Save, Edit, Key, Tag, FileText } from "lucide-react";
import { Menu } from "../types";

interface MenuModalProps {
  showMenuModal: boolean;
  editingMenu: Partial<Menu> | null;
  setEditingMenu: (menu: Partial<Menu> | null) => void;
  isEditingExistingMenu: boolean;
  handleSaveMenu: (e: any) => void;
  renderFormatToolbar: (
    textareaId: string,
    value: string,
    setValue: (val: string) => void,
    customInserter?: (tag: string, isExpandableQuote?: boolean) => void
  ) => any;
  insertFormatForMenuDetails: (tag: string, isExpandableQuote?: boolean) => void;
  setShowMenuModal: (show: boolean) => void;
}

export default function MenuModal({
  showMenuModal,
  editingMenu,
  setEditingMenu,
  isEditingExistingMenu,
  handleSaveMenu,
  renderFormatToolbar,
  insertFormatForMenuDetails,
  setShowMenuModal,
}: MenuModalProps) {
  if (!showMenuModal || !editingMenu) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md font-sans" dir="rtl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl bg-zinc-900 border border-white/5 rounded-3xl p-6 space-y-6 relative overflow-hidden shadow-2xl text-right"
      >
        {/* Glowing visual backdrop */}
        <div className="absolute -left-16 -top-16 w-40 h-40 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4 relative z-10">
          <button
            type="button"
            onClick={() => {
              setShowMenuModal(false);
              setEditingMenu(null);
            }}
            className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
          <h3 className="text-base font-black text-white flex items-center gap-2">
            <Edit className="h-4.5 w-4.5 text-violet-400" />
            {isEditingExistingMenu ? "تعديل باقة الاشتراك الحالية 💳" : "إضافة باقة اشتراك جديدة 💳"}
          </h3>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSaveMenu} className="space-y-4 relative z-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* ID Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-zinc-300 block mr-1">رمز كود الباقة الفريد (ID):</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="مثال: plan_ultra (أحرف إنجليزية وأرقام فقط)"
                  value={editingMenu.id || ""}
                  onChange={(e) => setEditingMenu({ ...editingMenu, id: e.target.value })}
                  disabled={isEditingExistingMenu}
                  className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-slate-100 font-mono text-left focus:outline-none disabled:opacity-40"
                  required
                />
                <Key className="absolute right-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600 pointer-events-none hidden" />
              </div>
            </div>

            {/* Title Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-zinc-300 block mr-1">عنوان اسم الباقة (العربي):</label>
              <input
                type="text"
                placeholder="مثال: اشتراك بريميوم 6 أشهر"
                value={editingMenu.title || ""}
                onChange={(e) => setEditingMenu({ ...editingMenu, title: e.target.value })}
                className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none text-right"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Price Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-zinc-300 block mr-1">سعر الباقة وعرض التفعيل:</label>
              <input
                type="text"
                placeholder="مثال: 150 ريال / $40"
                value={editingMenu.price || ""}
                onChange={(e) => setEditingMenu({ ...editingMenu, price: e.target.value })}
                className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none font-mono"
                required
              />
            </div>

            {/* Description Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-zinc-300 block mr-1">الوصف المختصر بالباقة:</label>
              <input
                type="text"
                placeholder="وصف مختصر يظهر كعنوان ترويجي للباقة"
                value={editingMenu.description || ""}
                onChange={(e) => setEditingMenu({ ...editingMenu, description: e.target.value })}
                className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none text-right"
              />
            </div>
          </div>

          {/* Payment Instructions text area */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-zinc-300 block mr-1">تفاصيل الدفع والتحويل للباقة (تظهر للعميل بعد الاختيار):</label>
            <div className="space-y-0">
              {renderFormatToolbar("menu-details-textarea", editingMenu.details || "", () => {}, insertFormatForMenuDetails)}
              <textarea
                id="menu-details-textarea"
                placeholder="اكتب تفاصيل الدفع الكاملة للباقة (رقم الحساب، اسم البنك، الايميل، تعليمات الارسال...) مع تفعيل التنسيق تليجرام المدعوم..."
                value={editingMenu.details || ""}
                onChange={(e) => setEditingMenu({ ...editingMenu, details: e.target.value })}
                rows={6}
                className="w-full bg-zinc-950 border border-white/5 border-t-0 rounded-b-xl p-4 text-xs text-slate-200 focus:outline-none text-right"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={() => {
                setShowMenuModal(false);
                setEditingMenu(null);
              }}
              className="py-2.5 px-5 bg-zinc-950 hover:bg-zinc-800 text-zinc-400 rounded-xl text-xs font-bold cursor-pointer transition-all"
            >
              إلغاء الأمر
            </button>
            <button
              type="submit"
              className="py-2.5 px-6 bg-gradient-to-l from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black rounded-xl text-xs transition-all cursor-pointer shadow-lg shadow-violet-500/10 flex items-center gap-1.5"
            >
              <Save className="h-4 w-4" />
              حفظ وتحديث الباقة السحابية
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}


import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Button, Input, Modal, Select } from '../UI/SharedComponents';
import { Transaction, Entity, Account, DailySimulationResult, Attachment, Milestone, Frequency } from '../../types';
import { 
  Plus, Trash2, Edit2, Search, Upload, FileText, X, ArrowRightLeft, 
  Repeat, Clock, ArrowUpDown, ArrowUp, ArrowDown, Coins, PlusCircle, 
  Calendar, ShieldCheck, Link, AlertCircle, CheckCircle2, Copy, Eye, 
  EyeOff, Activity, Zap, ArrowDownRight 
} from 'lucide-react';
import { generateId, formatDate, formatCurrency, processFile, addDays } from '../../utils';
import { CATEGORIES } from '../../constants';

interface TransactionsScreenProps {
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  entities: Entity[];
  accounts: Account[];
  simulationResults: DailySimulationResult[];
  selectedEntityId: string;
  setSelectedEntityId: (id: string) => void;
  activeEntityIds: Set<string>;
}

type SortKey = keyof Transaction | 'entityName';

export const TransactionsScreen: React.FC<TransactionsScreenProps> = ({ transactions, setTransactions, entities, accounts, simulationResults, selectedEntityId, setSelectedEntityId, activeEntityIds }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [dateStatusFilter, setDateStatusFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);

  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [newAttachments, setNewAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const initialFormState: Transaction = {
    id: '',
    entityId: entities[0]?.id || '',
    accountId: accounts.filter(a => a.entityId === (entities[0]?.id || ''))[0]?.id || '',
    type: 'expense',
    category: 'ספקים',
    description: '',
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    includesVat: true,
    isRecurring: false,
    frequency: 'Monthly',
    recurringDayMode: 'SameAsStart',
    dayInMonth: 1,
    isActive: true,
    isIntercompany: false,
    targetEntityId: '',
    targetAccountId: '',
    attachments: [],
    milestones: [],
    linkageIndexBase: 0
  };

  const [formData, setFormData] = useState<Transaction>(initialFormState);
  const [isLinked, setIsLinked] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    setIsLinked((formData.linkageIndexBase || 0) > 0);
  }, [formData.linkageIndexBase]);

  /**
   * מרכז התראות: חישוב הזרמות הון נדרשות לישויות בנות ב-90 הימים הקרובים
   */
  const injectionAlerts = useMemo(() => {
    const alerts: { date: string, entityName: string, amount: number, type: string }[] = [];
    const threeMonths = 90;
    const relevantResults = simulationResults.slice(0, threeMonths);
    const seen = new Set<string>();

    relevantResults.forEach(day => {
      day.transactions.forEach(t => {
        // מחפשים תנועות של הזרמת הון (מהצד של הבת) או הזרמה לבת (מהצד של האם)
        if (t.description.includes('הזרמת הון') || t.category === 'הון בעלים' || t.description.includes('הזרמה לבת')) {
            const entName = entities.find(e => e.id === t.entityId)?.name || 'ישות';
            const key = `${day.date}-${t.entityId}-${t.description}`;
            
            // מציגים רק את הצד של הקבלה (הזרמת הון) כדי למנוע כפילויות בממשק
            if (!seen.has(key) && t.amount > 0) {
                alerts.push({
                    date: day.date,
                    entityName: entName,
                    amount: Math.abs(t.amount),
                    type: t.description
                });
                seen.add(key);
            }
        }
      });
    });
    return alerts;
  }, [simulationResults, entities]);

  const isAssetCategory = formData.category === 'רכישת נכסים' || formData.category === 'מכירת נכסים';

  const milestonesTotal = useMemo(() => {
      return (formData.milestones || []).reduce((acc, m) => acc + m.amount, 0);
  }, [formData.milestones]);

  const milestonesDifference = useMemo(() => {
      return formData.amount - milestonesTotal;
  }, [formData.amount, milestonesTotal]);

  const handleOpenModal = (tx?: Transaction) => {
    if (tx) {
        setEditingTransaction(tx);
        setFormData({ ...initialFormState, ...tx });
        setNewAttachments([]);
    } else {
        setEditingTransaction(null);
        const defaultEntityId = selectedEntityId !== 'all' ? selectedEntityId : (entities[0]?.id || '');
        const defaultAccount = accounts.find(a => a.entityId === defaultEntityId);
        setFormData({ 
            ...initialFormState, 
            id: generateId(), 
            entityId: defaultEntityId,
            accountId: defaultAccount?.id || ''
        });
        setNewAttachments([]);
    }
    setIsModalOpen(true);
  };

  const handleDuplicate = (tx: Transaction) => {
    const newTx: Transaction = {
      ...tx,
      id: generateId(),
      description: `${tx.description} (עותק)`,
      attachments: [],
    };
    setTransactions(prev => [newTx, ...prev]);
  };

  const toggleTransactionStatus = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, isActive: !t.isActive } : t));
  };

  const handleSave = () => {
    if (isAssetCategory && formData.milestones && formData.milestones.length > 0) {
        if (Math.abs(milestonesDifference) > 0.01) {
            alert(`שגיאה: סכום אבני הדרך (${formatCurrency(milestonesTotal)}) אינו תואם לסכום העסקה הכולל (${formatCurrency(formData.amount)}). קיים הפרש של ${formatCurrency(milestonesDifference)}.`);
            return;
        }
    }

    const combinedAttachments = [...(formData.attachments || []), ...newAttachments];
    const dataToSave = { ...formData, attachments: combinedAttachments };
    if (editingTransaction) {
        setTransactions(prev => prev.map(t => t.id === editingTransaction.id ? dataToSave : t));
    } else {
        setTransactions(prev => [dataToSave, ...prev]);
    }
    setIsModalOpen(false);
  };

  const addMilestone = () => {
      const milestones = formData.milestones || [];
      const remaining = Math.max(0, milestonesDifference);
      const newMilestone: Milestone = {
          id: generateId(),
          description: `אבן דרך ${milestones.length + 1}`,
          percentage: formData.amount > 0 ? (remaining / formData.amount) * 100 : 0,
          amount: remaining,
          days: 0,
          date: formData.date
      };
      setFormData({ ...formData, milestones: [...milestones, newMilestone] });
  };

  const removeMilestone = (id: string) => {
      setFormData({ ...formData, milestones: formData.milestones?.filter(m => m.id !== id) });
  };

  const updateMilestone = (id: string, updates: Partial<Milestone>) => {
      const milestones = (formData.milestones || []).map(m => {
          if (m.id !== id) return m;
          const updated = { ...m, ...updates };

          if ('percentage' in updates) {
              updated.amount = (formData.amount * (updated.percentage / 100));
          } else if ('amount' in updates) {
              updated.percentage = formData.amount > 0 ? (updated.amount / formData.amount) * 100 : 0;
          }

          if ('days' in updates) {
              const baseDate = new Date(formData.date);
              updated.date = addDays(baseDate, updated.days).toISOString().split('T')[0];
          } else if ('date' in updates) {
              const baseDate = new Date(formData.date);
              const targetDate = new Date(updated.date);
              const diffTime = targetDate.getTime() - baseDate.getTime();
              updated.days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          }

          return updated;
      });
      setFormData({ ...formData, milestones });
  };

  const processedTransactions = useMemo(() => {
      let result = transactions.filter(t => {
          const matchEntity = activeEntityIds.has(t.entityId);
          const matchSearch = t.description.includes(searchQuery) || t.category.includes(searchQuery);
          let matchDateStatus = true;
          const today = new Date().toISOString().split('T')[0];
          if (dateStatusFilter === 'past') matchDateStatus = t.date < today && !t.isRecurring;
          else if (dateStatusFilter === 'future') matchDateStatus = t.date >= today || t.isRecurring;
          let matchActiveStatus = true;
          if (statusFilter === 'active') matchActiveStatus = t.isActive;
          if (statusFilter === 'inactive') matchActiveStatus = !t.isActive;
          return matchEntity && matchSearch && matchDateStatus && matchActiveStatus;
      });

      if (sortConfig) {
          result.sort((a, b) => {
              let valA: any;
              let valB: any;
              if (sortConfig.key === 'entityName') {
                  valA = entities.find(e => e.id === a.entityId)?.name || '';
                  valB = entities.find(e => e.id === b.entityId)?.name || '';
              } else {
                  // Type assertion fix for Vercel build
                  const key = sortConfig.key as keyof Transaction;
                  valA = a[key];
                  valB = b[key];
              }
              
              if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
              if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
              return 0;
          });
      }
      return result;
  }, [transactions, activeEntityIds, dateStatusFilter, statusFilter, searchQuery, sortConfig, entities]);

  const handleSort = (key: SortKey) => {
      let direction: 'asc' | 'desc' = 'asc';
      if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
          direction = 'desc';
      }
      setSortConfig({ key, direction });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
        const files = Array.from(e.target.files);
        const processed = await Promise.all(files.map(processFile));
        setNewAttachments(prev => [...prev, ...processed]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files) {
        const processed = await Promise.all(Array.from(e.dataTransfer.files).map(processFile));
        setNewAttachments(prev => [...prev, ...processed]);
    }
  };

  const removeExistingAttachment = (attId: string) => {
      setFormData(prev => ({ ...prev, attachments: prev.attachments?.filter(a => a.id !== attId) }));
  };

  const removeNewAttachment = (index: number) => {
      setNewAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const SortHeader: React.FC<{ label: string; sortKey: SortKey; className?: string }> = ({ label, sortKey, className = '' }) => (
      <th className={`px-6 py-4 font-medium cursor-pointer hover:bg-slate-800 transition-colors select-none ${className}`} onClick={() => handleSort(sortKey)}>
          <div className={`flex items-center gap-1 ${className.includes('text-left') ? '' : 'justify-start'}`}>
              {label}
              {sortConfig?.key === sortKey ? (
                  sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-indigo-400" /> : <ArrowDown size={14} className="text-indigo-400" />
              ) : (
                  <ArrowUpDown size={14} className="text-slate-600 opacity-50" />
              )}
          </div>
      </th>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 text-right">
      
      {/* מרכז הזרמות הון (Alert Center) */}
      {injectionAlerts.length > 0 && (
         <div className="bg-slate-900 border border-indigo-500/30 rounded-xl overflow-hidden shadow-[0_0_20px_-5px_rgba(79,70,229,0.2)]">
            <div className="bg-indigo-500/10 p-3 px-4 flex items-center justify-between border-b border-indigo-500/10">
                <div className="flex items-center gap-2 text-indigo-400 font-black">
                    <Zap size={20} className="fill-indigo-400" />
                    <span>צפי הזרמות הון נדרשות לישויות בנות (90 יום קרובים)</span>
                </div>
                <span className="text-[10px] bg-indigo-500 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">{injectionAlerts.length} התראות</span>
            </div>
            <div className="divide-y divide-slate-800/50 max-h-48 overflow-y-auto custom-scrollbar">
                {injectionAlerts.map((alert, idx) => (
                    <div key={idx} className="p-3 px-4 flex justify-between items-center hover:bg-slate-800/30 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="bg-indigo-500/20 p-1.5 rounded-lg text-indigo-400">
                                <ArrowDownRight size={16} />
                            </div>
                            <div>
                                <div className="font-bold text-slate-200 text-sm">{alert.entityName}</div>
                                <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                                    <Calendar size={10} /> {formatDate(alert.date)}
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm font-black text-indigo-300" dir="ltr">{formatCurrency(alert.amount)}</div>
                            <div className="text-[9px] text-slate-500">הזרמה לשמירה על יתרת מטרה</div>
                        </div>
                    </div>
                ))}
            </div>
         </div>
      )}

       <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center gap-4 w-full lg:w-auto overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 scrollbar-hide">
                 <div className="relative w-64 shrink-0">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input type="text" placeholder="חפש תנועה..." className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1.5 pr-10 pl-4 text-sm text-white focus:outline-none focus:border-indigo-500" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                 </div>
                 <div className="w-40 shrink-0">
                    <Select options={[{value: 'all', label: 'כל הסטטוסים'}, {value: 'active', label: 'פעיל בלבד'}, {value: 'inactive', label: 'לא פעיל'}]} value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="py-1.5" />
                 </div>
                 <div className="w-40 shrink-0">
                    <Select options={[{value: 'all', label: 'כל המועדים'}, {value: 'future', label: 'תנועות עתידיות'}, {value: 'past', label: 'תנועות עבר'}]} value={dateStatusFilter} onChange={e => setDateStatusFilter(e.target.value)} className="py-1.5" />
                 </div>
                 <div className="w-48 shrink-0">
                    <Select options={[{value: 'all', label: 'כל הישויות (מאוחד)'}, ...entities.map(e => ({value: e.id, label: e.name}))]} value={selectedEntityId} onChange={e => setSelectedEntityId(e.target.value)} className="py-1.5" />
                 </div>
            </div>
            <div className="shrink-0"><Button onClick={() => handleOpenModal()} icon={<Plus size={18} />}>הוספת תנועה</Button></div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
        <table className="w-full text-sm text-right text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-xs">
                <tr>
                    <SortHeader label="תאריך" sortKey="date" className="text-left" />
                    <SortHeader label="תיאור" sortKey="description" className="text-left" />
                    <SortHeader label="שם הישות" sortKey="entityName" />
                    <SortHeader label="קטגוריה" sortKey="category" />
                    <SortHeader label="סכום" sortKey="amount" />
                    <th className="px-6 py-4 font-medium">סוג</th>
                    <th className="px-6 py-4 font-medium text-center">סטטוס</th>
                    <th className="px-6 py-4 font-medium text-left">פעולות</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
                {processedTransactions.map(tx => {
                    return (
                        <tr key={tx.id} className={`hover:bg-slate-800/40 transition-colors group ${!tx.isActive ? 'opacity-40 grayscale-[0.5]' : ''}`}>
                            <td className="px-6 py-4 font-bold text-white whitespace-nowrap text-left">{formatDate(tx.date)}</td>
                            <td className="px-6 py-4 font-bold text-white text-left text-base">
                                <div className="flex items-center gap-2">
                                    {tx.milestones && tx.milestones.length > 0 && <Coins size={14} className="text-indigo-400" />}
                                    {tx.description}
                                </div>
                            </td>
                            <td className="px-6 py-4 text-slate-400">{entities.find(e => e.id === tx.entityId)?.name}</td>
                            <td className="px-6 py-4"><span className="bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-xs text-slate-300">{tx.category}</span></td>
                            <td className={`px-6 py-4 font-bold text-emerald-400`} dir="ltr">{formatCurrency(tx.amount)}</td>
                            <td className="px-6 py-4 text-xs">
                                {tx.isRecurring ? 'מחזורי' : (tx.milestones && tx.milestones.length > 0 ? 'עסקה מדורגת' : (tx.isActive ? 'חד פעמי' : 'מושבת'))}
                            </td>
                            <td className="px-6 py-4 text-center">
                                <button 
                                    onClick={(e) => toggleTransactionStatus(tx.id, e)} 
                                    className={`p-2 rounded-lg border transition-all ${tx.isActive ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'}`}
                                    title={tx.isActive ? 'השבת תנועה (הסתר מהתזרים)' : 'הפעל תנועה (כלול בתזרים)'}
                                >
                                    {tx.isActive ? <Eye size={18} /> : <EyeOff size={18} />}
                                </button>
                            </td>
                            <td className="px-6 py-4 text-left">
                                <div className="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); handleDuplicate(tx); }} 
                                        className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-indigo-400" 
                                        title="שכפל תנועה"
                                    >
                                        <Copy size={16} />
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); handleOpenModal(tx); }} 
                                        className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white" 
                                        title="ערוך תנועה"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(tx.id); }} 
                                        className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-rose-500" 
                                        title="מחק תנועה"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
      </div>

      <Modal isOpen={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="אישור מחיקה">
        <div className="p-4 text-center">
            <p className="text-slate-300 mb-6">האם אתה בטוח שברצונך למחוק תנועה זו? פעולה זו אינה ניתנת לביטול.</p>
            <div className="flex justify-center gap-4">
                <Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>ביטול</Button>
                <Button onClick={() => {
                    if (deleteConfirmId) {
                        setTransactions(prev => prev.filter(t => t.id !== deleteConfirmId));
                        setDeleteConfirmId(null);
                    }
                }} className="bg-rose-600 hover:bg-rose-700">מחק תנועה</Button>
            </div>
        </div>
      </Modal>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingTransaction ? 'עריכת תנועה' : 'הוספת תנועה'}>
         <div className="flex flex-col gap-6 text-right">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900/30 p-4 rounded-xl border border-slate-800">
                 <div className="md:col-span-2"><Input label="תיאור העסקה" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
                 <div className="md:col-span-1"><Select label="סוג" options={[{value: 'expense', label: 'הוצאה'}, {value: 'income', label: 'תקבול'}]} value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})} /></div>
                 <div className="md:col-span-1">
                    <Select label="קטגוריה" options={formData.type === 'income' ? CATEGORIES.income.map(c => ({value: c, label: c})) : CATEGORIES.expense.map(c => ({value: c, label: c}))} value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} />
                 </div>
                 <div className="md:col-span-1"><Select label="ישות" options={entities.map(e => ({value: e.id, label: e.name}))} value={formData.entityId} onChange={e => setFormData({ ...formData, entityId: e.target.value })} /></div>
                 <div className="md:col-span-1"><Select label="חשבון" options={[{value: '', label: 'בחר...'}, ...accounts.filter(a => a.entityId === formData.entityId).map(a => ({ value: a.id, label: `${a.nickname ? a.nickname + ' - ' : ''}${a.bankName} - ${a.accountNumber}` }))]} value={formData.accountId} onChange={e => setFormData({...formData, accountId: e.target.value})} /></div>
                 <Input label="סך הכל סכום העסקה" type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} />
                 <Input label="תאריך בסיס (חתימה)" type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-800/20 rounded-xl border border-slate-800">
                <div className="md:col-span-2 flex items-center justify-between bg-slate-950/40 p-3 rounded-lg border border-slate-700 mb-2">
                    <label className="text-sm font-bold text-slate-300 flex items-center gap-2">
                        <Activity size={16} className="text-indigo-400" /> כלול בתזרים (פעיל)
                    </label>
                    <div className="relative inline-block w-12 h-6 transition duration-200 ease-in">
                        <input 
                            type="checkbox" 
                            className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                            checked={formData.isActive}
                            onChange={e => setFormData({...formData, isActive: e.target.checked})}
                            style={{ left: formData.isActive ? '24px' : '0', transition: 'all 0.2s' }}
                        />
                        <label className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer transition-colors ${formData.isActive ? 'bg-indigo-600' : 'bg-slate-600'}`}></label>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <input type="checkbox" checked={formData.includesVat} onChange={e => setFormData({...formData, includesVat: e.target.checked})} className="w-5 h-5 accent-indigo-500" />
                    <label className="text-sm font-bold text-slate-300 flex items-center gap-1.5"><ShieldCheck size={16} className="text-indigo-400" /> כולל מע"מ</label>
                </div>
                <div className="flex items-center gap-3">
                    <input type="checkbox" checked={formData.isIntercompany} onChange={e => setFormData({...formData, isIntercompany: e.target.checked})} className="w-5 h-5 accent-indigo-500" />
                    <label className="text-sm font-bold text-slate-300 flex items-center gap-1.5"><ArrowRightLeft size={16} className="text-amber-400" /> בין-חברתי</label>
                </div>
                <div className="flex items-center gap-3">
                    <input type="checkbox" checked={formData.isRecurring} onChange={e => setFormData({...formData, isRecurring: e.target.checked})} className="w-5 h-5 accent-indigo-500" />
                    <label className="text-sm font-bold text-slate-300 flex items-center gap-1.5"><Repeat size={16} className="text-indigo-400" /> מחזורית</label>
                </div>

                {formData.isIntercompany && (
                    <div className="md:col-span-2 grid grid-cols-2 gap-4 mt-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg animate-in fade-in slide-in-from-top-2">
                        <Select label="ישות יעד" options={entities.filter(e => e.id !== formData.entityId).map(e => ({value: e.id, label: e.name}))} value={formData.targetEntityId || ''} onChange={e => setFormData({...formData, targetEntityId: e.target.value})} />
                        <Select label="חשבון יעד" options={accounts.filter(a => a.entityId === formData.targetEntityId).map(a => ({value: a.id, label: a.nickname || a.accountNumber}))} value={formData.targetAccountId || ''} onChange={e => setFormData({...formData, targetAccountId: e.target.value})} />
                    </div>
                )}

                {formData.isRecurring && (
                    <div className="md:col-span-2 grid grid-cols-2 gap-4 mt-2 p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-lg animate-in fade-in slide-in-from-top-2">
                        <Select label="תדירות" options={[{value: 'Monthly', label: 'חודשי'}, {value: 'Quarterly', label: 'רבעוני'}, {value: 'SemiAnnually', label: 'חצי שנתי'}, {value: 'Annually', label: 'שנתי'}]} value={formData.frequency || 'Monthly'} onChange={e => setFormData({...formData, frequency: e.target.value as any})} />
                        <Select label="מועד חיוב" options={[{value: 'Specific', label: 'יום ספציפי'}, {value: 'SameAsStart', label: 'לפי תאריך התחלה'}, {value: 'LastDay', label: 'יום אחרון'}]} value={formData.recurringDayMode || 'SameAsStart'} onChange={e => setFormData({...formData, recurringDayMode: e.target.value as any})} />
                        {formData.recurringDayMode === 'Specific' && (
                            <div className="col-span-2">
                                <Input label="יום בחודש (1-31)" type="number" min={1} max={31} value={formData.dayInMonth || 1} onChange={e => setFormData({...formData, dayInMonth: Number(e.target.value)})} />
                            </div>
                        )}
                    </div>
                )}
             </div>

             {isAssetCategory && (
                <div className="bg-slate-800/40 p-5 rounded-xl border border-indigo-500/30 space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-4">
                            <h4 className="font-bold text-indigo-300 flex items-center gap-2"><Coins size={18} /> פריסת תשלומים (אבני דרך)</h4>
                            <div className="flex items-center gap-2 bg-slate-900 px-3 py-1 rounded-lg border border-slate-700">
                                <input type="checkbox" checked={isLinked} onChange={e => {
                                    const checked = e.target.checked;
                                    setIsLinked(checked);
                                    setFormData({...formData, linkageIndexBase: checked ? 100 : 0});
                                }} className="w-4 h-4 accent-indigo-500" />
                                <span className="text-xs text-slate-300">צמוד לממד</span>
                            </div>
                            {isLinked && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500">מדד בסיס:</span>
                                    <input type="number" className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs w-20 text-center" value={formData.linkageIndexBase} onChange={e => setFormData({...formData, linkageIndexBase: Number(e.target.value)})} />
                                </div>
                            )}
                        </div>
                        <Button variant="ghost" className="text-indigo-400 hover:text-white" icon={<PlusCircle size={18} />} onClick={addMilestone}>הוסף אבן דרך</Button>
                    </div>

                    <div className="space-y-3">
                        {(formData.milestones || []).map((m) => (
                            <div key={m.id} className="grid grid-cols-12 gap-3 items-end bg-slate-950/40 p-3 rounded-lg border border-slate-800 group relative">
                                <div className="col-span-3">
                                    <Input label="תיאור" value={m.description} onChange={e => updateMilestone(m.id, { description: e.target.value })} className="text-xs py-1" />
                                </div>
                                <div className="col-span-2">
                                    <Input label="%" type="number" value={m.percentage} onChange={e => updateMilestone(m.id, { percentage: Number(e.target.value) })} className="text-xs py-1 text-center font-bold" />
                                </div>
                                <div className="col-span-2">
                                    <Input label="סכום" type="number" value={m.amount} onChange={e => updateMilestone(m.id, { amount: Number(e.target.value) })} className="text-xs py-1" />
                                </div>
                                <div className="col-span-2">
                                    <Input label="ימים" type="number" value={m.days} onChange={e => updateMilestone(m.id, { days: Number(e.target.value) })} className="text-xs py-1 text-center font-bold" />
                                </div>
                                <div className="col-span-2">
                                    <Input label="תאריך" type="date" value={m.date} onChange={e => updateMilestone(m.id, { date: e.target.value })} className="text-xs py-1" />
                                </div>
                                <div className="col-span-1 pb-1">
                                    <button onClick={() => removeMilestone(m.id)} className="p-2 text-slate-600 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {(formData.milestones || []).length > 0 && (
                        <div className={`mt-4 p-3 rounded-lg border flex items-center justify-between transition-colors ${Math.abs(milestonesDifference) < 0.01 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
                            <div className="flex items-center gap-2">
                                {Math.abs(milestonesDifference) < 0.01 ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                                <span className="text-sm font-bold">
                                    {Math.abs(milestonesDifference) < 0.01 
                                        ? 'סכום אבני הדרך תואם במדויק לסכום העסקה' 
                                        : `קיימת אי-התאמה של ${formatCurrency(milestonesDifference)}`}
                                </span>
                            </div>
                            <div className="text-xs font-mono">
                                {formatCurrency(milestonesTotal)} / {formatCurrency(formData.amount)}
                            </div>
                        </div>
                    )}
                </div>
             )}

             <div className="md:col-span-2 space-y-3">
                <input type="file" multiple ref={attachmentInputRef} className="hidden" onChange={handleFileSelect} />
                <div 
                    className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-slate-500 transition-all cursor-pointer min-h-[140px]
                    ${isDragging ? 'border-indigo-400 bg-indigo-500/10' : 'border-slate-700 hover:border-indigo-500/50 hover:bg-indigo-500/5'}`}
                    onClick={() => attachmentInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                   <Upload size={32} className="mb-2 text-indigo-400" />
                   <span className="text-sm font-bold text-slate-300">גרור מסמכים לכאן או לחץ להעלאה</span>
                   <p className="text-[10px] text-slate-500 mt-1">חוזים, אישורים, אסמכתאות</p>
                </div>

                {(formData.attachments?.length! > 0 || newAttachments.length > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto custom-scrollbar p-1 text-right">
                        {formData.attachments?.map((att) => (
                            <div key={att.id} className="flex justify-between items-center bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <FileText size={14} className="text-indigo-400 shrink-0"/>
                                    <span className="text-xs text-indigo-100 truncate">{att.name}</span>
                                </div>
                                <button onClick={() => removeExistingAttachment(att.id)} className="text-indigo-400 hover:text-rose-400 transition-colors"><X size={14}/></button>
                            </div>
                        ))}
                        {newAttachments.map((att, idx) => (
                            <div key={`new-${idx}`} className="flex justify-between items-center bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <FileText size={14} className="text-emerald-400 shrink-0"/>
                                    <span className="text-xs text-emerald-100 truncate">{att.name}</span>
                                </div>
                                <button onClick={() => removeNewAttachment(idx)} className="text-emerald-400 hover:text-rose-400 transition-colors"><X size={14}/></button>
                            </div>
                        ))}
                    </div>
                )}
             </div>

             <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-800">
                <Button variant="secondary" onClick={() => setIsModalOpen(false)}>ביטול</Button>
                <Button onClick={handleSave}>שמור תנועה</Button>
             </div>
         </div>
      </Modal>
    </div>
  );
};

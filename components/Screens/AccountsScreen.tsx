
import React, { useState, useMemo, useRef } from 'react';
import { Card, Button, Input, Modal, Select } from '../UI/SharedComponents';
import { Account, Entity, Transaction, DailySimulationResult } from '../../types';
import { Plus, Edit2, Trash2, Info, ShieldCheck, FileSpreadsheet, AlertTriangle, Calendar, Percent, Shield, TrendingDown } from 'lucide-react';
import { generateId, formatCurrency, formatDate, addDays } from '../../utils';
import * as XLSX from 'xlsx';

interface AccountsScreenProps {
  accounts: Account[];
  setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
  entities: Entity[];
  transactions: Transaction[];
  simulationResults: DailySimulationResult[];
  selectedEntityId: string;
  setSelectedEntityId: (id: string) => void;
  activeEntityIds: Set<string>;
}

export const AccountsScreen: React.FC<AccountsScreenProps> = ({ accounts, setAccounts, entities, transactions, simulationResults, selectedEntityId, setSelectedEntityId, activeEntityIds }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [selectedAccountHistory, setSelectedAccountHistory] = useState<{acc: Account, txs: any[]} | null>(null);
  
  const todayDateObj = new Date();
  todayDateObj.setHours(0,0,0,0);
  const todayStr = todayDateObj.toISOString().split('T')[0];
  const nextWeekStr = addDays(todayDateObj, 7).toISOString().split('T')[0];
  
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(nextWeekStr);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialFormState: Account = {
    id: '', 
    entityId: entities[0]?.id || '', 
    bankName: '', 
    accountNumber: '', 
    nickname: '', 
    openingBalance: 0, 
    creditLimit: 0, 
    currentCreditUtil: 0, 
    interestSpread: 1.5, 
    isTaxAccount: false, 
    guaranteeLimit: 0, 
    manualGuaranteeUtil: 0
  };

  const [formData, setFormData] = useState<Account>(initialFormState);

  const handleOpenModal = (account?: Account) => {
    if (account) { 
        setEditingAccount(account); 
        setFormData(account); 
    } 
    else {
      setEditingAccount(null);
      const defaultEnt = selectedEntityId !== 'all' ? selectedEntityId : (entities[0]?.id || '');
      setFormData({ ...initialFormState, id: generateId(), entityId: defaultEnt });
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.bankName) return;
    if (editingAccount) setAccounts(prev => prev.map(a => a.id === editingAccount.id ? formData : a));
    else setAccounts(prev => [...prev, formData]);
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => { if (confirm('האם אתה בטוח שברצונך למחוק חשבון זה?')) setAccounts(prev => prev.filter(a => a.id !== id)); };
  const openHistoryModal = (account: Account, txs: any[]) => { setSelectedAccountHistory({ acc: account, txs }); setIsHistoryModalOpen(true); };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result; 
        const wb = XLSX.read(bstr, { type: 'binary' }); 
        const ws = wb.Sheets[wb.SheetNames[0]]; 
        // FIX: Explicitly type data as any[] to allow string indexing
        const data: any[] = XLSX.utils.sheet_to_json(ws);
        
        let updatedCount = 0;
        setAccounts(prevAccounts => prevAccounts.map(acc => {
            const row = data.find((r: any) => String(r['מספר חשבון'] || '').trim() === String(acc.accountNumber).trim());
            if (row) {
                updatedCount++;
                return { 
                    ...acc, 
                    openingBalance: typeof row['יתרה'] === 'number' ? row['יתרה'] : acc.openingBalance, 
                    creditLimit: typeof row['מסגרת אשראי'] === 'number' ? row['מסגרת אשראי'] : acc.creditLimit, 
                    currentCreditUtil: typeof row['שיעור ניצול'] === 'number' ? row['שיעור ניצול'] : acc.currentCreditUtil, 
                    guaranteeLimit: typeof row['מסגרת ערבויות'] === 'number' ? row['מסגרת ערבויות'] : acc.guaranteeLimit, 
                    manualGuaranteeUtil: typeof row['ניצול ערבויות'] === 'number' ? row['ניצול ערבויות'] : acc.manualGuaranteeUtil 
                };
            }
            return acc;
        }));
        if (updatedCount > 0) alert(`עודכנו ${updatedCount} חשבונות בהצלחה!`);
      } catch (error) { alert('שגיאה בקריאת קובץ האקסל.'); }
    };
    reader.readAsBinaryString(file);
  };

  const accountAlerts = useMemo(() => {
    const alerts: any[] = [];
    const next7Days = simulationResults.slice(0, 7);
    accounts.forEach(acc => {
        if (!activeEntityIds.has(acc.entityId)) return;
        let runningBalance = acc.openingBalance;
        for (const day of next7Days) {
            const dayTotal = day.transactions.filter(t => t.accountId === acc.id).reduce((sum, t) => sum + t.amount, 0);
            runningBalance += dayTotal;
            if (runningBalance < 0) {
                alerts.push({ accountId: acc.id, accountName: `${acc.nickname || acc.bankName}`, date: day.date, balance: runningBalance });
                break; 
            }
        }
    });
    return alerts;
  }, [accounts, simulationResults, activeEntityIds]);

  const filteredAccounts = accounts.filter(a => activeEntityIds.has(a.entityId));

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {accountAlerts.length > 0 && (
         <div className="bg-slate-900 border border-amber-500/30 rounded-xl overflow-hidden shadow-[0_0_15px_-3px_rgba(245,158,11,0.1)]">
             <div className="bg-amber-500/10 p-3 px-4 flex items-center justify-between border-b border-amber-500/10"><div className="flex items-center gap-2 text-amber-500 font-bold"><AlertTriangle size={20} /><span>התראות על צפי ליתרה שלילית (שבוע קרוב)</span></div><span className="text-xs bg-amber-500 text-slate-900 px-2 py-0.5 rounded-full font-bold">{accountAlerts.length}</span></div>
             <div className="divide-y divide-slate-800 max-h-64 overflow-y-auto custom-scrollbar">
                 {accountAlerts.map(alert => (
                     <div key={alert.accountId} className="p-3 px-4 flex justify-between items-center hover:bg-slate-800/50 transition-colors"><div className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div><div><div className="font-bold text-slate-200">{alert.accountName}</div><div className="text-xs text-slate-500">צפוי לחרוג ב: {formatDate(alert.date)}</div></div></div><div className="font-bold text-rose-400" dir="ltr">{formatCurrency(alert.balance)}</div></div>
                 ))}
             </div>
         </div>
      )}

      <div className="flex flex-col lg:flex-row justify-between items-end lg:items-center gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
         <div className="flex flex-wrap gap-4 items-center w-full lg:w-auto">
             <div className="flex flex-col gap-1 min-w-[180px]">
                <label className="text-xs text-slate-400 font-medium">סינון לפי ישות</label>
                <Select options={[{value: 'all', label: 'כל הישויות (מאוחד)'}, ...entities.map(e => ({value: e.id, label: e.name}))]} value={selectedEntityId} onChange={e => setSelectedEntityId(e.target.value)} className="py-1" />
             </div>
             
             <div className="flex flex-col gap-1 min-w-[150px]">
                <label className="text-xs text-slate-400 font-medium">מתאריך</label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="py-1" />
             </div>

             <div className="flex flex-col gap-1 min-w-[150px]">
                <label className="text-xs text-slate-400 font-medium">עד תאריך</label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="py-1" />
             </div>
         </div>
         
         <div className="flex gap-3 shrink-0">
            <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleExcelUpload} />
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()} icon={<FileSpreadsheet size={18} className="text-emerald-500" />}>ייבוא דוח יתרות</Button>
            <Button onClick={() => handleOpenModal()} icon={<Plus size={18} />}>הוספת חשבון</Button>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredAccounts.map(account => {
            const entity = entities.find(e => e.id === account.entityId);
            const unifiedTransactions: any[] = [];
            
            const simStartDate = new Date(startDate) > todayDateObj ? new Date(startDate) : todayDateObj;
            const relevantSimDays = simulationResults.filter(d => { 
                const dDate = new Date(d.date); 
                return dDate >= simStartDate && dDate <= new Date(endDate); 
            });

            let simMovementInPeriod = 0;
            const daysUntilEnd = simulationResults.filter(d => new Date(d.date) <= new Date(endDate));
            const simTotalChangeFromToday = daysUntilEnd.reduce((sum, day) => { 
                const dayTxs = day.transactions.filter(t => t.accountId === account.id); 
                return sum + dayTxs.reduce((s, t) => s + t.amount, 0); 
            }, 0);

            relevantSimDays.forEach(day => { 
                const dayTxs = day.transactions.filter(t => t.accountId === account.id); 
                simMovementInPeriod += dayTxs.reduce((s, t) => s + t.amount, 0); 
                dayTxs.forEach(t => { 
                    unifiedTransactions.push({ 
                        id: generateId(), 
                        date: day.date, 
                        description: t.description, 
                        category: t.category || 'כללי', 
                        amount: Math.abs(t.amount), 
                        type: t.amount >= 0 ? 'income' : 'expense', 
                        entityId: account.entityId, 
                        isSimulation: true 
                    }); 
                }); 
            });

            const pastStaticTxs = transactions.filter(t => 
                t.accountId === account.id && 
                !t.isRecurring && 
                t.date >= startDate && 
                new Date(t.date) < todayDateObj 
            );
            const pastMovement = pastStaticTxs.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);
            pastStaticTxs.forEach(t => unifiedTransactions.push(t));

            const periodMovement = pastMovement + simMovementInPeriod;
            const projectedClosing = account.openingBalance + simTotalChangeFromToday;
            unifiedTransactions.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            const availCredit = Math.max(0, account.creditLimit - account.currentCreditUtil);
            const availGuarantee = Math.max(0, account.guaranteeLimit - account.manualGuaranteeUtil);

            return (
                <Card key={account.id} className="relative group overflow-hidden border-t-4 border-t-indigo-500 bg-slate-900 shadow-2xl">
                    <div className="flex justify-between items-start mb-4">
                        <div className="text-right flex-1">
                            <h3 className="text-xl font-black text-white leading-tight tracking-tight">
                                {account.nickname || account.bankName}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-sm font-medium text-indigo-400">{entity?.name}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5 font-mono">{account.accountNumber}</div>
                        </div>
                        <div className="text-left shrink-0">
                            {account.isTaxAccount && (
                                <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full border border-amber-500/20 text-[10px] font-bold mb-2">
                                    <ShieldCheck size={10} /> מיסים
                                </span>
                            )}
                            <div className="text-xs font-black text-slate-100">{account.bankName}</div>
                        </div>
                    </div>

                    <div className="mb-6 py-4 border-y border-slate-800/50 text-center">
                        <div className="text-3xl font-black text-emerald-400 tracking-tighter" dir="ltr">{formatCurrency(account.openingBalance)}</div>
                        <div className="text-[10px] text-slate-500 mt-1 font-medium">יתרה נוכחית</div>
                    </div>

                    <div className="space-y-3 mb-6">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-850/30 p-2 rounded-lg border border-slate-700/30">
                                <div className="text-[10px] text-slate-500 mb-0.5">מסגרת אשראי</div>
                                <div className="text-sm font-bold text-slate-200" dir="ltr">{formatCurrency(account.creditLimit)}</div>
                                <div className="text-[9px] text-indigo-400 mt-0.5">פנוי: {formatCurrency(availCredit)}</div>
                            </div>
                            <div className="bg-slate-850/30 p-2 rounded-lg border border-slate-700/30">
                                <div className="text-[10px] text-slate-500 mb-0.5">מסגרת ערבויות</div>
                                <div className="text-sm font-bold text-slate-200" dir="ltr">{formatCurrency(account.guaranteeLimit)}</div>
                                <div className="text-[9px] text-emerald-400 mt-0.5">פנוי: {formatCurrency(availGuarantee)}</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-850/50 p-3 rounded-xl border border-slate-700/50 cursor-pointer hover:bg-slate-800 transition-all group/stat flex flex-col items-center" onClick={() => openHistoryModal(account, unifiedTransactions)}>
                                <div className={`text-lg font-black ${periodMovement >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} dir="ltr">{periodMovement > 0 ? '+' : ''}{formatCurrency(periodMovement)}</div>
                                <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">תנועה בתקופה <Info size={9}/></div>
                            </div>
                            <div className="bg-slate-850/50 p-3 rounded-xl border border-slate-700/50 flex flex-col items-center">
                                <div className="text-lg font-black text-indigo-300" dir="ltr">{formatCurrency(projectedClosing)}</div>
                                <div className="text-[10px] text-slate-500 mt-0.5">יתרה חזויה</div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center">
                         <div className="text-[10px] text-slate-500 font-mono">P + {account.interestSpread}%</div>
                         <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleOpenModal(account)} className="p-1.5 bg-slate-800 rounded-lg hover:bg-indigo-600 transition-colors text-slate-300 hover:text-white shadow-lg"><Edit2 size={12}/></button>
                            <button onClick={() => handleDelete(account.id)} className="p-1.5 bg-slate-800 rounded-lg hover:bg-rose-600 transition-colors text-slate-300 hover:text-white shadow-lg"><Trash2 size={12}/></button>
                        </div>
                    </div>
                </Card>
            );
        })}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingAccount ? 'עריכת חשבון' : 'הוספת חשבון חדש'}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2 space-y-4">
                  <Select label="ישות משויכת" options={entities.map(e => ({value: e.id, label: e.name}))} value={formData.entityId} onChange={e => setFormData({...formData, entityId: e.target.value})} />
                  <div className="flex items-center gap-3 bg-slate-950/30 p-3 rounded-lg border border-slate-800">
                      <input 
                        type="checkbox" 
                        id="isTaxAccount"
                        checked={formData.isTaxAccount} 
                        onChange={e => setFormData({...formData, isTaxAccount: e.target.checked})} 
                        className="w-5 h-5 accent-amber-500 rounded"
                      />
                      <label htmlFor="isTaxAccount" className="text-sm font-medium text-slate-300 flex items-center gap-2">
                          <ShieldCheck size={16} className="text-amber-500" />
                          חשבון מיסים ייעודי
                      </label>
                  </div>
              </div>

              <Input label="שם הבנק" value={formData.bankName} onChange={e => setFormData({...formData, bankName: e.target.value})} placeholder="לדוגמה: לאומי" />
              <Input label="מספר חשבון" value={formData.accountNumber} onChange={e => setFormData({...formData, accountNumber: e.target.value})} />
              <div className="md:col-span-2">
                <Input label="כינוי החשבון" value={formData.nickname} onChange={e => setFormData({...formData, nickname: e.target.value})} placeholder="לדוגמה: עו״ש פעילות" />
              </div>

              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
                  <Input label="יתרה נוכחית" type="number" value={formData.openingBalance} onChange={e => setFormData({...formData, openingBalance: Number(e.target.value)})} />
                  <Input label="ניצול מסגרת בפועל" type="number" value={formData.currentCreditUtil} onChange={e => setFormData({...formData, currentCreditUtil: Number(e.target.value)})} />
                  <div className="relative">
                      <Input label="מרווח ריבית (P+)" type="number" step="0.01" value={formData.interestSpread} onChange={e => setFormData({...formData, interestSpread: Number(e.target.value)})} />
                      <Percent size={14} className="absolute left-3 top-9 text-slate-500" />
                  </div>
              </div>

              <div className="md:col-span-1 space-y-4">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                      <TrendingDown size={14} /> מסגרת אשראי
                  </h4>
                  <Input label="גובה מסגרת" type="number" value={formData.creditLimit} onChange={e => setFormData({...formData, creditLimit: Number(e.target.value)})} />
              </div>

              <div className="md:col-span-1 space-y-4">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                      <Shield size={14} /> ערבויות
                  </h4>
                  <Input label="מסגרת ערבויות" type="number" value={formData.guaranteeLimit} onChange={e => setFormData({...formData, guaranteeLimit: Number(e.target.value)})} />
                  <Input label="ניצול ערבויות ידני" type="number" value={formData.manualGuaranteeUtil} onChange={e => setFormData({...formData, manualGuaranteeUtil: Number(e.target.value)})} />
              </div>
          </div>
          <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-800"><Button variant="secondary" onClick={() => setIsModalOpen(false)}>ביטול</Button><Button onClick={handleSave}>שמור שינויים</Button></div>
      </Modal>

      <Modal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} title={`פירוט תנועות - ${selectedAccountHistory?.acc.nickname || ''}`}>
         <div className="overflow-x-auto max-h-[60vh]"><table className="w-full text-sm text-right text-slate-300"><thead className="bg-slate-800 text-slate-400 sticky top-0"><tr><th className="px-4 py-2">תאריך</th><th className="px-4 py-2">תיאור</th><th className="px-4 py-2">קטגוריה</th><th className="px-4 py-2">סכום</th><th className="px-4 py-2">מקור</th></tr></thead><tbody className="divide-y divide-slate-800">{selectedAccountHistory?.txs.map((tx, idx) => (<tr key={tx.id || idx} className="hover:bg-slate-800/50"><td className="px-4 py-2">{formatDate(tx.date)}</td><td className="px-4 py-2">{tx.description}</td><td className="px-4 py-2">{tx.category}</td><td className={`px-4 py-2 font-bold ${tx.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`} dir="ltr">{tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}</td><td className="px-4 py-2 text-xs text-slate-500">{tx.isSimulation ? 'תחזית' : 'ידני'}</td></tr>))}</tbody></table></div>
         <div className="flex justify-end mt-4"><Button variant="secondary" onClick={() => setIsHistoryModalOpen(false)}>סגור</Button></div>
      </Modal>
    </div>
  );
};

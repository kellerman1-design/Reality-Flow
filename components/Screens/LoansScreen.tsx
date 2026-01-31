
import React, { useState, useMemo, useRef } from 'react';
import { Button, Input, Modal, Select } from '../UI/SharedComponents';
import { Loan, Entity, Account, Attachment, Frequency } from '../../types';
import { Plus, Edit2, Trash2, Copy, Search, AlertTriangle, Upload, FileText, X, Paperclip, RefreshCw, Calendar, Eye, EyeOff } from 'lucide-react';
import { generateId, formatDate, formatCurrency, processFile } from '../../utils';

interface LoansScreenProps {
  loans: Loan[];
  setLoans: React.Dispatch<React.SetStateAction<Loan[]>>;
  entities: Entity[];
  accounts: Account[];
  selectedEntityId: string;
  setSelectedEntityId: (id: string) => void;
  activeEntityIds: Set<string>;
}

export const LoansScreen: React.FC<LoansScreenProps> = ({ loans, setLoans, entities, accounts, selectedEntityId, setSelectedEntityId, activeEntityIds }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [newAttachments, setNewAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const initialFormState: Loan = {
    id: '',
    entityId: entities[0]?.id || '',
    accountId: accounts.filter(a => a.entityId === (entities[0]?.id || ''))[0]?.id || '',
    name: '',
    principal: 0,
    spread: 1.05,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    interestFrequency: 'Monthly',
    principalFrequency: 'OneTime',
    needsRollover: false,
    isActive: true,
    rolloverFrequency: 'Annually',
    attachments: []
  };

  const [formData, setFormData] = useState<Loan>(initialFormState);

  // Business Logic: Identify loans expiring in the next 30 days (Includes inactive as requested)
  const expiringAlerts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    return loans.filter(loan => {
      const endDate = new Date(loan.endDate);
      return endDate >= today && endDate <= thirtyDaysFromNow;
    });
  }, [loans]);

  const handleOpenModal = (loan?: Loan) => {
    if (loan) { 
      setEditingLoan(loan); 
      setFormData(loan); 
      setNewAttachments([]); 
    } else {
      setEditingLoan(null);
      const defaultEnt = selectedEntityId !== 'all' ? selectedEntityId : (entities[0]?.id || '');
      const defaultAcc = accounts.find(a => a.entityId === defaultEnt);
      setFormData({ ...initialFormState, id: generateId(), entityId: defaultEnt, accountId: defaultAcc?.id || '' });
      setNewAttachments([]);
    }
    setIsModalOpen(true);
  };

  /**
   * Duplicates a loan and adds it to the list.
   * Business Logic: Create an identical loan with a new ID and today's start date.
   */
  const handleDuplicate = (loan: Loan) => {
    const newLoan: Loan = {
        ...loan,
        id: generateId(),
        name: `${loan.name} (עותק)`,
        startDate: new Date().toISOString().split('T')[0]
    };
    setLoans(prev => [newLoan, ...prev]);
  };

  const handleSave = () => {
    if (!formData.name || !formData.principal) return;
    const combinedAttachments = [...(formData.attachments || []), ...newAttachments];
    const dataToSave = { ...formData, attachments: combinedAttachments };
    if (editingLoan) setLoans(prev => prev.map(l => l.id === editingLoan.id ? dataToSave : l));
    else setLoans(prev => [...prev, dataToSave]);
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => { if (confirm('האם אתה בטוח שברצונך למחוק הלוואה זו?')) setLoans(prev => prev.filter(l => l.id !== id)); };

  const toggleStatus = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLoans(prev => prev.map(l => l.id === id ? { ...l, isActive: !l.isActive } : l));
  };

  const handleFileSelect = async (e: any) => { if (e.target.files) { const files = Array.from(e.target.files); const processed = await Promise.all(files.map(processFile)); setNewAttachments(prev => [...prev, ...processed] as Attachment[]); } };
  const handleDragOver = (e: any) => { e.preventDefault(); setIsDragging(true); };
  const handleDrop = async (e: any) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files) { const processed = await Promise.all(Array.from(e.dataTransfer.files).map(processFile)); setNewAttachments(prev => [...prev, ...processed] as Attachment[]); } };
  const removeNewAttachment = (index: number) => { setNewAttachments(prev => prev.filter((_, i) => i !== index)); };
  const removeExistingAttachment = (attId: string) => { setFormData(prev => ({ ...prev, attachments: prev.attachments?.filter(a => a.id !== attId) })); };

  // FIX: Updated filtering logic to use activeEntityIds
  const filteredLoans = loans.filter(l => { 
    const matchText = l.name.includes(searchQuery); 
    const matchEntity = activeEntityIds.has(l.entityId); 
    return matchText && matchEntity; 
  });

  const freqOptions = [
    { value: 'Monthly', label: 'חודשי' },
    { value: 'Quarterly', label: 'רבעוני' },
    { value: 'SemiAnnually', label: 'חצי שנתי' },
    { value: 'Annually', label: 'שנתי' }
  ];

  const principalFreqOptions = [
    ...freqOptions,
    { value: 'OneTime', label: 'בלון (בסוף)' }
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Alert Banner for Expiring Loans */}
      {expiringAlerts.length > 0 && (
        <div className="bg-slate-900 border border-amber-500/30 rounded-xl overflow-hidden shadow-[0_0_15px_-3px_rgba(245,158,11,0.1)]">
          <div className="bg-amber-500/10 p-3 px-4 flex items-center justify-between border-b border-amber-500/10">
            <div className="flex items-center gap-2 text-amber-500 font-bold">
              <AlertTriangle size={18} />
              <span>הלוואות שמסתיימות בחודש הקרוב (כולל לא פעילות)</span>
            </div>
            <span className="text-xs bg-amber-500 text-slate-900 px-2 py-0.5 rounded-full font-bold">{expiringAlerts.length}</span>
          </div>
          <div className="divide-y divide-slate-800 max-h-64 overflow-y-auto custom-scrollbar">
            {expiringAlerts.map(loan => (
              <div key={loan.id} className="p-3 px-4 flex justify-between items-center hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center gap-3">
                   {!loan.isActive && <span className="text-[10px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded border border-slate-700">לא פעיל</span>}
                   <div>
                     <div className="font-bold text-slate-200">{loan.name}</div>
                     <div className="text-xs text-slate-500">{entities.find(e => e.id === loan.entityId)?.name}</div>
                   </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-amber-400" dir="ltr">{formatCurrency(loan.principal)}</div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1 justify-end mt-1">
                    <Calendar size={10} /> {formatDate(loan.endDate)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
         <div className="flex gap-4 items-center w-full md:w-auto flex-1">
           <div className="relative flex-1 max-w-xs">
             <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
             <input type="text" placeholder="חפש הלוואה..." className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1.5 pr-10 pl-4 text-sm text-white focus:outline-none focus:border-indigo-500" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
           </div>
           <div className="w-48">
             <Select options={[{value: 'all', label: 'כל הישויות (מאוחד)'}, ...entities.map(e => ({value: e.id, label: e.name}))]} value={selectedEntityId} onChange={e => setSelectedEntityId(e.target.value)} className="py-1.5" />
           </div>
         </div>
         <Button onClick={() => handleOpenModal()} icon={<Plus size={18} />}>הוספת הלוואה</Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
        <table className="w-full text-sm text-right text-slate-300">
          <thead className="bg-slate-950 text-slate-400 uppercase text-xs">
            <tr>
              <th className="px-6 py-4">שם ההלוואה</th>
              <th className="px-6 py-4">ישות</th>
              <th className="px-6 py-4">קרן</th>
              <th className="px-6 py-4">ריבית</th>
              <th className="px-6 py-4">תאריך פירעון</th>
              <th className="px-6 py-4 text-center">סטטוס</th>
              <th className="px-6 py-4 text-left">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {filteredLoans.map(loan => (
              <tr key={loan.id} className={`hover:bg-slate-800/40 transition-colors group ${!loan.isActive ? 'opacity-50' : ''}`}>
                <td className="px-6 py-4 font-bold text-white">{loan.name}</td>
                <td className="px-6 py-4 text-slate-400">{entities.find(e => e.id === loan.entityId)?.name}</td>
                <td className="px-6 py-4 font-bold" dir="ltr">{formatCurrency(loan.principal)}</td>
                <td className="px-6 py-4" dir="ltr">P + {loan.spread}%</td>
                <td className="px-6 py-4">{formatDate(loan.endDate)}</td>
                <td className="px-6 py-4 text-center">
                    <button 
                        onClick={(e) => toggleStatus(loan.id, e)} 
                        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 mx-auto border ${loan.isActive ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'}`} 
                        title={loan.isActive ? 'פעיל' : 'לא פעיל'}
                    >
                        {loan.isActive ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                </td>
                <td className="px-6 py-4 text-left">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleDuplicate(loan)} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-indigo-400" title="שכפל הלוואה"><Copy size={16}/></button>
                    <button onClick={() => handleOpenModal(loan)} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white" title="ערוך הלוואה"><Edit2 size={16}/></button>
                    <button onClick={() => handleDelete(loan.id)} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-rose-500" title="מחק הלוואה"><Trash2 size={16}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingLoan ? 'עריכת הלוואה' : 'הוספת הלוואה'}>
        <div className="flex flex-col-reverse md:flex-row gap-8">
          {/* Form Section */}
          <div className="w-full md:w-2/3 flex flex-col gap-5">
            <div className="flex items-center gap-4">
                <div className="flex-1">
                    <Input label="שם ההלוואה" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="pt-5 flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="loanIsActive"
                      checked={formData.isActive} 
                      onChange={e => setFormData({...formData, isActive: e.target.checked})}
                      className="w-5 h-5 accent-indigo-500 rounded bg-slate-950 border-slate-700"
                    />
                    <label htmlFor="loanIsActive" className="text-sm font-bold text-slate-300 cursor-pointer">פעילה בסימולציה</label>
                </div>
            </div>
            
            <div>
              <Select label="ישות" options={entities.map(e => ({value: e.id, label: e.name}))} value={formData.entityId} onChange={e => {
                const newEntityId = e.target.value;
                const relevantAccounts = accounts.filter(a => a.entityId === newEntityId);
                setFormData({ ...formData, entityId: newEntityId, accountId: relevantAccounts.length > 0 ? relevantAccounts[0].id : '' });
              }} />
            </div>

            <div>
              <Select label="חשבון בנק" options={accounts.filter(a => a.entityId === formData.entityId).map(a => ({ 
                value: a.id, 
                label: `${a.nickname ? a.nickname + ' - ' : ''}${a.bankName} - ${a.accountNumber}` 
              }))} value={formData.accountId} onChange={e => setFormData({...formData, accountId: e.target.value})} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input label="קרן מקורית" type="number" value={formData.principal} onChange={e => setFormData({...formData, principal: Number(e.target.value)})} />
              <Input label="מרווח ריבית (%)" type="number" value={formData.spread} onChange={e => setFormData({...formData, spread: Number(e.target.value)})} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input label="תאריך התחלה" type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
              <Input label="תאריך פירעון" type="date" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Select label="תדירות ריבית" options={freqOptions} value={formData.interestFrequency} onChange={e => setFormData({...formData, interestFrequency: e.target.value as Frequency})} />
              <Select label="תדירות קרן" options={principalFreqOptions} value={formData.principalFrequency} onChange={e => setFormData({...formData, principalFrequency: e.target.value as Frequency})} />
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center justify-center gap-3">
               <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => setFormData({...formData, needsRollover: !formData.needsRollover})}>
                 <div className="text-indigo-400"><RefreshCw size={20} /></div>
                 <span className="text-sm font-bold text-slate-300">נדרש גלגול?</span>
                 <input 
                   type="checkbox" 
                   checked={formData.needsRollover} 
                   onChange={e => setFormData({...formData, needsRollover: e.target.checked})}
                   className="w-5 h-5 accent-indigo-500 rounded bg-slate-950 border-slate-700"
                 />
               </div>
            </div>
          </div>

          {/* Attachments Section */}
          <div className="w-full md:w-1/3 flex flex-col">
            <input type="file" multiple ref={attachmentInputRef} className="hidden" onChange={handleFileSelect} />
            <div className={`flex-1 border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-start text-center min-h-[400px] transition-all ${isDragging ? 'border-indigo-400 bg-indigo-500/10' : 'border-slate-800 bg-slate-950/40 hover:bg-slate-900/60'}`} onDragOver={handleDragOver} onDrop={handleDrop}>
              <div className="mb-6 mt-8">
                <div className="bg-slate-800 p-4 rounded-2xl inline-block text-slate-400 mb-4"><Upload size={32} /></div>
                <h4 className="font-bold text-slate-200 text-lg mb-2">מסמכים וצרופות</h4>
                <p className="text-xs text-slate-500 px-2 leading-relaxed">גרור קבצים לכאן (חוזים, נספחים) או לחץ להעלאה</p>
              </div>
              <Button variant="secondary" className="text-sm py-2 px-6 h-auto mb-8 bg-slate-900 border-slate-700" icon={<Upload size={16} />} onClick={() => attachmentInputRef.current?.click()}>העלה קובץ</Button>
              
              <div className="w-full space-y-2 overflow-y-auto max-h-[250px] custom-scrollbar text-right pr-2">
                {formData.attachments?.map((att) => (
                  <div key={att.id} className="flex justify-between items-center bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 overflow-hidden"><FileText size={14} className="text-indigo-400 shrink-0"/><a href={att.url} download={att.name} target="_blank" rel="noreferrer" className="text-xs text-indigo-100 truncate hover:text-white" title={att.name}>{att.name}</a></div>
                    <button onClick={() => removeExistingAttachment(att.id)} className="text-indigo-400 hover:text-rose-400 p-1"><X size={14} /></button>
                  </div>
                ))}
                {newAttachments.map((att, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 overflow-hidden"><FileText size={14} className="text-emerald-500 shrink-0"/><span className="text-xs text-slate-200 truncate">{att.name}</span></div>
                    <button onClick={() => removeNewAttachment(idx)} className="text-slate-500 hover:text-rose-400 p-1"><X size={14} /></button>
                  </div>
                ))}
                {(!formData.attachments || formData.attachments.length === 0) && newAttachments.length === 0 && <div className="text-xs text-slate-700 mt-12">אין מסמכים מצורפים</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-10 pt-6 border-t border-slate-800">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)} className="px-8 bg-slate-800">ביטול</Button>
          <Button onClick={handleSave} className="px-10 bg-indigo-600">שמור</Button>
        </div>
      </Modal>
    </div>
  );
};

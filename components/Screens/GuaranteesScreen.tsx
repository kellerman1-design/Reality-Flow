
import React, { useState, useRef, useMemo } from 'react';
import { Button, Input, Modal, Select } from '../UI/SharedComponents';
import { Guarantee, Entity, Account, Attachment } from '../../types';
import { Plus, Edit2, Trash2, Search, Upload, FileText, X, Paperclip, Shield, Calendar, Info, Calculator, AlertTriangle } from 'lucide-react';
import { generateId, formatDate, formatCurrency, processFile } from '../../utils';

interface GuaranteesScreenProps {
  guarantees: Guarantee[];
  setGuarantees: React.Dispatch<React.SetStateAction<Guarantee[]>>;
  entities: Entity[];
  accounts: Account[];
  selectedEntityId: string;
  setSelectedEntityId: (id: string) => void;
  activeEntityIds: Set<string>;
}

export const GuaranteesScreen: React.FC<GuaranteesScreenProps> = ({ guarantees, setGuarantees, entities, accounts, selectedEntityId, setSelectedEntityId, activeEntityIds }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGuarantee, setEditingGuarantee] = useState<Guarantee | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [newAttachments, setNewAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const initialFormState: Guarantee = {
    id: '',
    entityId: entities[0]?.id || '',
    accountId: accounts.filter(a => a.entityId === (entities[0]?.id || ''))[0]?.id || '',
    beneficiary: '',
    amount: 0,
    issueDate: new Date().toISOString().split('T')[0],
    expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    setupFee: 0,
    annualInterestRate: 0.75,
    notes: '',
    attachments: []
  };

  const [formData, setFormData] = useState<Guarantee>(initialFormState);

  const expiringAlerts = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const thirtyDaysFromNow = new Date(); thirtyDaysFromNow.setDate(today.getDate() + 30);
    return guarantees.filter(g => {
        if (!activeEntityIds.has(g.entityId)) return false;
        const expiry = new Date(g.expiryDate);
        return expiry >= today && expiry <= thirtyDaysFromNow;
    });
  }, [guarantees, activeEntityIds]);

  const calculateTotalCost = (g: Guarantee) => {
    const start = new Date(g.issueDate);
    const end = new Date(g.expiryDate);
    const diffTime = Math.max(0, end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const years = diffDays / 365;
    const interestCost = g.amount * (g.annualInterestRate / 100) * years;
    return {
        total: (g.setupFee || 0) + interestCost,
        interestOnly: interestCost,
        days: diffDays
    };
  };

  const handleOpenModal = (guarantee?: Guarantee) => {
    if (guarantee) {
      setEditingGuarantee(guarantee); setFormData(guarantee); setNewAttachments([]);
    } else {
      setEditingGuarantee(null);
      const defaultEnt = selectedEntityId !== 'all' ? selectedEntityId : (entities[0]?.id || '');
      const defaultAcc = accounts.find(a => a.entityId === defaultEnt);
      setFormData({ ...initialFormState, id: generateId(), entityId: defaultEnt, accountId: defaultAcc?.id || '' });
      setNewAttachments([]);
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.beneficiary || !formData.amount) return;
    const combinedAttachments = [...(formData.attachments || []), ...newAttachments];
    const dataToSave = { ...formData, attachments: combinedAttachments };
    if (editingGuarantee) setGuarantees(prev => prev.map(g => g.id === editingGuarantee.id ? dataToSave : g));
    else setGuarantees(prev => [...prev, dataToSave]);
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => { if (confirm('האם אתה בטוח שברצונך למחוק ערבות זו?')) setGuarantees(prev => prev.filter(g => g.id !== id)); };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) { const processed = await Promise.all(Array.from(e.target.files).map(processFile)); setNewAttachments(prev => [...prev, ...processed] as Attachment[]); } };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDrop = async (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files) { const processed = await Promise.all(Array.from(e.dataTransfer.files).map(processFile)); setNewAttachments(prev => [...prev, ...processed] as Attachment[]); } };
  const removeNewAttachment = (index: number) => { setNewAttachments(prev => prev.filter((_, i) => i !== index)); };
  const removeExistingAttachment = (attId: string) => { setFormData(prev => ({ ...prev, attachments: prev.attachments?.filter(a => a.id !== attId) })); };

  const filteredGuarantees = guarantees.filter(g => { 
    const matchText = g.beneficiary.includes(searchQuery) || g.notes.includes(searchQuery); 
    const matchEntity = activeEntityIds.has(g.entityId); 
    return matchText && matchEntity; 
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {expiringAlerts.length > 0 && (
        <div className="bg-slate-900 border border-amber-500/30 rounded-xl overflow-hidden shadow-[0_0_15px_-3px_rgba(245,158,11,0.1)]">
          <div className="bg-amber-500/10 p-3 px-4 flex items-center justify-between border-b border-amber-500/10">
            <div className="flex items-center gap-2 text-amber-500 font-bold">
              <AlertTriangle size={18} />
              <span>ערבויות שמסתיימות בחודש הקרוב</span>
            </div>
            <span className="text-xs bg-amber-500 text-slate-900 px-2 py-0.5 rounded-full font-bold">{expiringAlerts.length}</span>
          </div>
          <div className="divide-y divide-slate-800 max-h-64 overflow-y-auto custom-scrollbar">
            {expiringAlerts.map(g => (
              <div key={g.id} className="p-3 px-4 flex justify-between items-center hover:bg-slate-800/50 transition-colors">
                 <div>
                   <div className="font-bold text-slate-200">{g.beneficiary}</div>
                   <div className="text-xs text-slate-500">{entities.find(e => e.id === g.entityId)?.name}</div>
                 </div>
                 <div className="text-right">
                    <div className="text-sm font-bold text-amber-400" dir="ltr">{formatCurrency(g.amount)}</div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-1 justify-end mt-1">
                      <Calendar size={10} /> תוקף: {formatDate(g.expiryDate)}
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
             <input type="text" placeholder="חפש לפי מוטב..." className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1.5 pr-10 pl-4 text-sm text-white focus:outline-none focus:border-indigo-500" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
           </div>
           <div className="w-48">
             <Select options={[{value: 'all', label: 'כל הישויות (מאוחד)'}, ...entities.map(e => ({value: e.id, label: e.name}))]} value={selectedEntityId} onChange={e => setSelectedEntityId(e.target.value)} className="py-1.5" />
           </div>
         </div>
         <Button onClick={() => handleOpenModal()} icon={<Plus size={18} />}>הוספת ערבות</Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
        <table className="w-full text-sm text-right text-slate-300">
          <thead className="bg-slate-950 text-slate-400 uppercase text-xs">
            <tr>
              <th className="px-6 py-4">מוטב</th>
              <th className="px-6 py-4">ישות / חשבון</th>
              <th className="px-6 py-4">סכום</th>
              <th className="px-6 py-4">תוקף</th>
              <th className="px-6 py-4">עלות כוללת לתקופה</th>
              <th className="px-6 py-4 text-left">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {filteredGuarantees.map(g => {
              const costDetails = calculateTotalCost(g);
              return (
                <tr key={g.id} className="hover:bg-slate-800/40 transition-colors group">
                  <td className="px-6 py-4 font-bold text-white text-base">{g.beneficiary}</td>
                  <td className="px-6 py-4">
                    <div>{entities.find(e => e.id === g.entityId)?.name}</div>
                    <div className="text-xs text-slate-500 font-mono">
                      {accounts.find(a => a.id === g.accountId)?.nickname || accounts.find(a => a.id === g.accountId)?.accountNumber}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-100" dir="ltr">{formatCurrency(g.amount)}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                        <span>{formatDate(g.expiryDate)}</span>
                        <span className="text-[10px] text-slate-500">{costDetails.days} ימים</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                        <span className="font-bold text-amber-400" dir="ltr">{formatCurrency(costDetails.total)}</span>
                        <span className="text-[10px] text-slate-500">עמלה: {formatCurrency(g.setupFee)} + ריבית: {formatCurrency(costDetails.interestOnly)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-left">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleOpenModal(g)} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white"><Edit2 size={16}/></button>
                      <button onClick={() => handleDelete(g.id)} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-rose-500"><Trash2 size={16}/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={'עריכת ערבות'}>
        <div className="flex flex-col-reverse md:flex-row gap-8">
          <div className="w-full md:w-2/3 flex flex-col gap-5">
            <div>
              <Input label="שם המוטב" value={formData.beneficiary} onChange={e => setFormData({...formData, beneficiary: e.target.value})} placeholder="לדוגמה: עיריית תל אביב" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select label="ישות" options={entities.map(e => ({value: e.id, label: e.name}))} value={formData.entityId} onChange={e => {
                const newEntityId = e.target.value;
                const relevantAccounts = accounts.filter(a => a.entityId === newEntityId);
                setFormData({ ...formData, entityId: newEntityId, accountId: relevantAccounts.length > 0 ? relevantAccounts[0].id : '' });
              }} />
              <Select label="חשבון בנק" options={accounts.filter(a => a.entityId === formData.entityId).map(a => ({ 
                value: a.id, 
                label: `${a.nickname ? a.nickname + ' - ' : ''}${a.bankName} - ${a.accountNumber}` 
              }))} value={formData.accountId} onChange={e => setFormData({...formData, accountId: e.target.value})} />
            </div>
            <div>
              <Input label="סכום הערבות" type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="תאריך הנפקה" type="date" value={formData.issueDate} onChange={e => setFormData({...formData, issueDate: e.target.value})} />
              <Input label="תאריך תוקף" type="date" value={formData.expiryDate} onChange={e => setFormData({...formData, expiryDate: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="עמלת הקמה (חד פעמי)" type="number" value={formData.setupFee} onChange={e => setFormData({...formData, setupFee: Number(e.target.value)})} />
              <Input label="ריבית שנתית (%)" type="number" step="0.01" value={formData.annualInterestRate} onChange={e => setFormData({...formData, annualInterestRate: Number(e.target.value)})} />
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-amber-500/20 p-2 rounded-lg text-amber-500">
                        <Calculator size={20} />
                    </div>
                    <div>
                        <div className="text-xs text-slate-500">עלות משוערת לכל התקופה</div>
                        <div className="text-lg font-bold text-amber-400" dir="ltr">{formatCurrency(calculateTotalCost(formData).total)}</div>
                    </div>
                </div>
                <div className="text-left text-[10px] text-slate-500 leading-tight">
                    <div>ריבית: {formatCurrency(calculateTotalCost(formData).interestOnly)}</div>
                    <div>עמלה: {formatCurrency(formData.setupFee)}</div>
                </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium mb-1 block">הערות</label>
              <textarea 
                className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 h-24 resize-none transition-all"
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
                placeholder="פרטים נוספים לגבי הערבות..."
              ></textarea>
            </div>
          </div>
          <div className="w-full md:w-1/3 flex flex-col">
            <input type="file" multiple ref={attachmentInputRef} className="hidden" onChange={handleFileSelect} />
            <div className={`flex-1 border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-start text-center min-h-[400px] transition-all ${isDragging ? 'border-indigo-400 bg-indigo-500/10' : 'border-slate-800 bg-slate-950/40 hover:bg-slate-900/60'}`} onDragOver={handleDragOver} onDrop={handleDrop}>
              <div className="mb-6 mt-8">
                <div className="bg-slate-800 p-4 rounded-2xl inline-block text-slate-400 mb-4"><Upload size={32} /></div>
                <h4 className="font-bold text-slate-200 text-lg mb-2">מסמכים וצרופות</h4>
                <p className="text-xs text-slate-500 px-4 leading-relaxed">גרור קבצים לכאן (כתב ערבות, נספחים) או לחץ להעלאה</p>
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

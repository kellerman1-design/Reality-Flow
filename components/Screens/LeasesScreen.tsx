
import React, { useState, useMemo, useRef } from 'react';
import { Card, Button, Input, Modal, Select } from '../UI/SharedComponents';
import { Lease, Entity, Account, Attachment, Frequency } from '../../types';
import { Plus, Edit2, Trash2, Search, AlertTriangle, FileSpreadsheet, Upload, FileText, Calendar, X, Paperclip, TrendingUp } from 'lucide-react';
import { generateId, formatDate, formatCurrency, addDays, processFile } from '../../utils';
import * as XLSX from 'xlsx';

interface LeasesScreenProps {
  leases: Lease[];
  setLeases: React.Dispatch<React.SetStateAction<Lease[]>>;
  entities: Entity[];
  accounts: Account[];
  selectedEntityId: string;
  setSelectedEntityId: (id: string) => void;
  activeEntityIds: Set<string>;
}

export const LeasesScreen: React.FC<LeasesScreenProps> = ({ leases, setLeases, entities, accounts, selectedEntityId, setSelectedEntityId, activeEntityIds }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLease, setEditingLease] = useState<Lease | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [newAttachments, setNewAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  const initialFormState: Lease = {
    id: '',
    entityId: entities[0]?.id || '',
    tenantName: '',
    property: '',
    leaseType: 'שכירות',
    leasedSqm: 0,
    ratePerSqm: 0,
    netAmount: 0,
    frequency: 'Monthly',
    accountId: accounts.filter(a => a.entityId === (entities[0]?.id || ''))[0]?.id || '',
    paymentDay: 1,
    includesVat: true,
    linkageIndexBase: 0,
    startDate: todayStr,
    endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    attachments: []
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Lease>(initialFormState);
  const [isLinked, setIsLinked] = useState(false);

  const alerts = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const expiring = leases.filter(l => { const end = new Date(l.endDate); const diffTime = end.getTime() - today.getTime(); const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); return diffDays >= 0 && diffDays <= 30; });
    const critical = expiring.filter(expLease => {
        const expectedStart = new Date(expLease.endDate); expectedStart.setDate(expectedStart.getDate() + 1); const expectedStartStr = expectedStart.toISOString().split('T')[0];
        const hasRenewal = leases.some(l => l.id !== expLease.id && l.tenantName === expLease.tenantName && l.property === expLease.property && l.startDate === expectedStartStr );
        return !hasRenewal;
    });
    return critical;
  }, [leases]);

  const handleOpenModal = (lease?: Lease) => {
    if (lease) {
      setEditingLease(lease); 
      setFormData(lease); 
      setIsLinked((lease.linkageIndexBase || 0) > 0); 
      setNewAttachments([]); 
    } else {
      setEditingLease(null);
      const defaultEnt = selectedEntityId !== 'all' ? selectedEntityId : (entities[0]?.id || '');
      const defaultAcc = accounts.find(a => a.entityId === defaultEnt);
      setFormData({ ...initialFormState, id: generateId(), entityId: defaultEnt, accountId: defaultAcc?.id || '' });
      setIsLinked(false); 
      setNewAttachments([]);
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.tenantName || !formData.property) return;
    const combinedAttachments = [...(formData.attachments || []), ...newAttachments];
    const dataToSave = { 
        ...formData, 
        linkageIndexBase: isLinked ? (formData.linkageIndexBase || 100) : 0, 
        attachments: combinedAttachments 
    };
    if (editingLease) setLeases(prev => prev.map(l => l.id === editingLease.id ? dataToSave : l));
    else setLeases(prev => [...prev, dataToSave]);
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    setLeases(prev => prev.filter(l => l.id !== id));
    setDeleteConfirmId(null);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) { const files = Array.from(e.target.files); const processed = await Promise.all(files.map(processFile)); setNewAttachments(prev => [...prev, ...processed]); } };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDrop = async (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files) { const files = Array.from(e.dataTransfer.files); const processed = await Promise.all(files.map(processFile)); setNewAttachments(prev => [...prev, ...processed]); } };
  const removeNewAttachment = (index: number) => { setNewAttachments(prev => prev.filter((_, i) => i !== index)); };
  const removeExistingAttachment = (attId: string) => { setFormData(prev => ({ ...prev, attachments: prev.attachments?.filter(a => a.id !== attId) })); };

  const updateCalculatedNet = (updates: Partial<Lease>) => {
    const nextSqm = updates.leasedSqm !== undefined ? updates.leasedSqm : formData.leasedSqm;
    const nextRate = updates.ratePerSqm !== undefined ? updates.ratePerSqm : formData.ratePerSqm;
    const nextNet = nextSqm * nextRate;
    const finalNet = isFinite(nextNet) ? nextNet : 0;
    setFormData(prev => ({ ...prev, ...updates, netAmount: finalNet || prev.netAmount }));
  };

  /**
   * Processes Excel file for Leases - Updated format:
   * A: Entity | B: Tenant | C: Property | D: Type | E: Sqm | F: Rate | G: Total | H: Account | I: Freq | J: Day | K: Start | L: End | M: Linkage | N: IncludesVat
   */
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result; 
        const wb = XLSX.read(bstr, { type: 'binary' }); 
        const wsName = wb.SheetNames.find(n => n.toLowerCase().includes('leases') || n.includes('שכירויות')) || wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data: any[] = XLSX.utils.sheet_to_json(ws, { header: 'A' });
        
        const newLeases: Lease[] = [];
        const freqMap: any = { 'חודשי': 'Monthly', 'Monthly': 'Monthly', 'רבעוני': 'Quarterly', 'חצי שנתי': 'SemiAnnually', 'שנתי': 'Annually' };

        data.slice(1).forEach((row: any) => {
            const tenant = row['B'];
            const property = row['C'];
            const sqm = Number(row['E']) || 0;
            const rate = Number(row['F']) || 0;
            let amount = Number(row['G']);
            if (isNaN(amount) || amount === 0) amount = sqm * rate;

            if (tenant && property) {
                 const entityName = String(row['A'] || '').trim();
                 const targetEntity = entities.find(ent => ent.name === entityName) || entities[0];
                 const entAccounts = accounts.filter(acc => acc.entityId === targetEntity.id);
                 
                 const accountIdentifier = String(row['H'] || '').trim();
                 const targetAccount = entAccounts.find(acc => acc.nickname === accountIdentifier || acc.accountNumber === accountIdentifier ) || entAccounts[0] || accounts[0];
                 
                 const typeStr = String(row['D'] || 'שכירות').trim();
                 // Safer check for leaseType to satisfy TypeScript
                 const leaseType = ['שכירות', 'דמי ניהול', 'אחר'].includes(typeStr) ? (typeStr as Lease['leaseType']) : 'שכירות';
                 
                 const finalFrequency = freqMap[String(row['I'] || 'חודשי').trim()] || 'Monthly';
                 const linkageBase = Number(row['M']) || 0;

                 // Logic for Column N: Includes VAT
                 const vatRaw = String(row['N'] || 'כן').trim().toLowerCase();
                 const includesVat = vatRaw === 'כן' || vatRaw === 'yes' || vatRaw === 'true' || vatRaw === '1';

                 newLeases.push({ 
                    id: generateId(), 
                    entityId: targetEntity.id, 
                    accountId: targetAccount.id, 
                    tenantName: String(tenant), 
                    property: String(property), 
                    leaseType,
                    leasedSqm: sqm,
                    ratePerSqm: rate,
                    netAmount: amount, 
                    frequency: finalFrequency, 
                    paymentDay: Number(row['J']) || 1, 
                    includesVat: includesVat,
                    startDate: String(row['K'] || todayStr), 
                    endDate: String(row['L'] || todayStr), 
                    linkageIndexBase: linkageBase === 100 ? 0 : linkageBase,
                    attachments: [] 
                 });
            }
        });

        if (newLeases.length > 0) {
            setLeases(prev => [...prev, ...newLeases]);
            alert(`נטענו ${newLeases.length} חוזי שכירות בהצלחה.`);
        }
      } catch (error) { alert("שגיאה בטעינת קובץ האקסל."); }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const filteredLeases = leases.filter(l => { 
    const matchText = l.tenantName.includes(searchQuery) || l.property.includes(searchQuery); 
    const matchEntity = activeEntityIds.has(l.entityId); 
    return matchText && matchEntity; 
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {alerts.length > 0 && (
         <div className="bg-slate-900 border border-amber-500/30 rounded-xl overflow-hidden shadow-[0_0_15px_-3px_rgba(245,158,11,0.1)]"><div className="bg-amber-500/10 p-3 px-4 flex items-center justify-between border-b border-amber-500/10"><div className="flex items-center gap-2 text-amber-500 font-bold"><AlertTriangle size={18} /><span>חוזי שכירות מסתיימים ללא המשך (30 יום קרובים)</span></div><span className="text-xs bg-amber-500 text-slate-900 px-2 py-0.5 rounded-full font-bold">{alerts.length}</span></div><div className="divide-y divide-slate-800 max-h-64 overflow-y-auto custom-scrollbar">{alerts.map(l => (<div key={l.id} className="p-3 px-4 flex justify-between items-center hover:bg-slate-800/50 transition-colors"><div><div className="font-bold text-slate-200">{l.tenantName} ({l.property})</div><div className="text-xs text-slate-500">{entities.find(e => e.id === l.entityId)?.name}</div></div><div className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-3 py-1 rounded text-xs">מסתיים ב: {formatDate(l.endDate)}</div></div>))}</div></div>
      )}
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
         <div className="flex gap-4 items-center w-full md:w-auto flex-1"><div className="relative flex-1 max-w-xs"><Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} /><input type="text" placeholder="חפש לפי שם נכס או שוכר..." className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1.5 pr-10 pl-4 text-sm text-white focus:outline-none focus:border-indigo-500" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div><div className="w-48"><Select options={[{value: 'all', label: 'כל הישויות (מאוחד)'}, ...entities.map(e => ({value: e.id, label: e.name}))]} value={selectedEntityId} onChange={e => setSelectedEntityId(e.target.value)} className="py-1.5" /></div></div>
         <div className="flex gap-3"><input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleExcelUpload} /><Button variant="secondary" onClick={() => fileInputRef.current?.click()} icon={<FileSpreadsheet size={18} className="text-emerald-500" />} className="border-emerald-500/30 hover:bg-emerald-500/10">ייבוא (Excel)</Button><Button onClick={() => handleOpenModal()} icon={<Plus size={18} />}>הוספה</Button></div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 shadow-xl"><table className="w-full text-sm text-right text-slate-300"><thead className="bg-slate-950 text-slate-400 uppercase text-xs"><tr><th className="px-6 py-4">שם השוכר</th><th className="px-6 py-4">שם הנכס</th><th className="px-6 py-4">סוג</th><th className="px-6 py-4">סכום</th><th className="px-6 py-4">תחילת שכירות</th><th className="px-6 py-4">סיום שכירות</th><th className="px-6 py-4 text-left">פעולות</th></tr></thead><tbody className="divide-y divide-slate-800/70">{filteredLeases.map(lease => (<tr key={lease.id} className="hover:bg-slate-800/40 transition-colors group"><td className="px-6 py-4 font-bold text-white"><div className="flex flex-col"><span>{lease.tenantName}</span>{lease.attachments && lease.attachments.length > 0 && (<span className="text-[10px] text-indigo-400 flex items-center gap-1 mt-1"><Paperclip size={10} /> {lease.attachments.length} קבצים</span>)}</div></td><td className="px-6 py-4 text-slate-400">{lease.property}</td><td className="px-6 py-4 text-xs font-medium text-slate-500">{lease.leaseType || 'שכירות'}</td><td className="px-6 py-4 font-medium text-emerald-400" dir="ltr">{formatCurrency(lease.netAmount)}</td><td className="px-6 py-4">{formatDate(lease.startDate)}</td><td className="px-6 py-4">{formatDate(lease.endDate)}</td><td className="px-6 py-4 text-left">
  <div className="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
    <button 
      type="button"
      onClick={(e) => { e.stopPropagation(); handleOpenModal(lease); }} 
      className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
    >
      <Edit2 size={16}/>
    </button>
    <button 
      type="button"
      onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(lease.id); }} 
      className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-rose-500"
    >
      <Trash2 size={16}/>
    </button>
  </div>
</td></tr>))}</tbody></table></div>

<Modal isOpen={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="אישור מחיקה">
  <div className="p-4 text-center">
      <p className="text-slate-300 mb-6">האם אתה בטוח שברצונך למחוק חוזה שכירות זה? פעולה זו אינה ניתנת לביטול.</p>
      <div className="flex justify-center gap-4">
          <Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>ביטול</Button>
          <Button onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)} className="bg-rose-600 hover:bg-rose-700">מחק חוזה</Button>
      </div>
  </div>
</Modal>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingLease ? 'עריכת חוזה שכירות' : 'הוספת חוזה שכירות'}>
        <div className="flex flex-col-reverse md:flex-row gap-6">
          <div className="w-full md:w-1/3 flex flex-col gap-4">
            <input type="file" multiple ref={attachmentInputRef} className="hidden" onChange={handleFileSelect} />
            <div className={`flex-1 border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-start text-center min-h-[350px] transition-colors ${isDragging ? 'border-indigo-400 bg-indigo-500/10' : 'border-slate-700 bg-slate-900/50 hover:bg-slate-800/50'}`} onDragOver={handleDragOver} onDrop={handleDrop}>
              <div className="mb-4 mt-6">
                <div className="bg-slate-800 p-4 rounded-full inline-block text-slate-400 mb-2"><Upload size={24} /></div>
                <h4 className="font-bold text-slate-200 mb-1">מסמכים</h4>
                <p className="text-xs text-slate-500 px-4">גרור לכאן</p>
              </div>
              <Button variant="secondary" className="text-xs py-1.5 px-3 h-auto mb-6" icon={<Upload size={14} />} onClick={() => attachmentInputRef.current?.click()}>בחר</Button>
              <div className="w-full text-right px-1 space-y-2 overflow-y-auto max-h-[200px]">
                {formData.attachments?.map((att) => (
                  <div key={att.id} className="flex justify-between items-center bg-indigo-900/20 border border-indigo-500/20 rounded px-2 py-1.5">
                    <div className="flex items-center gap-2 overflow-hidden"><FileText size={12} className="text-indigo-400 shrink-0"/><a href={att.url} download={att.name} target="_blank" rel="noreferrer" className="text-xs text-indigo-100 truncate max-w-[120px]">{att.name}</a></div>
                    <button onClick={() => removeExistingAttachment(att.id)} className="text-indigo-400 hover:text-rose-400"><X size={12}/></button>
                  </div>
                ))}
                {newAttachments.map((att, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-slate-800 border border-slate-700 rounded px-2 py-1.5">
                    <div className="flex items-center gap-2 overflow-hidden"><FileText size={12} className="text-emerald-500 shrink-0"/><a href={att.url} download={att.name} target="_blank" rel="noreferrer" className="text-xs text-slate-200 truncate max-w-[120px]">{att.name}</a></div>
                    <button onClick={() => removeNewAttachment(idx)} className="text-slate-500 hover:text-rose-400"><X size={12}/></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="w-full md:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="שוכר" value={formData.tenantName} onChange={e => setFormData({...formData, tenantName: e.target.value})} />
            <Input label="נכס" value={formData.property} onChange={e => setFormData({...formData, property: e.target.value})} />
            <Select label="תיאור (סוג שירות)" options={[{ value: 'שכירות', label: 'שכירות' }, { value: 'דמי ניהול', label: 'דמי ניהול' }, { value: 'אחר', label: 'אחר' }]} value={formData.leaseType || 'שכירות'} onChange={e => setFormData({...formData, leaseType: e.target.value as any})} />
            <Select label="ישות" options={entities.map(e => ({value: e.id, label: e.name}))} value={formData.entityId} onChange={e => { const newEntityId = e.target.value; const relevantAccounts = accounts.filter(a => a.entityId === newEntityId); setFormData({ ...formData, entityId: newEntityId, accountId: relevantAccounts.length > 0 ? relevantAccounts[0].id : '' }); }} />
            <Input label={"כמות מושכרת (מ\"ר)"} type="number" value={formData.leasedSqm} onChange={e => updateCalculatedNet({ leasedSqm: Number(e.target.value) })} />
            <Input label={"תעריף למ\"ר (₪)"} type="number" value={formData.ratePerSqm} onChange={e => updateCalculatedNet({ ratePerSqm: Number(e.target.value) })} />
            <Select label="חשבון" options={accounts.filter(a => a.entityId === formData.entityId).map(a => ({ value: a.id, label: `${a.nickname ? a.nickname + ' - ' : ''}${a.bankName} - ${a.accountNumber}` }))} value={formData.accountId} onChange={e => setFormData({...formData, accountId: e.target.value})} />
            <Input label="סכום נטו (מחושב)" type="number" value={formData.netAmount} onChange={e => setFormData({...formData, netAmount: Number(e.target.value)})} className="bg-indigo-500/5 border-indigo-500/30 font-bold" />
            <div className="grid grid-cols-2 gap-2">
              <Select label="תדירות" options={[{value: 'Monthly', label: 'חודשי'}, {value: 'Quarterly', label: 'רבעוני'}, {value: 'SemiAnnually', label: 'חצי שנתי'}, {value: 'Annually', label: 'שנתי'}]} value={formData.frequency} onChange={e => setFormData({...formData, frequency: e.target.value as any})} />
              <Input label="יום" type="number" min={1} max={31} value={formData.paymentDay} onChange={e => setFormData({...formData, paymentDay: Number(e.target.value)})} />
            </div>
            <div className="md:col-span-2 space-y-4 pt-2 border-t border-slate-800">
              <div className="flex gap-6">
                <div className="flex items-center gap-2"><input type="checkbox" checked={formData.includesVat} onChange={e => setFormData({...formData, includesVat: e.target.checked})} className="w-5 h-5 accent-indigo-500" /><label className="text-sm text-slate-300">כולל מע״מ</label></div>
                <div className="flex items-center gap-2"><input type="checkbox" checked={isLinked} onChange={e => setIsLinked(e.target.checked)} className="w-5 h-5 accent-indigo-500" /><label className="text-sm text-slate-300">צמוד למדד</label></div>
              </div>
              {isLinked && (
                <div className="bg-indigo-500/5 border border-indigo-500/20 p-3 rounded-lg flex items-center gap-4 animate-in slide-in-from-top-2 duration-300">
                  <div className="text-indigo-400 shrink-0"><TrendingUp size={20} /></div>
                  <div className="flex-1"><Input label="מדד בסיס בחוזה" type="number" step="0.01" value={formData.linkageIndexBase || 100} onChange={e => setFormData({...formData, linkageIndexBase: Number(e.target.value)})} placeholder="לדוגמה: 100.5" /></div>
                </div>
              )}
            </div>
            <Input label="תאריך התחלה" type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
            <Input label="תאריך סיום" type="date" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-800"><Button variant="secondary" onClick={() => setIsModalOpen(false)}>ביטול</Button><Button onClick={handleSave}>שמור</Button></div>
      </Modal>
    </div>
  );
};


import React, { useState, useMemo } from 'react';
import { Button, Input, Modal, Select, Card } from '../UI/SharedComponents';
import { Budget, Entity, DailySimulationResult, Lease } from '../../types';
import { Plus, Edit2, Trash2, Search, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Home, Link } from 'lucide-react';
import { generateId, formatCurrency } from '../../utils';
import { CATEGORIES } from '../../constants';

interface BudgetScreenProps {
  budgets: Budget[];
  setBudgets: React.Dispatch<React.SetStateAction<Budget[]>>;
  entities: Entity[];
  simulationResults: DailySimulationResult[];
  leases: Lease[];
  selectedEntityId: string;
  setSelectedEntityId: (id: string) => void;
  activeEntityIds: Set<string>;
}

export const BudgetScreen: React.FC<BudgetScreenProps> = ({ budgets, setBudgets, entities, simulationResults, leases, selectedEntityId, setSelectedEntityId, activeEntityIds }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const initialFormState: Budget = {
    id: '',
    entityId: entities[0]?.id || '',
    category: CATEGORIES.expense[0],
    property: '',
    annualBudget: 0,
    manualActualYTD: 0
  };

  const [formData, setFormData] = useState<Budget>(initialFormState);

  // Get unique properties from leases for the selected entity to populate the dropdown
  const entityProperties = useMemo(() => {
    const targetEntityId = formData.entityId;
    const props = leases
      .filter(l => l.entityId === targetEntityId)
      .map(l => l.property);
    return Array.from(new Set(props));
  }, [leases, formData.entityId]);

  const handleOpenModal = (budget?: Budget) => {
    if (budget) { 
        setEditingBudget(budget); 
        setFormData(budget); 
    } 
    else {
      setEditingBudget(null);
      const defaultEnt = selectedEntityId !== 'all' ? selectedEntityId : (entities[0]?.id || '');
      setFormData({ ...initialFormState, id: generateId(), entityId: defaultEnt });
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.category || !formData.annualBudget) return;
    if (editingBudget) setBudgets(prev => prev.map(b => b.id === editingBudget.id ? formData : b));
    else setBudgets(prev => [...prev, formData]);
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => { 
    if (confirm('האם אתה בטוח שברצונך למחוק תקציב זה?')) setBudgets(prev => prev.filter(b => b.id !== id)); 
  };

  const budgetAnalysis = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return budgets.map(budget => {
        let forecastAmount = 0;
        
        // Sum simulation results only for the current year (Future transactions)
        simulationResults.forEach(day => {
            const dayDate = new Date(day.date);
            if (dayDate.getFullYear() === currentYear) {
                day.transactions.forEach(tx => {
                    if (tx.entityId !== budget.entityId) return;
                    
                    // Match by category
                    if (tx.category === budget.category) {
                        // If a specific property is defined for this budget line, filter by it in the description
                        if (budget.property && !tx.description.includes(budget.property)) return;
                        
                        forecastAmount += Math.abs(tx.amount);
                    }
                });
            }
        });

        const totalProjected = (budget.manualActualYTD || 0) + forecastAmount;
        const utilization = budget.annualBudget > 0 ? (totalProjected / budget.annualBudget) * 100 : 0;
        const isIncome = CATEGORIES.income.includes(budget.category);
        
        let status = 'ontrack';
        if (!isIncome && totalProjected > budget.annualBudget) status = 'over';
        if (isIncome && totalProjected < budget.annualBudget) status = 'under';
        
        return { ...budget, forecastAmount, totalProjected, utilization, isIncome, status };
    });
  }, [budgets, simulationResults]);

  const filteredBudgets = budgetAnalysis.filter(b => {
      const matchText = b.category.includes(searchQuery) || (b.property || '').includes(searchQuery);
      const matchEntity = activeEntityIds.has(b.entityId);
      return matchText && matchEntity;
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 text-right">
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
         <div className="flex gap-4 items-center w-full md:w-auto flex-1">
            <div className="relative flex-1 max-w-xs">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input 
                    type="text" 
                    placeholder="חפש קטגוריה או נכס..." 
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1.5 pr-10 pl-4 text-sm text-white focus:outline-none focus:border-indigo-500" 
                    value={searchQuery} 
                    onChange={e => setSearchQuery(e.target.value)} 
                />
            </div>
            <div className="w-48">
                <Select 
                    options={[{value: 'all', label: 'כל הישויות (מאוחד)'}, ...entities.map(e => ({value: e.id, label: e.name}))]} 
                    value={selectedEntityId} 
                    onChange={e => setSelectedEntityId(e.target.value)} 
                    className="py-1.5" 
                />
            </div>
         </div>
         <Button onClick={() => handleOpenModal()} icon={<Plus size={18} />}>הוספת תקציב</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredBudgets.map(item => {
              const entityName = entities.find(e => e.id === item.entityId)?.name;
              const isBad = item.status === 'over' || item.status === 'under';
              const actualPct = Math.min(((item.manualActualYTD || 0) / item.annualBudget) * 100, 100);
              const forecastPct = Math.min((item.forecastAmount / item.annualBudget) * 100, 100 - actualPct);
              
              return (
                  <Card key={item.id} className="relative group overflow-hidden border-t-4 border-t-slate-700 hover:border-t-indigo-500 transition-colors bg-slate-900 shadow-xl">
                      <div className="absolute top-4 left-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          <button onClick={() => handleOpenModal(item)} className="p-1.5 bg-slate-800 rounded text-slate-300 hover:text-white" title="ערוך תקציב"><Edit2 size={14}/></button>
                          <button onClick={() => handleDelete(item.id)} className="p-1.5 bg-slate-800 rounded text-slate-300 hover:text-white" title="מחק תקציב"><Trash2 size={14}/></button>
                      </div>

                      <div className="mb-4">
                          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-bold">{entityName}</div>
                          <h3 className="text-xl font-black text-white flex items-center gap-2">
                              {item.category}
                              {item.property && (
                                <span className="text-xs font-normal bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20 flex items-center gap-1">
                                    <Home size={10} /> {item.property}
                                </span>
                              )}
                          </h3>
                      </div>

                      <div className="flex justify-between items-end mb-4">
                          <div>
                              <div className="text-[10px] text-slate-500 mb-0.5">תקציב שנתי</div>
                              <div className="text-lg font-bold text-slate-200" dir="ltr">{formatCurrency(item.annualBudget)}</div>
                          </div>
                          <div className="text-left">
                              <div className="text-[10px] text-slate-500 mb-0.5">צפי סיום (פועל+תחזית)</div>
                              <div className={`text-lg font-black ${isBad ? 'text-rose-400' : 'text-emerald-400'} flex items-center justify-end gap-1`} dir="ltr">
                                  {isBad && <AlertTriangle size={14} />}
                                  {formatCurrency(item.totalProjected)}
                              </div>
                          </div>
                      </div>

                      <div className="space-y-2">
                          <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden flex relative border border-slate-700/50">
                              <div className={`h-full ${isBad ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]'} transition-all duration-1000`} style={{width: `${actualPct}%`}}></div>
                              <div className={`h-full ${isBad ? 'bg-rose-500/30' : 'bg-emerald-500/30'} transition-all duration-1000`} style={{width: `${forecastPct}%`}}></div>
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-500 font-bold px-1">
                              <span>ניצול: {item.utilization.toFixed(1)}%</span>
                              <span className="flex items-center gap-1">
                                  {item.category === 'שכירות' && <Link size={10} className="text-indigo-400" />} {item.category === 'שכירות' ? 'מקושר לחוזים' : ''}
                              </span>
                          </div>
                      </div>
                  </Card>
              );
          })}

          {filteredBudgets.length === 0 && (
              <div className="col-span-full py-20 text-center text-slate-600 border-2 border-dashed border-slate-800 rounded-xl">
                  <TrendingUp size={48} className="mx-auto mb-4 opacity-10" />
                  <p>לא הוגדרו יעדי תקציב לישויות הנבחרות</p>
              </div>
          )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingBudget ? 'עריכת תקציב' : 'הוספת יעד תקציבי'}>
          <div className="space-y-5 text-right">
              <Select 
                label="ישות" 
                options={entities.map(e => ({value: e.id, label: e.name}))} 
                value={formData.entityId} 
                onChange={e => setFormData({...formData, entityId: e.target.value})} 
              />
              
              <div className="flex flex-col gap-1 w-full">
                  <label className="text-xs text-slate-400 font-medium mb-1">קטגוריה</label>
                  <select 
                    className="bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 w-full text-right focus:border-indigo-500 focus:outline-none transition-all" 
                    value={formData.category} 
                    onChange={e => setFormData({...formData, category: e.target.value})}
                  >
                      <optgroup label="הכנסות (חיובי)">
                          {CATEGORIES.income.map(c => <option key={c} value={c}>{c}</option>)}
                      </optgroup>
                      <optgroup label="הוצאות (שלילי)">
                          {CATEGORIES.expense.map(c => <option key={c} value={c}>{c}</option>)}
                      </optgroup>
                  </select>
              </div>

              {/* Conditional Field: Property Dropdown for Rent category */}
              {formData.category === 'שכירות' ? (
                  <Select 
                    label="נכס (מתוך מסך שכירויות)"
                    options={[{value: '', label: 'כל הנכסים'}, ...entityProperties.map(p => ({value: p, label: p}))]}
                    value={formData.property || ''}
                    onChange={e => setFormData({...formData, property: e.target.value})}
                  />
              ) : (
                  <Input 
                    label="נכס / פרויקט (אופציונלי)" 
                    value={formData.property} 
                    onChange={e => setFormData({...formData, property: e.target.value})} 
                    placeholder="הזן שם נכס לסינון מדויק"
                  />
              )}

              <div className="grid grid-cols-2 gap-4">
                  <Input 
                    label="תקציב שנתי (Target)" 
                    type="number" 
                    value={formData.annualBudget} 
                    onChange={e => setFormData({...formData, annualBudget: Number(e.target.value)})} 
                  />
                  <Input 
                    label="ביצוע בפועל (YTD)" 
                    type="number" 
                    value={formData.manualActualYTD} 
                    onChange={e => setFormData({...formData, manualActualYTD: Number(e.target.value)})} 
                    placeholder="0"
                  />
              </div>

              {formData.category === 'שכירות' && (
                  <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-xs text-indigo-300 leading-relaxed flex items-start gap-2">
                      <Link size={14} className="shrink-0 mt-0.5" />
                      <div>
                          שים לב: עבור קטגוריית <strong>שכירות</strong>, המערכת מחשבת את "צפי הסיום" על ידי חיבור הנתון שהזנת ב-"ביצוע בפועל" יחד עם כל התקבולים הצפויים מהחוזים המוגדרים תחת הנכס שבחרת עד לסוף השנה הנוכחית.
                      </div>
                  </div>
              )}

              <div className="flex gap-3 pt-4 mt-6 border-t border-slate-800">
                  <Button onClick={handleSave} className="flex-1">שמור שינויים</Button>
                  <Button variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1">ביטול</Button>
              </div>
          </div>
      </Modal>
    </div>
  );
};


import React, { useMemo, useState, useEffect } from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart, ReferenceLine } from 'recharts';
import { Card, KPICard, Modal, MultiSelect, Select } from '../UI/SharedComponents';
import { DailySimulationResult, Entity, Account, Task, Loan, Lease, Guarantee, Transaction, GlobalSettings } from '../../types';
import { formatCurrency, formatDate, addDays } from '../../utils';
import { TrendingUp, Wallet, Activity, Table, CreditCard, Briefcase, Bell, Calendar, AlertTriangle, Coins, ArrowDownRight, ShieldAlert, ArrowRightLeft, ClipboardList, Shield, Key, Landmark, Filter, ShoppingCart, Tag, Info, Zap, Send, Loader2, Share2 } from 'lucide-react';

interface DashboardProps {
  simulationResults: DailySimulationResult[];
  entities: Entity[];
  accounts: Account[];
  tasks: Task[];
  loans: Loan[];
  leases: Lease[];
  guarantees: Guarantee[];
  settings: GlobalSettings;
  selectedEntityIds: string[];
  setSelectedEntityIds: (ids: string[]) => void;
}

const fmt = (num: number) => {
  const formatted = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 }).format(Math.abs(num));
  return num < 0 ? `(${formatted})` : formatted;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-700 p-3 rounded shadow-xl z-50 text-right">
        <p className="text-slate-200 font-bold mb-1">{formatDate(label)}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }} className="text-sm flex items-center justify-end gap-2">
            <span dir="ltr">{formatCurrency(p.value)}</span>
            <span>: {p.name}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

type ViewMode = 'daily' | 'weekly' | 'monthly' | 'yearly';
type AlertCategory = 'all' | 'tasks' | 'assets' | 'loans' | 'guarantees' | 'leases' | 'flow';

interface CashFlowMatrixProps {
    data: DailySimulationResult[]; 
    entities: Entity[];
    accounts: Account[]; 
    weightedMap: Record<string, number>;
    selectedEntityIds: string[];
    vatRate: number;
}

interface DrillDownState {
    title: string;
    subTitle: string;
    type: 'transactions' | 'balance' | 'credit' | 'vat_audit';
    items: any[];
}

const getConsolidatedWeight = (id: string, entities: Entity[]): number => {
    let weight = 1.0;
    let current = entities.find(e => e.id === id);
    while (current && current.parentId) {
        weight *= (current.ownershipPercentage / 100);
        const parentId = current.parentId;
        current = entities.find(e => e.id === parentId);
    }
    return weight;
};

const CashFlowMatrix: React.FC<CashFlowMatrixProps> = ({ data, entities, accounts, weightedMap, selectedEntityIds, vatRate }) => {
    const [viewMode, setViewMode] = useState<ViewMode>('monthly');
    const [drillDownData, setDrillDownData] = useState<DrillDownState | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && drillDownData) setDrillDownData(null);
        };
        if (drillDownData) document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [drillDownData]);

    const getGroupKey = (dateStr: string, mode: ViewMode): string => {
        const d = new Date(dateStr);
        if (mode === 'daily') return dateStr.split('T')[0];
        if (mode === 'monthly') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (mode === 'yearly') return `${d.getFullYear()}`;
        const start = new Date(d);
        start.setDate(start.getDate() - start.getDay());
        return `${start.getFullYear()}-W${Math.ceil((start.getDate() + start.getDay()) / 7)}_${start.getMonth()}`; 
    };

    const formatHeader = (key: string, mode: ViewMode, firstDateInGroup: string): string => {
        const d = new Date(firstDateInGroup);
        if (mode === 'daily') return `${d.getDate()}/${d.getMonth() + 1}`;
        if (mode === 'monthly') return d.toLocaleDateString('he-IL', { month: 'short', year: '2-digit' });
        if (mode === 'yearly') return d.getFullYear().toString();
        if (mode === 'weekly') return `שבוע ${d.getDate()}/${d.getMonth() + 1}`;
        return key;
    };

    const aggregatedData = useMemo(() => {
        const groups: Record<string, any> = {};
        let runningWeightedAvailable = 0;
        
        Object.entries(weightedMap).forEach(([entId, weight]) => {
            const w = weight as number;
            const entAccounts = accounts.filter(a => a.entityId === entId);
            const limit = entAccounts.reduce((sum, acc) => sum + acc.creditLimit, 0);
            const util = entAccounts.reduce((sum, acc) => sum + acc.currentCreditUtil, 0);
            runningWeightedAvailable += Math.max(0, limit - util) * w;
        });

        data.forEach((day) => {
            const rawKey = getGroupKey(day.date, viewMode);
            let dayClosingCash = 0;
            let dayClosingWeightedAvailable = 0;

            Object.entries(weightedMap).forEach(([entId, weight]) => {
                const w = weight as number;
                dayClosingCash += (day.entityBalances[entId] || 0) * w;
                const entAccounts = accounts.filter(a => a.entityId === entId);
                const limit = entAccounts.reduce((sum, acc) => sum + acc.creditLimit, 0);
                const util = day.entityCreditUtil[entId] || 0;
                dayClosingWeightedAvailable += Math.max(0, limit - util) * w;
            });

            let dayNetFlow = 0;
            day.transactions.forEach((tx) => {
                const weight = weightedMap[tx.entityId] || 0;
                if (weight > 0) dayNetFlow += tx.amount * weight;
            });
            const dayOpeningCash = dayClosingCash - dayNetFlow;

            if (!groups[rawKey]) {
                groups[rawKey] = {
                    key: rawKey,
                    firstDate: day.date,
                    lastDate: day.date,
                    openingBalance: dayOpeningCash,
                    openingAvailableCredit: runningWeightedAvailable,
                    rentIncome: 0, otherIncome: 0, vatIncome: 0,
                    suppliers: 0, otherExpense: 0, tax: 0, vatExpense: 0,
                    assetSale: 0, assetPurchase: 0,
                    loanReceipt: 0, loanRepayment: 0, interest: 0, capital: 0,
                    creditBalancing: 0,
                    closingBalance: 0,
                    closingAvailableCredit: 0
                };
            }

            const g = groups[rawKey];
            g.lastDate = day.date;

            day.transactions.forEach((tx) => {
                const weight = weightedMap[tx.entityId] || 0;
                if (weight <= 0) return;
                const amt = tx.amount * weight;
                const cat = tx.category || '';
                const desc = tx.description || '';

                if (cat === 'החזר הלוואות') g.loanRepayment += amt;
                else if (cat === 'קבלת הלוואות') g.loanReceipt += amt;
                else if (['בנקים', 'ריבית בנקים', 'ריבית', 'מימון'].some(s => cat.includes(s))) g.interest += amt;
                else if (['הזרמת בעלים', 'הון בעלים', 'חלוקה למשקיעים', 'הון משקיעים'].includes(cat)) g.capital += amt;
                else if (cat === 'איזון אשראי' || desc.includes('מסגרת')) g.creditBalancing += amt;
                else if (cat === 'מכירת נכסים') g.assetSale += amt;
                else if (cat === 'רכישת נכסים') g.assetPurchase += amt;
                else {
                    if (amt > 0) {
                        if (cat === 'שכירות' || cat.includes('מכירות')) g.rentIncome += amt;
                        else if (tx.type === 'tax' || cat === 'מע"מ' || cat.includes('מע"מ')) g.vatIncome += amt;
                        else g.otherIncome += amt;
                    } else {
                        if (['ספקים', 'מוסדות', 'תפעול'].some(s => cat.includes(s))) g.suppliers += amt;
                        else if (cat === 'מס הכנסה' || desc.includes('מקדמות מס')) g.tax += amt;
                        else if (tx.type === 'tax' || cat === 'מע"מ' || cat.includes('מע"מ')) g.vatExpense += amt;
                        else g.otherExpense += amt;
                    }
                }
            });

            g.closingBalance = dayClosingCash;
            g.closingAvailableCredit = dayClosingWeightedAvailable;
            runningWeightedAvailable = dayClosingWeightedAvailable;
        });

        return Object.values(groups)
            .map(g => ({ ...g, label: formatHeader(g.key, viewMode, g.firstDate) }))
            .sort((a, b) => new Date(a.firstDate).getTime() - new Date(b.firstDate).getTime());

    }, [data, viewMode, weightedMap, accounts, entities]);

    const displayData = aggregatedData;

    const handleBalanceDrillDown = (periodKey: string, dateInGroup: string, isClosing: boolean = false) => {
        const dayResult = data.find(d => d.date === dateInGroup);
        if (!dayResult) return;
        const items = Object.entries(weightedMap).map(([entId, weight]) => {
            const w = weight as number;
            const amount = isClosing ? (dayResult.entityBalances[entId] || 0) : ((dayResult.entityBalances[entId] || 0) - dayResult.transactions.filter(t => t.entityId === entId).reduce((a, b) => a + b.amount, 0));
            const entAccounts = accounts.filter(a => a.entityId === entId);
            return {
                id: entId, bank: entAccounts[0]?.bankName || '-', accountNumber: entAccounts[0]?.accountNumber || '-',
                entityName: entities.find(e => e.id === entId)?.name || 'Unknown', amount, ownership: w * 100, weightedAmount: amount * w
            };
        });
        setDrillDownData({ title: 'הרכב חשבונות בנק', subTitle: `יתרת ${isClosing ? 'סגירה' : 'פתיחה'} עו"ש`, type: 'balance', items: items.sort((a,b) => b.weightedAmount - a.weightedAmount) });
    };

    const handleCreditDrillDown = (periodKey: string, dateInGroup: string, isClosing: boolean = false) => {
        const dayResult = data.find(d => d.date === dateInGroup);
        if (!dayResult) return;
        const items = Object.entries(weightedMap).map(([entId, weight]) => {
            const w = weight as number;
            const util = dayResult.entityCreditUtil[entId] || 0;
            const entAccounts = accounts.filter(a => a.entityId === entId);
            const limit = entAccounts.reduce((s, a) => s + a.creditLimit, 0);
            const available = Math.max(0, limit - util);
            return { entityName: entities.find(e => e.id === entId)?.name, limit, util, available, ownership: w * 100, weightedAvailable: available * w };
        });
        setDrillDownData({ title: 'פירוט מסגרות אשראי', subTitle: `ניצול מסגרת אשראי`, type: 'credit', items: items.sort((a,b) => b.weightedAvailable - a.weightedAvailable) });
    };

    const handleCellClick = (periodKey: string, categoryType: string) => {
        const relevantDays = data.filter(d => getGroupKey(d.date, viewMode) === periodKey);
        
        if (categoryType === 'vat_income' || categoryType === 'vat_expense') {
            let auditItems: any[] = [];
            relevantDays.forEach(day => {
                const vatSettlements = day.transactions.filter(tx => (tx.category === 'מע"מ' || tx.description.includes('מע"מ')) && weightedMap[tx.entityId] > 0);
                vatSettlements.forEach(settlement => {
                    const weight = weightedMap[settlement.entityId];
                    const settlementDate = new Date(day.date);
                    const sourceMonth = settlementDate.getMonth() === 0 ? 11 : settlementDate.getMonth() - 1;
                    const sourceYear = settlementDate.getMonth() === 0 ? settlementDate.getFullYear() - 1 : settlementDate.getFullYear();
                    
                    const sourceTransactions = data.filter(d => {
                        const dDate = new Date(d.date);
                        return dDate.getMonth() === sourceMonth && dDate.getFullYear() === sourceYear;
                    }).flatMap(d => d.transactions.filter(t => t.entityId === settlement.entityId && t.includesVat));

                    auditItems.push({
                        settlement,
                        sources: sourceTransactions,
                        weight,
                        reportingPeriod: `${sourceMonth + 1}/${sourceYear}`
                    });
                });
            });

            if (auditItems.length > 0) {
                setDrillDownData({
                    title: 'פירוט חבות/החזר מע"מ',
                    subTitle: 'פירוט עסקאות המקור (תשומות ועסקאות) שמרכיבות את הדיווח',
                    type: 'vat_audit',
                    items: auditItems
                });
                return;
            }
        }

        let txs: any[] = [];
        relevantDays.forEach(d => {
            const daysTxs = d.transactions.filter((tx) => {
                 const weight = weightedMap[tx.entityId] || 0;
                 if (weight <= 0) return false;
                 const cat = tx.category || '';
                 const desc = tx.description || '';
                 const amt = tx.amount;
                 const isInterest = ['בנקים', 'ריבית בנקים', 'ריבית', 'מימון'].some(s => cat.includes(s));
                 const isLoanRepay = (cat === 'החזר הלוואות');
                 const isLoanReceipt = (cat === 'קבלת הלוואות');
                 const isCapital = ['הזרמת בעלים', 'הון בעלים', 'חלוקה למשקיעים', 'הון משקיעים'].includes(cat);
                 const isBalancing = (cat === 'איזון אשראי' || desc.includes('מסגרת'));
                 const isAssetSale = (cat === 'מכירת נכסים');
                 const isAssetPurchase = (cat === 'רכישת נכסים');
                 const isRentInc = (amt > 0 && (cat === 'שכירות' || cat.includes('מכירות')));
                 const isVatInc = (amt > 0 && (tx.type === 'tax' || cat === 'מע"מ' || cat.includes('מע"מ')));
                 const isSuppliers = (amt < 0 && ['ספקים', 'מוסדות', 'תפעול'].some(s => cat.includes(s)));
                 const isTax = (amt < 0 && (cat === 'מס הכנסה' || desc.includes('מקדמות מס')));
                 const isVatExp = (amt < 0 && (tx.type === 'tax' || cat === 'מע"מ' || cat.includes('מע"מ')));
                 switch (categoryType) {
                     case 'rent_income': return isRentInc;
                     case 'vat_income': return isVatInc;
                     case 'other_income': return (amt > 0 && !isRentInc && !isVatInc && !isInterest && !isLoanReceipt && !isAssetSale && !isCapital && !isBalancing);
                     case 'suppliers': return isSuppliers;
                     case 'tax': return isTax;
                     case 'vat_expense': return isVatExp;
                     case 'other_expense': return (amt < 0 && !isSuppliers && !isTax && !isVatExp && !isInterest && !isLoanRepay && !isAssetPurchase && !isCapital && !isBalancing);
                     case 'asset_sale': return isAssetSale;
                     case 'asset_purchase': return isAssetPurchase;
                     case 'loan_receipt': return isLoanReceipt;
                     case 'loan_repayment': return isLoanRepay;
                     case 'interest': return isInterest;
                     case 'capital': return isCapital;
                     case 'credit_balancing': return isBalancing;
                     default: return false;
                 }
            }).map((t) => ({ ...t, date: d.date }));
            txs = [...txs, ...daysTxs];
        });
        if (txs.length > 0) {
            let title = 'פירוט תנועות';
            const subTitles: Record<string, string> = {
                'rent_income': 'הכנסות שכירות', 'other_income': 'הכנסות אחרות', 'vat_income': 'תקבולי מע״מ',
                'suppliers': 'תשלומי ספקים', 'tax': 'מקדמות מס', 'vat_expense': 'תשלומי מע״מ', 'other_expense': 'הוצאות אחרות',
                'asset_sale': 'מכירת נכסים', 'asset_purchase': 'רכישת נכסים', 'loan_receipt': 'קבלת הלוואות',
                'loan_repayment': 'החזר הלוואות', 'interest': 'הוצאות ריבית ומימון', 'capital': 'הון בעלים ומשקיעים',
                'credit_balancing': 'פעולות איזון אשראי'
            };
            setDrillDownData({ title, subTitle: subTitles[categoryType] || categoryType, type: 'transactions', items: txs });
        }
    };

    const Cell = ({ value, onClick, className }: any) => {
        const isActive = Math.abs(value) > 0.01;
        const cellClass = `p-3 text-center whitespace-nowrap transition-colors ${isActive ? 'cursor-pointer hover:bg-indigo-500/10 hover:text-white' : 'cursor-default text-slate-500'} ${className}`;
        return <td onClick={isActive ? onClick : undefined} className={cellClass} dir="ltr">{!isActive ? '-' : fmt(value)}</td>;
    };

    return (
        <>
            <Card className="overflow-hidden p-0 w-full" title="">
                <div className="p-4 border-b border-slate-700 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Table className="text-indigo-400" />
                        <h3 className="text-lg font-bold text-slate-100">מטריצת תזרים מזומנים {selectedEntityIds.includes('all') ? ' (מאוחד מלא)' : ' (מותאם)'}</h3>
                    </div>
                    <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 self-end md:self-auto shrink-0">
                        {['daily', 'weekly', 'monthly', 'yearly'].map(m => (
                            <button key={m} onClick={() => setViewMode(m as ViewMode)} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === m ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                                {m === 'daily' ? 'יומי' : m === 'weekly' ? 'שבועי' : m === 'monthly' ? 'חודשי' : 'שנתי'}
                            </button>
                        ))}
                    </div>
                </div>
                {/* To show scrollbar on the right in RTL: Use dir="ltr" on container and dir="rtl" on table */}
                <div 
                    className="overflow-auto w-full max-h-[600px] custom-scrollbar" 
                    dir="ltr" 
                    style={{ scrollbarGutter: 'stable' }}
                >
                    <table className="min-w-full text-sm text-right border-separate border-spacing-0" dir="rtl">
                        <thead className="sticky top-0 z-40">
                            <tr>
                                <th className="p-4 bg-slate-900 text-slate-400 font-bold sticky right-0 top-0 z-50 w-56 border-b border-slate-800 shadow-[2px_2px_10px_rgba(0,0,0,0.4)] whitespace-nowrap">תקופה</th>
                                {displayData.map(m => (
                                    <th key={m.key} className="p-4 bg-slate-900 text-white font-bold min-w-[120px] border-b border-slate-800 text-center whitespace-nowrap shadow-[0_2px_10px_rgba(0,0,0,0.3)]">
                                        {m.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            <tr className="bg-slate-900/30 font-bold hover:bg-slate-800 transition-colors">
                                <td className="p-3 sticky right-0 bg-slate-900 text-slate-300 font-bold border-l border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)] z-10 whitespace-nowrap">יתרת פתיחה עו"ש</td>
                                {displayData.map(m => <td key={m.key} className="p-3 text-center text-slate-200 font-bold whitespace-nowrap cursor-pointer hover:bg-indigo-500/10 hover:text-white transition-colors" dir="ltr" onClick={() => handleBalanceDrillDown(m.key, m.firstDate, false)}>{fmt(m.openingBalance)}</td>)}
                            </tr>
                            <tr className="bg-indigo-900/10">
                                <td className="p-3 sticky right-0 bg-slate-900 text-indigo-300 font-medium text-xs border-l border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)] z-10 whitespace-nowrap">מסגרת פנויה (פתיחה)</td>
                                {displayData.map(m => <td key={m.key} className="p-3 text-center text-indigo-300/70 text-xs whitespace-nowrap cursor-pointer hover:bg-indigo-500/10 transition-colors" dir="ltr" onClick={() => handleCreditDrillDown(m.key, m.firstDate, false)}>{fmt(m.openingAvailableCredit)}</td>)}
                            </tr>
                            <tr className="bg-slate-800/20"><td colSpan={displayData.length + 1} className="p-2 text-xs text-emerald-400 font-bold px-4 sticky right-0 left-0 bg-slate-800/80 z-10">הכנסות מפעילות</td></tr>
                            <tr>
                                <td className="p-3 sticky right-0 bg-slate-900 text-slate-400 pr-6 border-l border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)] z-10">שכירות</td>
                                {displayData.map(m => <Cell key={m.key} value={m.rentIncome} onClick={() => handleCellClick(m.key, 'rent_income')} className="text-emerald-500/80" />)}
                            </tr>
                            <tr>
                                <td className="p-3 sticky right-0 bg-slate-900 text-slate-400 pr-6 border-l border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)] z-10">הכנסות אחרות</td>
                                {displayData.map(m => <Cell key={m.key} value={m.otherIncome} onClick={() => handleCellClick(m.key, 'other_income')} className="text-emerald-500/80" />)}
                            </tr>
                            <tr>
                                <td className="p-3 sticky right-0 bg-slate-900 text-slate-400 pr-6 border-l border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)] z-10">מע"מ</td>
                                {displayData.map(m => <Cell key={m.key} value={m.vatIncome} onClick={() => handleCellClick(m.key, 'vat_income')} className="text-emerald-500/80" />)}
                            </tr>
                            <tr className="bg-emerald-500/5 font-bold">
                                <td className="p-3 sticky right-0 bg-slate-900 text-emerald-400 border-l border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)] z-10">סך הכנסות</td>
                                {displayData.map(m => <td key={m.key} className="p-3 text-center text-emerald-400">{fmt(m.rentIncome + m.otherIncome + m.vatIncome)}</td>)}
                            </tr>
                            <tr className="bg-slate-800/20"><td colSpan={displayData.length + 1} className="p-2 text-xs text-rose-400 font-bold px-4 sticky right-0 left-0 bg-slate-800/80 z-10">הוצאות מפעילות</td></tr>
                            <tr>
                                <td className="p-3 sticky right-0 bg-slate-900 text-slate-400 pr-6 border-l border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)] z-10">ספקים</td>
                                {displayData.map(m => <Cell key={m.key} value={m.suppliers} onClick={() => handleCellClick(m.key, 'suppliers')} className="text-rose-500/80" />)}
                            </tr>
                            <tr>
                                <td className="p-3 sticky right-0 bg-slate-900 text-slate-400 pr-6 border-l border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)] z-10">הוצאות אחרות</td>
                                {displayData.map(m => <Cell key={m.key} value={m.otherExpense} onClick={() => handleCellClick(m.key, 'other_expense')} className="text-rose-500/80" />)}
                            </tr>
                            <tr>
                                <td className="p-3 sticky right-0 bg-slate-900 text-slate-400 pr-6 border-l border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)] z-10">מס הכנסה</td>
                                {displayData.map(m => <Cell key={m.key} value={m.tax} onClick={() => handleCellClick(m.key, 'tax')} className="text-rose-500/80" />)}
                            </tr>
                             <tr>
                                <td className="p-3 sticky right-0 bg-slate-900 text-slate-400 pr-6 border-l border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)] z-10">מע"מ</td>
                                {displayData.map(m => <Cell key={m.key} value={m.vatExpense} onClick={() => handleCellClick(m.key, 'vat_expense')} className="text-rose-500/80" />)}
                            </tr>
                            <tr className="bg-rose-500/5 font-bold">
                                <td className="p-3 sticky right-0 bg-slate-900 text-rose-400 border-l border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)] z-10">סך הוצאות</td>
                                {displayData.map(m => <td key={m.key} className="p-3 text-center text-rose-400">{fmt(m.suppliers + m.otherExpense + m.tax + m.vatExpense)}</td>)}
                            </tr>
                            <tr className="bg-slate-800/20"><td colSpan={displayData.length + 1} className="p-2 text-xs text-amber-400 font-bold px-4 sticky right-0 left-0 bg-slate-800/80 z-10">פעילות השקעה</td></tr>
                            <tr>
                                <td className="p-3 sticky right-0 bg-slate-900 text-slate-400 pr-6 border-l border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)] z-10">מכירת נכסים</td>
                                {displayData.map(m => <Cell key={m.key} value={m.assetSale} onClick={() => handleCellClick(m.key, 'asset_sale')} className="text-emerald-500/80" />)}
                            </tr>
                             <tr>
                                <td className="p-3 sticky right-0 bg-slate-900 text-slate-400 pr-6 border-l border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)] z-10">רכישת נכסים</td>
                                {displayData.map(m => <Cell key={m.key} value={m.assetPurchase} onClick={() => handleCellClick(m.key, 'asset_purchase')} className="text-rose-500/80" />)}
                            </tr>
                            <tr className="bg-slate-800 font-bold border-t border-slate-700 border-b">
                                <td className="p-3 sticky right-0 bg-slate-900 text-white border-l border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)] z-10">תזרים תפעולי והשקעה נטו</td>
                                {displayData.map(m => {
                                    const net = (m.rentIncome + m.otherIncome + m.vatIncome) + (m.suppliers + m.otherExpense + m.tax + m.vatExpense) + (m.assetSale + m.assetPurchase);
                                    return <td key={m.key} className={`p-3 text-center ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} dir="ltr">{fmt(net)}</td>;
                                })}
                            </tr>
                            <tr className="bg-slate-800/20"><td colSpan={displayData.length + 1} className="p-2 text-xs text-indigo-400 font-bold px-4 sticky right-0 left-0 bg-slate-800/80 z-10">פעילות מימונית</td></tr>
                            <tr>
                                <td className="p-3 sticky right-0 bg-slate-900 text-slate-400 pr-6 border-l border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)] z-10">קבלת הלוואות</td>
                                {displayData.map(m => <Cell key={m.key} value={m.loanReceipt} onClick={() => handleCellClick(m.key, 'loan_receipt')} className="text-emerald-500/80" />)}
                            </tr>
                            <tr>
                                <td className="p-3 sticky right-0 bg-slate-900 text-slate-400 pr-6 border-l border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)] z-10">החזר הלוואות</td>
                                {displayData.map(m => <Cell key={m.key} value={m.loanRepayment} onClick={() => handleCellClick(m.key, 'loan_repayment')} className="text-rose-500/80" />)}
                            </tr>
                            <tr>
                                <td className="p-3 sticky right-0 bg-slate-900 text-slate-400 pr-6 border-l border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)] z-10">ריבית</td>
                                {displayData.map(m => <Cell key={m.key} value={m.interest} onClick={() => handleCellClick(m.key, 'interest')} className="text-rose-500/80" />)}
                            </tr>
                             <tr>
                                <td className="p-3 sticky right-0 bg-slate-900 text-slate-400 pr-6 border-l border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)] z-10">הון בעלים / משקיעים</td>
                                {displayData.map(m => <Cell key={m.key} value={m.capital} onClick={() => handleCellClick(m.key, 'capital')} className="text-indigo-400" />)}
                            </tr>
                            <tr className="bg-indigo-500/5 font-bold">
                                <td className="p-3 sticky right-0 bg-slate-900 text-indigo-400 border-l border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)] z-10">סך מימון</td>
                                {displayData.map(m => <td key={m.key} className="p-3 text-center text-indigo-400">{fmt(m.loanReceipt + m.loanRepayment + m.interest + m.capital)}</td>)}
                            </tr>
                            <tr className="bg-slate-950 font-bold border-t border-slate-700">
                                <td className="p-3 sticky right-0 bg-slate-900 text-slate-400 border-l border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)] z-10">יתרה לפני איזון</td>
                                {displayData.map(m => {
                                    const netOpInv = (m.rentIncome + m.otherIncome + m.vatIncome) + (m.suppliers + m.otherExpense + m.tax + m.vatExpense) + (m.assetSale + m.assetPurchase);
                                    const netFinancing = m.loanReceipt + m.loanRepayment + m.interest + m.capital;
                                    const preBal = m.openingBalance + netOpInv + netFinancing;
                                    return <td key={m.key} className="p-3 text-center text-slate-300" dir="ltr">{fmt(preBal)}</td>;
                                })}
                            </tr>
                             <tr>
                                <td className="p-3 sticky right-0 bg-slate-900 text-slate-400 pr-6 border-l border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)] z-10">איזון אשראי</td>
                                {displayData.map(m => (
                                    <Cell 
                                        key={m.key} 
                                        value={m.creditBalancing} 
                                        onClick={() => handleCellClick(m.key, 'credit_balancing')} 
                                        className={m.creditBalancing > 0.01 ? 'text-emerald-400 font-bold' : m.creditBalancing < -0.01 ? 'text-rose-400 font-bold' : 'text-slate-500'} 
                                    />
                                ))}
                            </tr>
                            <tr className="border-t-2 border-slate-600 bg-slate-900 font-bold text-lg hover:bg-slate-800 transition-colors">
                                <td className="p-4 sticky right-0 bg-slate-900 text-white border-l border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)] z-10 whitespace-nowrap">יתרת סגירה</td>
                                {displayData.map(m => <td key={m.key} className={`p-4 text-center whitespace-nowrap cursor-pointer ${m.closingBalance < 0 ? 'text-rose-500' : 'text-emerald-500'}`} dir="ltr" onClick={() => handleBalanceDrillDown(m.key, m.lastDate, true)}>{fmt(m.closingBalance)}</td>)}
                            </tr>
                            <tr className="bg-slate-950/50">
                                <td className="p-3 sticky right-0 bg-slate-900 text-indigo-300 font-medium text-xs border-l border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)] z-10 whitespace-nowrap">מסגרת פנויה (סגירה)</td>
                                {displayData.map(m => <td key={m.key} className="p-3 text-center text-indigo-300/70 text-xs whitespace-nowrap cursor-pointer hover:bg-indigo-500/10 transition-colors" dir="ltr" onClick={() => handleCreditDrillDown(m.key, m.lastDate, true)}>{fmt(m.closingAvailableCredit)}</td>)}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </Card>

            <Modal isOpen={!!drillDownData} onClose={() => setDrillDownData(null)} title={drillDownData?.title || ''}>
                <div className="text-indigo-400 text-sm font-medium -mt-4 mb-4 border-b border-slate-700 pb-2 text-right">{drillDownData?.subTitle}</div>
                <div className="overflow-x-auto max-h-[60vh] custom-scrollbar">
                    {drillDownData?.type === 'transactions' && (
                        <table className="w-full text-sm text-right text-slate-300">
                            <thead className="bg-slate-800 text-slate-400 sticky top-0"><tr><th className="px-4 py-2">תאריך</th><th className="px-4 py-2">תיאור</th><th className="px-4 py-2">ישות</th><th className="px-4 py-2">סכום</th><th className="px-4 py-2 text-white">משוקלל</th></tr></thead>
                            <tbody className="divide-y divide-slate-800">
                                {drillDownData.items.map((item: any, idx: number) => {
                                    const weight = weightedMap[item.entityId] || 0;
                                    return (
                                        <tr key={idx} className="hover:bg-slate-800/50">
                                            <td className="px-4 py-2">{formatDate(item.date)}</td><td className="px-4 py-2">{item.description}</td><td className="px-4 py-2 text-xs">{entities.find(e => e.id === item.entityId)?.name}</td><td className="px-4 py-2 font-mono text-slate-400" dir="ltr">{formatCurrency(item.amount)}</td><td className="px-4 py-2 font-bold text-indigo-400" dir="ltr">{formatCurrency(item.amount * (weight as number))}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                    {drillDownData?.type === 'vat_audit' && (
                        <div className="space-y-8">
                            {drillDownData.items.map((audit: any, idx: number) => (
                                <div key={idx} className="bg-slate-950/50 rounded-xl border border-slate-800 overflow-hidden">
                                    <div className="p-3 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-indigo-500/20 p-1.5 rounded text-indigo-400"><Info size={16}/></div>
                                            <div>
                                                <div className="text-xs text-slate-500">דיווח עבור תקופת: <span className="text-indigo-300 font-bold">{audit.reportingPeriod}</span></div>
                                                <div className="text-sm font-bold text-white">ישות: {entities.find(e => e.id === audit.settlement.entityId)?.name}</div>
                                            </div>
                                        </div>
                                        <div className="text-left">
                                            <div className="text-xs text-slate-500">סכום הדיווח (משוקלל)</div>
                                            <div className="text-lg font-black text-emerald-400" dir="ltr">{formatCurrency(audit.settlement.amount * audit.weight)}</div>
                                        </div>
                                    </div>
                                    <table className="w-full text-[11px] text-right text-slate-400">
                                        <thead className="bg-slate-900/50 border-b border-slate-800">
                                            <tr>
                                                <th className="px-3 py-2 font-medium">עסקת מקור</th>
                                                <th className="px-3 py-2 font-medium">קטגוריה</th>
                                                <th className="px-3 py-2 font-medium">סכום ברוטו</th>
                                                <th className="px-3 py-2 font-medium text-white">רכיב מע"מ</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/50">
                                            {audit.sources.map((src: any, sIdx: number) => {
                                                const rateDecimal = vatRate / 100;
                                                const grossAmount = Math.abs(src.amount);
                                                const vatPart = grossAmount - (grossAmount / (1 + rateDecimal));
                                                const isIncome = src.amount > 0 || src.type === 'income';
                                                return (
                                                    <tr key={sIdx} className="hover:bg-slate-900/30">
                                                        <td className="px-3 py-2 text-slate-200 font-medium">{src.description}</td>
                                                        <td className="px-3 py-2">{src.category}</td>
                                                        <td className="px-3 py-2 font-mono" dir="ltr">{formatCurrency(src.amount)}</td>
                                                        <td className={`px-3 py-2 font-bold ${isIncome ? 'text-emerald-500/80' : 'text-rose-500/80'}`} dir="ltr">
                                                            {isIncome ? '+' : '-'}{formatCurrency(vatPart)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {audit.sources.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-slate-600">לא נמצאו עסקאות יסוד בתיעוד הסימולציה לתקופה זו</td></tr>}
                                        </tbody>
                                        <tfoot className="bg-slate-900/20 border-t border-slate-800">
                                            <tr>
                                                <td colSpan={3} className="px-3 py-2 font-bold text-slate-300">סה"כ חבות/החזר מחושב (100%)</td>
                                                <td className="px-3 py-2 font-black text-white" dir="ltr">
                                                    {formatCurrency(audit.sources.reduce((acc: number, src: any) => {
                                                        const rateDecimal = vatRate / 100;
                                                        const gross = Math.abs(src.amount);
                                                        const v = gross - (gross / (1 + rateDecimal));
                                                        return acc + (src.amount > 0 ? v : -v);
                                                    }, 0))}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            ))}
                        </div>
                    )}
                    {(drillDownData?.type === 'balance' || drillDownData?.type === 'credit') && (
                        <table className="w-full text-sm text-right text-slate-300">
                            <thead className="bg-slate-800 text-slate-400 sticky top-0"><tr><th className="px-4 py-3">שם הישות</th><th className="px-4 py-3">אחזקה</th><th className="px-4 py-3">סכום מקור</th><th className="px-4 py-3 font-bold text-white">סכום משוקלל</th></tr></thead>
                            <tbody className="divide-y divide-slate-800">
                                {drillDownData.items.map((item: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-slate-800/50">
                                        <td className="px-4 py-3">{item.entityName}</td><td className="px-4 py-3 text-center">{item.ownership.toFixed(1)}%</td><td className="px-4 py-3 font-mono text-slate-400" dir="ltr">{formatCurrency(item.amount || item.available)}</td><td className="px-4 py-3 font-bold text-indigo-400" dir="ltr">{formatCurrency(item.weightedAmount || item.weightedAvailable)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </Modal>
        </>
    );
};

export const Dashboard: React.FC<DashboardProps> = ({ simulationResults, entities, accounts, tasks, loans, leases, guarantees, settings, selectedEntityIds, setSelectedEntityIds }) => {
    const [chartRange, setChartRange] = useState<number>(180); 
    const [alertFilter, setAlertFilter] = useState<AlertCategory>('all');
    const [isSyncingTeams, setIsSyncingTeams] = useState(false);

    const weightedMap = useMemo(() => {
        const weights: Record<string, number> = {};
        if (selectedEntityIds.includes('all')) {
            const walk = (id: string, weight: number) => {
                weights[id] = (weights[id] || 0) + weight;
                entities.filter(e => e.parentId === id).forEach(child => {
                    walk(child.id, weight * (child.ownershipPercentage / 100));
                });
            };
            const roots = entities.filter(e => !e.parentId || !entities.some(p => p.id === e.parentId));
            roots.forEach(root => walk(root.id, 1.0));
            return weights;
        }
        if (selectedEntityIds.length === 1) {
            weights[selectedEntityIds[0]] = 1.0;
        } else {
            selectedEntityIds.forEach(id => {
                weights[id] = getConsolidatedWeight(id, entities);
            });
        }
        return weights;
    }, [selectedEntityIds, entities]);

    const { allAlerts, kpiOpeningBalance, kpiAvailableCredit, kpiUncalledCapital, chartData, firstDeficitDate } = useMemo(() => {
        if (!simulationResults?.length) return { allAlerts: [], kpiOpeningBalance: 0, kpiAvailableCredit: 0, kpiUncalledCapital: 0, chartData: [], firstDeficitDate: null };
        const alerts: any[] = [];
        const seenMsg = new Set<string>();
        let kpiOpeningBalance = 0;
        let kpiAvailableCredit = 0;
        let kpiUncalledCapital = 0;
        const today = new Date(); today.setHours(0,0,0,0);
        const next7Days = addDays(today, 7);
        const next30Days = addDays(today, 30);
        const next90Days = addDays(today, 90);
        
        const activeEntitySet = new Set(Object.keys(weightedMap).filter(id => (weightedMap[id] || 0) > 0));

        Object.entries(weightedMap).forEach(([entId, weight]) => {
            const w = weight as number;
            const day0 = simulationResults[0];
            const day0Flow = day0.transactions.filter(t => t.entityId === entId).reduce((s, t) => s + t.amount, 0);
            kpiOpeningBalance += ((day0.entityBalances[entId] || 0) - day0Flow) * w;
            const entAccounts = accounts.filter(a => a.entityId === entId);
            kpiAvailableCredit += entAccounts.reduce((s, a) => s + Math.max(0, a.creditLimit - a.currentCreditUtil), 0) * w;
            const ent = entities.find(e => e.id === entId);
            if (ent) kpiUncalledCapital += ent.uncalledCapital * w;
        });

        let firstDeficitDate: string | null = null;
        
        simulationResults.forEach(day => {
            let dayClosingWeightedCash = 0;
            Object.entries(weightedMap).forEach(([entId, weight]) => {
                dayClosingWeightedCash += (day.entityBalances[entId] || 0) * (weight as number);
            });

            if (!firstDeficitDate && dayClosingWeightedCash < -0.01) {
                firstDeficitDate = day.date;
            }

            const dayDate = new Date(day.date);
            Object.entries(weightedMap).forEach(([entId, weight]) => {
                if ((weight as number) <= 0) return;
                const entName = entities.find(e => e.id === entId)?.name || '';
                
                if (dayDate <= next7Days) {
                    const entAccounts = accounts.filter(a => a.entityId === entId);
                    entAccounts.forEach(acc => {
                         if (day.entityBalances[entId] < 0) {
                            const msg = `צפי ליתרה שלילית: ${acc.nickname || acc.bankName} (${entName})`;
                            if (!seenMsg.has(msg)) { alerts.push({ date: day.date, message: msg, type: 'critical', category: 'flow' }); seenMsg.add(msg); }
                         }
                    });
                }

                if (dayDate <= next90Days) {
                    day.transactions.forEach(t => {
                        if (t.entityId === entId && (t.description.includes('הזרמת הון') || t.category === 'הון בעלים' || t.description.includes('הזרמה לבת')) && t.amount > 0) {
                            const msg = `צפי הזרמת הון: ${entName} (${formatCurrency(t.amount)})`;
                            if (!seenMsg.has(msg)) {
                                alerts.push({ date: day.date, message: msg, type: 'info', category: 'flow' });
                                seenMsg.add(msg);
                            }
                        }
                    });
                }

                if (dayDate <= next7Days) {
                    day.transactions.forEach(t => {
                        if (t.entityId === entId && (t.description.includes('משיכה ממסגרת') || t.category === 'איזון אשראי') && t.amount > 0) {
                            const msg = `משיכה נדרשת מהמסגרת: ${formatCurrency(t.amount)} ב-${entName}`;
                            if (!seenMsg.has(msg)) { alerts.push({ date: day.date, message: msg, type: 'info', category: 'flow' }); seenMsg.add(msg); }
                        }
                    });
                }

                day.transactions.forEach(t => {
                    if (t.entityId === entId && (t.category === 'רכישת נכסים' || t.category === 'מכירת נכסים')) {
                        const typeLabel = t.category === 'רכישת נכסים' ? 'רכישה' : 'מכירה';
                        const msg = `עסקת נכס: ${typeLabel} - ${t.description} (${entName})`;
                        if (!seenMsg.has(msg)) { alerts.push({ date: day.date, message: msg, type: 'asset', category: 'assets' }); seenMsg.add(msg); }
                    }
                });
            });

            day.alerts.forEach(msg => {
                if (!seenMsg.has(msg)) {
                    let cat: AlertCategory = 'all';
                    let type: any = 'info';
                    
                    if (msg.includes('הזרמת הון') || msg.includes('קריאת הון') || msg.includes('כשל')) {
                        cat = 'flow';
                        type = msg.includes('כשל') ? 'critical' : 'info';
                    } else if (msg.includes('[נכסים]')) {
                        cat = 'assets';
                        type = 'asset';
                    }

                    alerts.push({ date: day.date, message: msg, type, category: cat });
                    seenMsg.add(msg);
                }
            });
        });

        tasks.forEach(task => {
            if (!task.isCompleted && activeEntitySet.has(task.entityId)) {
                const d = new Date(task.dueDate);
                if (d >= today && d <= next7Days) {
                    const msg = `משימה לשבוע הקרוב: ${task.title}`;
                    if (!seenMsg.has(msg)) {
                        alerts.push({ date: task.dueDate, message: msg, type: 'task', category: 'tasks' });
                        seenMsg.add(msg);
                    }
                }
            }
        });

        loans.forEach(loan => {
            if (activeEntitySet.has(loan.entityId)) {
                const d = new Date(loan.endDate);
                if (d >= today && d <= next30Days) {
                    const msg = `הלוואה מסתיימת בקרוב: ${loan.name} (${formatCurrency(loan.principal)})`;
                    if (!seenMsg.has(msg)) {
                        alerts.push({ date: loan.endDate, message: msg, type: 'info', category: 'loans' });
                        seenMsg.add(msg);
                    }
                }
            }
        });

        guarantees.forEach(g => {
            if (activeEntitySet.has(g.entityId)) {
                const d = new Date(g.expiryDate);
                if (d >= today && d <= next30Days) {
                    alerts.push({ date: g.expiryDate, message: `תוקף ערבות מסתיים: ${g.beneficiary} (${formatCurrency(g.amount)})`, type: 'info', category: 'guarantees' });
                }
            }
        });

        leases.forEach(l => {
            if (activeEntitySet.has(l.entityId)) {
                const d = new Date(l.endDate);
                if (d >= today && d <= next30Days) {
                    const hasRenewal = leases.some(r => r.id !== l.id && r.tenantName === l.tenantName && r.property === l.property && new Date(r.startDate) > d);
                    if (!hasRenewal) {
                        alerts.push({ date: l.endDate, message: `חוזה שכירות מסתיים ללא חידוש: ${l.tenantName} (${l.property})`, type: 'critical', category: 'leases' });
                    }
                }
            }
        });

        const processedChartData = simulationResults.slice(0, chartRange).map(day => {
             let balance = 0, availableCredit = 0;
             Object.entries(weightedMap).forEach(([entId, weight]) => {
                 const w = weight as number;
                 balance += (day.entityBalances[entId] || 0) * w;
                 const entAccounts = accounts.filter(a => a.entityId === entId);
                 const limit = entAccounts.reduce((s, a) => s + a.creditLimit, 0);
                 const util = day.entityCreditUtil[entId] || 0;
                 availableCredit += Math.max(0, limit - util) * w;
             });
             return { date: day.date, balance, availableCredit };
        });
        
        return { allAlerts: alerts.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()), kpiOpeningBalance, kpiAvailableCredit, kpiUncalledCapital, chartData: processedChartData, firstDeficitDate };
    }, [simulationResults, weightedMap, accounts, entities, chartRange, tasks, loans, leases, guarantees]);

    const filteredAlerts = useMemo(() => {
        if (alertFilter === 'all') return allAlerts;
        return allAlerts.filter(a => a.category === alertFilter);
    }, [allAlerts, alertFilter]);

    const syncToTeams = async () => {
        if (!settings.teamsWebhookUrl) {
            alert('נא להגדיר Webhook URL במסך ההגדרות תחילה.');
            return;
        }

        const criticalAlerts = allAlerts.filter(a => a.type === 'critical' || a.category === 'flow');
        if (criticalAlerts.length === 0) {
            alert('אין התראות קריטיות לסנכרון כרגע.');
            return;
        }

        setIsSyncingTeams(true);
        try {
            const payload = {
                "@type": "MessageCard",
                "@context": "http://schema.org/extensions",
                "themeColor": "4F46E5",
                "summary": "Reality Flow - התראות תזרים דחופות",
                "sections": [{
                    "activityTitle": "Reality Flow - התראות מערכת",
                    "activitySubtitle": `נשלח ב-${new Date().toLocaleDateString('he-IL')} ${new Date().toLocaleTimeString('he-IL')}`,
                    "activityImage": "https://realityflow.app/logo.png",
                    "facts": criticalAlerts.slice(0, 5).map(a => ({
                        "name": formatDate(a.date),
                        "value": a.message
                    })),
                    "markdown": true
                }],
                "potentialAction": [{
                    "@type": "OpenUri",
                    "name": "פתח את המערכת",
                    "targets": [{ "os": "default", "uri": window.location.href }]
                }]
            };

            const response = await fetch(settings.teamsWebhookUrl, {
                method: 'POST',
                mode: 'no-cors', // Teams webhooks often require no-cors or simple content-types
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            alert('התראות נשלחו בהצלחה ל-Microsoft Teams!');
        } catch (error) {
            console.error('Teams Sync Error:', error);
            alert('שגיאה בשליחת ההתראות. וודא שה-URL תקין.');
        } finally {
            setIsSyncingTeams(false);
        }
    };

    if (!chartData?.length) return <div className="p-20 text-center text-slate-500">טוען נתונים...</div>;

    const filterOptions = [
        { id: 'all', label: 'הכל', icon: <Bell size={14} /> },
        { id: 'tasks', label: 'משימות', icon: <ClipboardList size={14} /> },
        { id: 'flow', label: 'תזרים', icon: <Wallet size={14} /> },
        { id: 'assets', label: 'נכסים', icon: <Tag size={14} /> },
        { id: 'loans', label: 'הלוואות', icon: <Landmark size={14} /> },
        { id: 'guarantees', label: 'ערבויות', icon: <Shield size={14} /> },
        { id: 'leases', label: 'שכירות', icon: <Key size={14} /> },
    ];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-4 w-full md:w-auto">
                      <MultiSelect label="סינון ישויות" options={[{ value: 'all', label: 'כל הישויות (מאוחד)' }, ...entities.map(e => ({ value: e.id, label: e.name }))]} selectedValues={selectedEntityIds} onChange={setSelectedEntityIds} className="w-72" />
                      <Select label="טווח תחזית" options={[{value: '30', label: '30 יום'}, {value: '90', label: 'רבעון'}, {value: '180', label: 'חצי שנה'}, {value: '365', label: 'שנה'}, {value: '1095', label: '3 שנים'}]} value={chartRange.toString()} onChange={e => setChartRange(Number(e.target.value))} className="w-40" />
                  </div>
                  <div className="flex items-center gap-2 text-slate-400 bg-slate-950 px-4 py-2 rounded-lg border border-slate-800"><Calendar size={16} /> <span className="text-sm font-mono">{new Date().toLocaleDateString('he-IL')}</span></div>
             </div>

             <div className="bg-slate-900 border-l-4 border-l-amber-500 rounded-r-xl shadow-lg overflow-hidden">
                 <div className="p-3 bg-slate-950/50 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                     <div className="flex items-center gap-2">
                        <Bell className="text-amber-500" size={18} />
                        <h3 className="font-bold text-slate-200">מרכז התראות</h3>
                        {settings.teamsWebhookUrl && (
                            <button 
                                onClick={syncToTeams}
                                disabled={isSyncingTeams}
                                className="mr-4 flex items-center gap-1.5 px-3 py-1 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-full text-[10px] font-black hover:bg-indigo-600 hover:text-white transition-all disabled:opacity-50 group"
                            >
                                {isSyncingTeams ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />}
                                <span>סנכרן לטימס</span>
                            </button>
                        )}
                     </div>
                     <div className="flex flex-wrap gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 overflow-x-auto max-w-full">
                         {filterOptions.map(opt => (
                             <button key={opt.id} onClick={() => setAlertFilter(opt.id as any)} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all whitespace-nowrap ${alertFilter === opt.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>
                                 {opt.icon} {opt.label}
                             </button>
                         ))}
                     </div>
                 </div>
                 <div className="p-2 space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
                     {filteredAlerts.length > 0 ? filteredAlerts.map((alert, idx) => (
                         <div key={idx} className={`flex items-center justify-between p-2 rounded hover:bg-slate-800/50 transition-colors border-b border-slate-800/50 last:border-0 ${alert.type === 'critical' ? 'text-rose-300 bg-rose-500/5' : 'text-slate-300'}`}>
                             <div className="flex items-center gap-3">
                                 {alert.category === 'assets' ? <Tag size={16} className="text-emerald-400" /> : 
                                  alert.category === 'flow' ? (alert.message.includes('הזרמת') ? <Zap size={16} className="text-indigo-400 fill-indigo-400/20" /> : <Wallet size={16} className="text-indigo-400" />) :
                                  alert.category === 'tasks' ? <ClipboardList size={16} className="text-indigo-300" /> :
                                  alert.category === 'loans' ? <Landmark size={16} className="text-amber-400" /> :
                                  alert.category === 'guarantees' ? <Shield size={16} className="text-emerald-500" /> :
                                  alert.category === 'leases' ? <Key size={16} className="text-rose-400" /> :
                                  <AlertTriangle size={16} className="text-amber-500" />}
                                 <span className="text-sm font-medium">{alert.message}</span>
                             </div>
                             <span className="text-xs font-mono opacity-70">{formatDate(alert.date)}</span>
                         </div>
                     )) : <div className="p-8 text-center text-slate-500 text-sm">אין התראות לסיווג הנבחר</div>}
                 </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <KPICard title="יתרת פתיחה (משוקללת)" value={formatCurrency(kpiOpeningBalance)} icon={<Wallet size={24} className="text-emerald-500" />} />
                  <KPICard title="מסגרת אשראי פנויה" value={formatCurrency(kpiAvailableCredit)} icon={<Activity size={24} className="text-indigo-500" />} />
                  <KPICard title="יתרת הון לא קרוא" value={formatCurrency(kpiUncalledCapital)} icon={<Briefcase size={24} className="text-amber-400" />} trend="זמין למשיכה" trendUp={true} />
                  <KPICard title="תאריך חריגה צפוי" value={firstDeficitDate ? formatDate(firstDeficitDate) : 'אין צפי'} icon={<Calendar size={24} className={firstDeficitDate ? "text-rose-500" : "text-emerald-500"} />} trend={firstDeficitDate ? 'נדרשת פעולה' : 'תקין'} trendUp={!firstDeficitDate} />
             </div>

             <Card title="תחזית יתרות ומסגרות פנויות" className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <defs>
                            <linearGradient id="colorBal" x1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                            <linearGradient id="colorCredit" x1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="date" tickFormatter={(val) => { const d = new Date(val); return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`; }} stroke="#64748b" tick={{fontSize: 12}} minTickGap={50} />
                        <YAxis stroke="#64748b" tickFormatter={(val) => (val/1000000).toFixed(1) + 'M'} tick={{fontSize: 12}} width={60} tickMargin={10} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{paddingTop: '10px'}} />
                        <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                        <Area type="monotone" dataKey="availableCredit" stroke="#6366f1" strokeWidth={2} fill="url(#colorCredit)" name="מסגרת פנויה" />
                        <Area type="monotone" dataKey="balance" stroke="#10b981" strokeWidth={3} fill="url(#colorBal)" name="יתרת עו״ש" />
                    </ComposedChart>
                </ResponsiveContainer>
             </Card>
             <CashFlowMatrix 
                data={simulationResults} 
                entities={entities} 
                accounts={accounts} 
                weightedMap={weightedMap} 
                selectedEntityIds={selectedEntityIds} 
                vatRate={settings.vatRate}
             />
        </div>
    );
};

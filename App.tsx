
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Entity, Account, Transaction, Loan, Lease, Guarantee, Task, Budget, GlobalSettings, AppState 
} from './types';
import { DEFAULT_SETTINGS, MOCK_ENTITIES, STRINGS, MOCK_TASKS, MOCK_BUDGETS } from './constants';
import { runSimulation } from './simulationEngine';
import { Dashboard } from './components/Screens/Dashboard';
import { EntitiesScreen } from './components/Screens/EntitiesScreen';
import { TransactionsScreen } from './components/Screens/TransactionsScreen';
import { TasksScreen } from './components/Screens/TasksScreen';
import { AccountsScreen } from './components/Screens/AccountsScreen';
import { LeasesScreen } from './components/Screens/LeasesScreen';
import { LoansScreen } from './components/Screens/LoansScreen';
import { GuaranteesScreen } from './components/Screens/GuaranteesScreen';
import { BudgetScreen } from './components/Screens/BudgetScreen';
import { SettingsScreen } from './components/Screens/SettingsScreen';
import { PWAInstallPrompt } from './components/UI/PWAInstallPrompt';
import { LayoutDashboard, Users, CreditCard, Banknote, Briefcase, Settings as SettingsIcon, LogOut, Activity, ClipboardList, Key, Shield, PieChart } from 'lucide-react';

const NavItem = ({ active, onClick, icon, label }: any) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all duration-200 ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
  >
    {icon}
    <span className="font-medium text-sm">{label}</span>
  </button>
);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>(['all']);
  
  const [entities, setEntities] = useState<Entity[]>(MOCK_ENTITIES);
  const [accounts, setAccounts] = useState<Account[]>([
    { id: 'acc_parent_88123', entityId: '1', bankName: 'לאומי', accountNumber: '88123', nickname: 'עו״ש ראשי', openingBalance: 150000, creditLimit: 500000, currentCreditUtil: 0, interestSpread: 1.5, isTaxAccount: true, guaranteeLimit: 100000, manualGuaranteeUtil: 0 },
    { id: 'acc_startup_44551', entityId: '3', bankName: 'פועלים', accountNumber: '44551', nickname: 'תפעול שוטף', openingBalance: 25000, creditLimit: 100000, currentCreditUtil: 0, interestSpread: 2.0, isTaxAccount: false, guaranteeLimit: 0, manualGuaranteeUtil: 0 }
  ]);
  const [transactions, setTransactions] = useState<Transaction[]>([
    { id: 't1', entityId: '2', accountId: 'acc_parent_88123', type: 'income', category: 'שכירות', description: 'שכירות בניין משרדים', date: new Date().toISOString(), amount: 45000, includesVat: true, isRecurring: true, frequency: 'Monthly', dayInMonth: 10, isActive: true, isIntercompany: false }
  ]);
  const [loans, setLoans] = useState<Loan[]>([
    { id: 'loan1', entityId: '1', accountId: 'acc_parent_88123', name: 'בניין א\'', principal: 150000000, spread: 1.05, startDate: '2025-12-21', endDate: '2026-06-30', interestFrequency: 'Monthly', principalFrequency: 'OneTime', needsRollover: false, isActive: true },
    { id: 'loan2', entityId: '3', accountId: 'acc_startup_44551', name: 'קרקע ב\'', principal: 72000000, spread: 0.9, startDate: '2024-01-01', endDate: new Date(Date.now() + 86400000 * 20).toISOString().split('T')[0], interestFrequency: 'Quarterly', principalFrequency: 'OneTime', needsRollover: true, isActive: true }
  ]);
  // Initialize mock leases with all required properties to satisfy Lease interface
  const [leases, setLeases] = useState<Lease[]>([
      { id: 'l1', entityId: '2', tenantName: 'חברת הייטק בע״מ', property: 'בניין המשרדים - קומה 2', leaseType: 'שכירות', leasedSqm: 0, ratePerSqm: 0, netAmount: 15000, frequency: 'Monthly', accountId: 'acc_parent_88123', paymentDay: 1, includesVat: true, linkageIndexBase: 100, startDate: '2023-01-01', endDate: '2024-12-31' },
      { id: 'l2', entityId: '2', tenantName: 'עו״ד כהן ושות׳', property: 'בניין המשרדים - קומה 1', leaseType: 'שכירות', leasedSqm: 0, ratePerSqm: 0, netAmount: 8000, frequency: 'Monthly', accountId: 'acc_parent_88123', paymentDay: 1, includesVat: true, linkageIndexBase: 0, startDate: '2023-06-01', endDate: new Date(Date.now() + 86400000 * 10).toISOString().split('T')[0] } 
  ]);
  const [guarantees, setGuarantees] = useState<Guarantee[]>([
    { id: 'g1', entityId: '1', accountId: 'acc_parent_88123', beneficiary: 'עיריית תל אביב', amount: 35000, issueDate: '2024-01-22', expiryDate: '2026-04-15', setupFee: 1000, annualInterestRate: 0.75, notes: '', attachments: [] }
  ]);
  const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS);
  const [budgets, setBudgets] = useState<Budget[]>(MOCK_BUDGETS);
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);

  const activeEntityIds = useMemo(() => {
    if (selectedEntityIds.includes('all')) {
      return new Set(entities.map(e => e.id));
    }
    return new Set(selectedEntityIds);
  }, [selectedEntityIds, entities]);

  const simulationResults = useMemo(() => {
    const fullState: AppState = { entities, accounts, transactions, loans, leases, guarantees, tasks, budgets, settings };
    return runSimulation(fullState);
  }, [entities, accounts, transactions, loans, leases, settings]);

  const getFullState = (): AppState => ({
      entities, accounts, transactions, loans, leases, guarantees, tasks, budgets, settings
  });

  const restoreState = (newState: AppState) => {
      if (newState.entities) setEntities(newState.entities);
      if (newState.accounts) setAccounts(newState.accounts);
      if (newState.transactions) setTransactions(newState.transactions);
      if (newState.loans) setLoans(newState.loans);
      if (newState.leases) setLeases(newState.leases);
      if (newState.guarantees) setGuarantees(newState.guarantees);
      if (newState.tasks) setTasks(newState.tasks);
      if (newState.budgets) setBudgets(newState.budgets);
      if (newState.settings) setSettings(newState.settings);
  };

  const currentSelectedEntityId = selectedEntityIds.length === 1 ? selectedEntityIds[0] : 'all';

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
      <PWAInstallPrompt />
      
      <aside className="w-72 bg-slate-900 border-l border-slate-800 flex flex-col fixed h-full z-20 overflow-hidden">
        <div className="p-6 pb-4">
            <div className="flex items-center gap-4 mb-8 group cursor-default">
                <div className="relative">
                    <div className="absolute -inset-2 bg-indigo-500/20 rounded-full blur-xl group-hover:bg-indigo-500/40 transition duration-700"></div>
                    <div className="relative bg-slate-800/40 backdrop-blur-md p-1.5 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex items-center justify-center min-w-[56px] min-h-[56px]">
                        {/* Inline SVG Logo - Ensures it always loads */}
                        <svg viewBox="0 0 100 100" className="w-11 h-11" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <linearGradient id="logo_grad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
                                    <stop stopColor="#6366F1" />
                                    <stop offset="1" stopColor="#A855F7" />
                                </linearGradient>
                            </defs>
                            <rect width="100" height="100" rx="24" fill="url(#logo_grad)" />
                            <path d="M28 66L42 42L56 58L72 34" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="72" cy="34" r="5" fill="white" />
                        </svg>
                    </div>
                </div>
                <div className="flex flex-col">
                    <h1 className="text-xl font-black tracking-tighter text-white leading-none">REALITY</h1>
                    <h1 className="text-xl font-light tracking-widest text-indigo-400 leading-none mt-1">FLOW</h1>
                </div>
            </div>
        </div>

        <nav className="flex-1 space-y-2 px-4 overflow-y-auto custom-scrollbar pb-4">
            <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={20}/>} label={STRINGS.dashboard} />
            <NavItem active={activeTab === 'entities'} onClick={() => setActiveTab('entities')} icon={<Users size={20}/>} label={STRINGS.entities} />
            <NavItem active={activeTab === 'accounts'} onClick={() => setActiveTab('accounts')} icon={<Banknote size={20}/>} label={STRINGS.accounts} />
            <NavItem active={activeTab === 'loans'} onClick={() => setActiveTab('loans')} icon={<CreditCard size={20}/>} label="ניהול הלוואות" />
            <NavItem active={activeTab === 'guarantees'} onClick={() => setActiveTab('guarantees')} icon={<Shield size={20}/>} label="ערבויות" />
            <NavItem active={activeTab === 'leases'} onClick={() => setActiveTab('leases')} icon={<Key size={20}/>} label="הכנסות משכירות" />
            <NavItem active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} icon={<Activity size={20}/>} label={STRINGS.transactions} />
            <NavItem active={activeTab === 'budget'} onClick={() => setActiveTab('budget')} icon={<PieChart size={20}/>} label={STRINGS.budget} />
            <NavItem active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} icon={<ClipboardList size={20}/>} label={STRINGS.tasks} />
            <div className="my-4 border-t border-slate-800"></div>
            <NavItem active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<SettingsIcon size={20}/>} label={STRINGS.settings} />
        </nav>

        <div className="p-4 border-t border-slate-800 mt-auto bg-slate-900">
            <div className="flex items-center justify-between gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-xs shadow-md">
                        בב
                    </div>
                    <div className="text-right">
                        <div className="text-sm font-bold text-white">ביצה ביצתי</div>
                        <div className="text-xs text-slate-500">CFO</div>
                    </div>
                </div>
                <button title="התנתק" className="text-slate-500 hover:text-rose-500 transition-colors p-1.5 hover:bg-slate-900 rounded-lg">
                    <LogOut size={18} />
                </button>
            </div>
        </div>
      </aside>

      <main className="flex-1 mr-72 p-8 max-w-[calc(100vw-18rem)] overflow-x-hidden overflow-y-auto h-screen">
         <header className="flex justify-between items-center mb-8 shrink-0">
            <h2 className="text-2xl font-bold text-slate-100">
                {activeTab === 'dashboard' && STRINGS.dashboard}
                {activeTab === 'entities' && STRINGS.entities}
                {activeTab === 'accounts' && STRINGS.accounts}
                {activeTab === 'leases' && 'הכנסות משכירות'}
                {activeTab === 'loans' && 'ניהול הלוואות'}
                {activeTab === 'guarantees' && 'ערבויות וביטחונות'}
                {activeTab === 'transactions' && STRINGS.transactions}
                {activeTab === 'budget' && 'תקציב מול ביצוע'}
                {activeTab === 'tasks' && STRINGS.tasks}
                {activeTab === 'settings' && STRINGS.settings}
            </h2>
         </header>

         <div className="min-h-[80vh] w-full pb-10">
            {activeTab === 'dashboard' && <Dashboard simulationResults={simulationResults} entities={entities} accounts={accounts} tasks={tasks} loans={loans} leases={leases} guarantees={guarantees} settings={settings} selectedEntityIds={selectedEntityIds} setSelectedEntityIds={setSelectedEntityIds} />}
            {activeTab === 'entities' && <EntitiesScreen entities={entities} setEntities={setEntities} />}
            {activeTab === 'accounts' && <AccountsScreen accounts={accounts} setAccounts={setAccounts} entities={entities} transactions={transactions} simulationResults={simulationResults} selectedEntityId={currentSelectedEntityId} setSelectedEntityId={(id) => setSelectedEntityIds([id])} activeEntityIds={activeEntityIds} />}
            {activeTab === 'leases' && <LeasesScreen leases={leases} setLeases={setLeases} entities={entities} accounts={accounts} selectedEntityId={currentSelectedEntityId} setSelectedEntityId={(id) => setSelectedEntityIds([id])} activeEntityIds={activeEntityIds} />}
            {activeTab === 'loans' && <LoansScreen loans={loans} setLoans={setLoans} entities={entities} accounts={accounts} selectedEntityId={currentSelectedEntityId} setSelectedEntityId={(id) => setSelectedEntityIds([id])} activeEntityIds={activeEntityIds} />}
            {activeTab === 'guarantees' && <GuaranteesScreen guarantees={guarantees} setGuarantees={setGuarantees} entities={entities} accounts={accounts} selectedEntityId={currentSelectedEntityId} setSelectedEntityId={(id) => setSelectedEntityIds([id])} activeEntityIds={activeEntityIds} />}
            {activeTab === 'transactions' && <TransactionsScreen transactions={transactions} setTransactions={setTransactions} entities={entities} accounts={accounts} simulationResults={simulationResults} selectedEntityId={currentSelectedEntityId} setSelectedEntityId={(id) => setSelectedEntityIds([id])} activeEntityIds={activeEntityIds} />}
            {activeTab === 'budget' && <BudgetScreen budgets={budgets} setBudgets={setBudgets} entities={entities} simulationResults={simulationResults} leases={leases} selectedEntityId={currentSelectedEntityId} setSelectedEntityId={(id) => setSelectedEntityIds([id])} activeEntityIds={activeEntityIds} />}
            {activeTab === 'tasks' && <TasksScreen tasks={tasks} setTasks={setTasks} entities={entities} />}
            {activeTab === 'settings' && <SettingsScreen settings={settings} setSettings={setSettings} fullState={getFullState()} onRestore={restoreState} />}
         </div>
      </main>
    </div>
  );
};

export default App;

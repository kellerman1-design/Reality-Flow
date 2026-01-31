
import { Entity, GlobalSettings, Task, Budget } from './types';

export const STRINGS = {
  appName: 'REALITY FLOW',
  dashboard: 'לוח בקרה',
  entities: 'ישויות',
  accounts: 'חשבונות בנק',
  loans: 'הלוואות',
  leases: 'שכירויות',
  guarantees: 'ערבויות',
  transactions: 'תנועות',
  tasks: 'משימות כספים',
  budget: 'תקציב',
  settings: 'הגדרות',
  backup: 'גיבוי ושחזור',
  import: 'ייבוא נתונים',
  export: 'ייצוא נתונים',
  add: 'הוסף חדש',
  edit: 'ערוך',
  delete: 'מחק',
  save: 'שמור',
  cancel: 'ביטול',
  description: 'תיאור',
  amount: 'סכום',
  date: 'תאריך',
  category: 'קטגוריה',
  bank: 'בנק',
  account: 'חשבון',
  balance: 'יתרה',
  creditLimit: 'מסגרת',
  simulation: 'תחזית תזרים',
  alerts: 'התראות מערכת',
  vat: 'מע״מ',
  income: 'הכנסה',
  expense: 'הוצאה',
};

export const CATEGORIES = {
  income: [
    'לקוחות',
    'מכירת נכסים',
    'התחשבנות פנים קבוצתית',
    'הזרמת בעלים',
    'שכירות',
    'בנקים',
    'מע"מ',
    'שונות'
  ],
  expense: [
    'ספקים',
    'רכישת נכסים',
    'מע"מ',
    'מס הכנסה',
    'דמי ניהול',
    'חלוקה למשקיעים',
    'מוסדות',
    'בנקים',
    'התחשבנות פנים קבוצתית',
    'שכירות',
    'הנהלה וכללי',
    'שיווק',
    'משכורות',
    'ביטוחים',
    'רכב',
    'שונות'
  ],
};

export const DEFAULT_SETTINGS: GlobalSettings = {
  primeRate: 6.0, // %
  vatRate: 17.0, // %
  cpi: 100.0,
};

export const MOCK_ENTITIES: Entity[] = [
  { id: '1', name: 'אחזקות על (החברה האם)', ownershipPercentage: 100, uncalledCapital: 5000000, targetBalance: 100000, hasTaxAdvances: true, taxAdvanceRate: 15 },
  { id: '2', name: 'נכסי הנדל"ן בע"מ', parentId: '1', ownershipPercentage: 100, uncalledCapital: 0, targetBalance: 50000, hasTaxAdvances: true, taxAdvanceRate: 10 },
  { id: '3', name: 'סטארט-אפ טכנולוגיות', parentId: '1', ownershipPercentage: 60, uncalledCapital: 2000000, targetBalance: 200000, hasTaxAdvances: false, taxAdvanceRate: 0 },
];

export const MOCK_TASKS: Task[] = [
  { id: '1', title: 'תשלום מע"מ יולי', description: 'להכין דוח מע"מ לחודש יולי ולהעביר לרואה חשבון', dueDate: new Date(Date.now() + 86400000 * 2).toISOString(), priority: 'High', entityId: '1', assignee: 'ישראל ישראלי', isCompleted: false, isRecurring: true },
  { id: '2', title: 'דיווח לדירקטוריון', description: 'הכנת מצגת רבעונית לישיבת בורד', dueDate: new Date(Date.now() + 86400000 * 5).toISOString(), priority: 'Medium', entityId: '1', assignee: 'חברת אחזקות א\'', isCompleted: false, isRecurring: false },
  { id: '3', title: 'חידוש ביטוח מבנה', description: 'קבלת הצעות מחיר מסוכן הביטוח', dueDate: new Date(Date.now() + 86400000 * 15).toISOString(), priority: 'Low', entityId: '2', assignee: 'פרויקט תל אביב', isCompleted: false, isRecurring: true },
];

export const MOCK_BUDGETS: Budget[] = [
  { id: '1', entityId: '2', category: 'שכירות', property: 'בניין המשרדים', annualBudget: 8021767, manualActualYTD: 2500000 },
  { id: '2', entityId: '2', category: 'ביטוחים', annualBudget: 120000, manualActualYTD: 60000 },
  { id: '3', entityId: '3', category: 'משכורות', annualBudget: 3500000, manualActualYTD: 1800000 },
];

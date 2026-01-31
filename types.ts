
export type Frequency = 'Monthly' | 'Quarterly' | 'SemiAnnually' | 'Annually' | 'OneTime';

export interface Attachment {
  id: string;
  name: string;
  url: string; // Base64 Data URL
  type: string;
}

export interface Entity {
  id: string;
  name: string;
  parentId?: string; // For hierarchy
  ownershipPercentage: number;
  uncalledCapital: number;
  targetBalance: number;
  hasTaxAdvances: boolean;
  taxAdvanceRate: number; // Percentage
}

export interface Account {
  id: string;
  entityId: string;
  bankName: string;
  accountNumber: string;
  nickname: string;
  openingBalance: number;
  creditLimit: number; // Masgeret
  currentCreditUtil: number;
  interestSpread: number; // Prime + X
  isTaxAccount: boolean;
  guaranteeLimit: number;
  manualGuaranteeUtil: number;
}

export interface Milestone {
  id: string;
  description: string;
  percentage: number;
  amount: number;
  days: number;
  date: string;
}

export interface Transaction {
  id: string;
  entityId: string;
  accountId: string;
  type: 'income' | 'expense' | 'financial' | 'tax' | 'operational' | 'intercompany';
  category: string;
  description: string;
  date: string; // ISO Date
  amount: number;
  includesVat: boolean;
  isRecurring: boolean;
  frequency?: Frequency;
  recurringDayMode?: 'Specific' | 'SameAsStart' | 'LastDay'; 
  dayInMonth?: number;
  isActive: boolean;
  isIntercompany: boolean;
  targetEntityId?: string;
  targetAccountId?: string;
  attachments?: Attachment[];
  // New Fields for Assets
  milestones?: Milestone[];
  linkageIndexBase?: number;
}

export interface Loan {
  id: string;
  entityId: string;
  accountId: string;
  name: string;
  principal: number;
  spread: number;
  startDate: string;
  endDate: string;
  interestFrequency: Frequency;
  principalFrequency: Frequency; // Can be 'OneTime' for Balloon
  needsRollover: boolean;
  isActive: boolean; // New field
  rolloverDate?: string;
  rolloverFrequency?: Frequency; 
  attachments?: Attachment[];
}

export interface Lease {
  id: string;
  entityId: string;
  tenantName: string; // Who pays us, or who we pay
  property: string;
  leaseType: 'שכירות' | 'דמי ניהול' | 'אחר'; // Added: Choice of service type
  leasedSqm: number; // Added: Square meters
  ratePerSqm: number; // Added: Price per SQM
  netAmount: number;
  frequency: Frequency;
  accountId: string;
  paymentDay: number;
  includesVat: boolean;
  linkageIndexBase?: number; // 0 if not linked
  startDate: string;
  endDate: string;
  attachments?: Attachment[];
}

export interface Guarantee {
  id: string;
  entityId: string;
  accountId: string;
  beneficiary: string;
  amount: number;
  issueDate: string;
  expiryDate: string;
  setupFee: number;
  annualInterestRate: number;
  notes: string;
  attachments?: Attachment[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  priority: 'High' | 'Medium' | 'Low';
  entityId: string;
  assignee: string;
  isCompleted: boolean;
  isRecurring?: boolean;
  frequency?: Frequency;
  recurringDayMode?: 'Specific' | 'SameAsStart' | 'LastDay';
  dayInMonth?: number;
  attachments?: Attachment[];
}

export interface Budget {
  id: string;
  entityId: string;
  category: string;
  property?: string;
  annualBudget: number;
  manualActualYTD: number; // The manual input field
}

// Global Settings
export interface GlobalSettings {
  primeRate: number; // Becomes "Current Prime Rate" in UI
  prevPrimeRate?: number; // Previous Prime Rate
  primeRateChangeDate?: string; // When the change occurred/occurs
  vatRate: number;
  cpi: number; // Consumer Price Index
}

// Simulation Types
export interface DailySimulationResult {
  date: string;
  entityBalances: Record<string, number>; // EntityID -> Cash Balance
  entityCreditUtil: Record<string, number>; // EntityID -> Credit Line Used
  aggregatedCash: number;
  transactions: {
    description: string;
    amount: number;
    entityId: string;
    type: 'operational' | 'financial' | 'tax' | 'intercompany';
    category?: string; // Added for Matrix grouping
    accountId?: string;
    includesVat?: boolean; // Property to track source VAT transactions
  }[];
  alerts: string[];
}

export interface AppState {
  entities: Entity[];
  accounts: Account[];
  transactions: Transaction[];
  loans: Loan[];
  leases: Lease[];
  guarantees: Guarantee[];
  tasks: Task[];
  budgets: Budget[];
  settings: GlobalSettings;
}

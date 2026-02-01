
import { Attachment, AppState, Entity, Account, Transaction, Loan, Lease, Guarantee, Task, Budget, GlobalSettings } from './types';
import * as XLSX from 'xlsx';

/**
 * Formats a number as a currency string with NIS symbol and handles negatives with parentheses.
 */
export const formatCurrency = (amount: number): string => {
  const absAmount = Math.abs(amount);
  const formatted = new Intl.NumberFormat('he-IL', {
    style: 'decimal',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(absAmount);

  return amount < 0 ? `(${formatted})` : formatted;
};

/**
 * Formats a YYYY-MM-DD string to a readable Hebrew date (DD/MM/YYYY) safely.
 */
export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  // Split to avoid timezone shifts from new Date(string)
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return new Date(dateStr).toLocaleDateString('he-IL');
};

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const addMonths = (date: Date, months: number): Date => {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
};

export const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month + 1, 0).getDate();
};

/**
 * Generates a robust, globally unique identifier.
 */
export const generateId = (): string => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 9);
  return `${timestamp}-${randomPart}`;
};

// Helper to convert File to Attachment object with Base64 URL
export const processFile = (file: File): Promise<Attachment> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve({
        id: generateId(),
        name: file.name,
        type: file.type,
        url: e.target?.result as string
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// --- EXCEL EXPORT / IMPORT ---

/**
 * Exports the entire application state to a multi-sheet Excel file.
 */
export const exportFullStateToExcel = (state: AppState) => {
    const wb = XLSX.utils.book_new();

    const addSheet = (data: any[], sheetName: string) => {
        const serializedData = data.map(item => {
            const { attachments, ...rest } = item;
            const row: any = { ...rest };
            if (row.milestones && Array.isArray(row.milestones)) {
                row.milestones = JSON.stringify(row.milestones);
            }
            return row;
        });
        const ws = XLSX.utils.json_to_sheet(serializedData);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    };

    addSheet(state.entities, "Entities");
    addSheet(state.accounts, "Accounts");
    addSheet(state.transactions, "Transactions");
    addSheet(state.loans, "Loans");
    addSheet(state.leases, "Leases");
    addSheet(state.guarantees, "Guarantees");
    addSheet(state.tasks, "Tasks");
    addSheet(state.budgets, "Budgets");
    
    const settingsData = [state.settings];
    addSheet(settingsData, "Settings");

    const fileName = `RealityFlow_Backup_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
};

/**
 * Imports application state from an Excel file.
 */
export const importFullStateFromExcel = (file: File): Promise<AppState> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const wb = XLSX.read(data, { type: 'array' });

                const getSheetData = (name: string) => {
                    const ws = wb.Sheets[name];
                    return ws ? XLSX.utils.sheet_to_json(ws) : [];
                };

                const normalizeRow = (row: any) => {
                    const processed = { ...row };
                    if (typeof processed.milestones === 'string' && processed.milestones.startsWith('[')) {
                        try { processed.milestones = JSON.parse(processed.milestones); } catch (e) { processed.milestones = []; }
                    }

                    const boolFields = [
                        'isActive', 'isIntercompany', 'includesVat', 
                        'isRecurring', 'hasTaxAdvances', 'needsRollover', 'isTaxAccount'
                    ];
                    
                    boolFields.forEach(field => {
                        if (Object.prototype.hasOwnProperty.call(processed, field)) {
                            if (typeof processed[field] === 'string') {
                                processed[field] = processed[field].toLowerCase() === 'true';
                            } else { processed[field] = Boolean(processed[field]); }
                        }
                    });

                    // Ensure numeric fields are numbers (specifically for new lease fields)
                    const numFields = ['leasedSqm', 'ratePerSqm', 'netAmount', 'linkageIndexBase', 'paymentDay', 'amount', 'principal', 'spread', 'annualBudget', 'manualActualYTD'];
                    numFields.forEach(field => {
                        if (processed[field] !== undefined) processed[field] = Number(processed[field]);
                    });

                    return processed;
                };

                const importedState: any = {
                    entities: getSheetData("Entities").map(normalizeRow),
                    accounts: getSheetData("Accounts").map(normalizeRow),
                    transactions: getSheetData("Transactions").map(normalizeRow),
                    loans: getSheetData("Loans").map(normalizeRow),
                    leases: getSheetData("Leases").map(normalizeRow),
                    guarantees: getSheetData("Guarantees").map(normalizeRow),
                    tasks: getSheetData("Tasks").map(normalizeRow),
                    budgets: getSheetData("Budgets").map(normalizeRow),
                    settings: getSheetData("Settings")[0] || {}
                };

                resolve(importedState as AppState);
            } catch (err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};

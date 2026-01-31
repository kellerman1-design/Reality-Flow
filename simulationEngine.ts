
import { addDays, addMonths, formatCurrency } from './utils';
import { AppState, DailySimulationResult, Loan, Lease, Transaction, Frequency, Entity, GlobalSettings } from './types';

/**
 * Returns the correct prime rate for a given date based on settings.
 */
const getPrimeRateAtDate = (date: Date, settings: GlobalSettings): number => {
    if (!settings.primeRateChangeDate || settings.prevPrimeRate === undefined) {
        return settings.primeRate;
    }
    const changeDate = new Date(settings.primeRateChangeDate);
    changeDate.setHours(0, 0, 0, 0);
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    return targetDate < changeDate ? settings.prevPrimeRate : settings.primeRate;
};

/**
 * Calculates the movement required to keep cash balance at the target level using available credit.
 */
const calculateBalanceWithCredit = (
  currentCash: number,
  targetBalance: number,
  totalCreditLimit: number,
  currentCreditUtil: number
): { newCash: number; newCreditUtil: number; action: string; amount: number } => {
  let newCash = currentCash;
  let newCreditUtil = currentCreditUtil;
  let action = 'none';
  let amount = 0;

  if (newCash < targetBalance) {
    const deficit = targetBalance - newCash;
    const availableCredit = Math.max(0, totalCreditLimit - currentCreditUtil);
    const drawAmount = Math.min(deficit, availableCredit);
    
    if (drawAmount > 0) {
      newCash += drawAmount;
      newCreditUtil += drawAmount;
      action = 'draw';
      amount = drawAmount;
    }
  } 
  else if (newCash > targetBalance && currentCreditUtil > 0) {
    const surplus = newCash - targetBalance;
    const repayAmount = Math.min(surplus, currentCreditUtil);
    
    if (repayAmount > 0) {
      newCash -= repayAmount;
      newCreditUtil -= repayAmount;
      action = 'repay';
      amount = repayAmount;
    }
  }

  return { newCash, newCreditUtil, action, amount };
};

const getDatesForFrequency = (start: Date, end: Date, freq: Frequency): Date[] => {
    if (freq === 'OneTime') return [new Date(end)];
    const dates: Date[] = [];
    let current = new Date(start);
    const advance = (d: Date) => {
        if (freq === 'Monthly') return addMonths(d, 1);
        if (freq === 'Quarterly') return addMonths(d, 3);
        if (freq === 'SemiAnnually') return addMonths(d, 6);
        if (freq === 'Annually') return addMonths(d, 12);
        return d;
    };
    
    current = advance(current);
    while (current < end) {
        dates.push(new Date(current));
        current = advance(current);
    }
    dates.push(new Date(end)); 
    return dates;
};

const preGenerateLoanTransactions = (loans: Loan[], startDate: Date, days: number, settings: GlobalSettings): Transaction[] => {
    const generated: Transaction[] = [];
    const simulationEndDate = addDays(startDate, days);
    const activeLoans = loans.filter(l => l.isActive);

    activeLoans.forEach(loan => {
        const loanStart = new Date(loan.startDate);
        const loanEnd = new Date(loan.endDate);
        
        if (loanStart >= startDate && loanStart <= simulationEndDate) {
             generated.push({
                 id: `gen-loan-receipt-${loan.id}`,
                 entityId: loan.entityId,
                 accountId: loan.accountId,
                 type: 'financial',
                 category: 'קבלת הלוואות',
                 description: `קבלת הלוואה: ${loan.name}`,
                 date: loan.startDate,
                 amount: loan.principal,
                 includesVat: false,
                 isRecurring: false,
                 isActive: true,
                 isIntercompany: false
             });
        }

        const principalDates = getDatesForFrequency(loanStart, loanEnd, loan.principalFrequency);
        const interestDates = getDatesForFrequency(loanStart, loanEnd, loan.interestFrequency);
        const allPaymentDates = Array.from(new Set([
            ...principalDates.map(d => d.getTime()),
            ...interestDates.map(d => d.getTime())
        ])).sort((a, b) => a - b).map(ts => new Date(ts));

        let lastPaymentDate = new Date(loanStart);
        let remainingPrincipal = loan.principal;
        const totalPrincipalInstallments = principalDates.length || 1;
        const principalSlice = loan.principal / totalPrincipalInstallments;

        allPaymentDates.forEach((payDate) => {
            const daysInPeriod = (payDate.getTime() - lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24);
            const currentPrime = getPrimeRateAtDate(payDate, settings);
            const annualRate = (currentPrime + loan.spread) / 100;
            const interestAmount = remainingPrincipal * annualRate * (daysInPeriod / 365);
            const isRelevantToSim = payDate >= startDate && payDate <= simulationEndDate;

            if (isRelevantToSim && interestAmount > 0.01) {
                generated.push({
                    id: `gen-loan-int-${loan.id}-${payDate.getTime()}`,
                    entityId: loan.entityId,
                    accountId: loan.accountId,
                    type: 'expense',
                    category: 'בנקים',
                    description: `ריבית הלוואה: ${loan.name}`,
                    date: payDate.toISOString(),
                    amount: interestAmount,
                    includesVat: false,
                    isRecurring: false,
                    isActive: true,
                    isIntercompany: false
                });
            }

            const isPrincipalDate = principalDates.some(pd => pd.getTime() === payDate.getTime());
            if (isPrincipalDate) {
                const isLast = payDate.getTime() === loanEnd.getTime();
                const amountToRepay = isLast ? remainingPrincipal : principalSlice;
                if (isRelevantToSim) {
                    generated.push({
                        id: `gen-loan-prin-${loan.id}-${payDate.getTime()}`,
                        entityId: loan.entityId,
                        accountId: loan.accountId,
                        type: 'expense',
                        category: 'החזר הלוואות',
                        description: `פירעון קרן: ${loan.name}${isLast ? ' (סופי)' : ''}`,
                        date: payDate.toISOString(),
                        amount: amountToRepay,
                        includesVat: false,
                        isRecurring: false,
                        isActive: true,
                        isIntercompany: false
                    });
                }
                remainingPrincipal -= amountToRepay;
            }
            lastPaymentDate = new Date(payDate);
        });
    });
    return generated;
};

const preGenerateLeaseTransactions = (leases: Lease[], simStartDate: Date, days: number, currentCPI: number): Transaction[] => {
    const generated: Transaction[] = [];
    const simEndDate = addDays(simStartDate, days);

    leases.forEach(lease => {
        const leaseStart = new Date(lease.startDate);
        const leaseEnd = new Date(lease.endDate);
        if (leaseEnd < simStartDate || leaseStart > simEndDate) return;

        let adjustedBaseAmount = (lease.linkageIndexBase && lease.linkageIndexBase > 0 && currentCPI > 0) 
            ? lease.netAmount * (currentCPI / lease.linkageIndexBase) 
            : lease.netAmount;

        const freq = lease.frequency;
        
        let firstStandardDate = new Date(leaseStart.getFullYear(), 0, 1);
        while (firstStandardDate < leaseStart) {
            if (freq === 'Monthly') firstStandardDate = addMonths(firstStandardDate, 1);
            else if (freq === 'Quarterly') firstStandardDate = addMonths(firstStandardDate, 3);
            else if (freq === 'SemiAnnually') firstStandardDate = addMonths(firstStandardDate, 6);
            else if (freq === 'Annually') firstStandardDate = addMonths(firstStandardDate, 12);
            else break;
        }

        if (leaseStart.getTime() !== firstStandardDate.getTime() && freq !== 'Monthly' && freq !== 'OneTime') {
            let periodStart = new Date(firstStandardDate);
            if (freq === 'Quarterly') periodStart = addMonths(periodStart, -3);
            else if (freq === 'SemiAnnually') periodStart = addMonths(periodStart, -6);
            else if (freq === 'Annually') periodStart = addMonths(periodStart, -12);

            const totalDaysInPeriod = (firstStandardDate.getTime() - periodStart.getTime()) / (1000*60*60*24);
            const activeDays = (firstStandardDate.getTime() - leaseStart.getTime()) / (1000*60*60*24);
            const proRataAmount = adjustedBaseAmount * (activeDays / totalDaysInPeriod);
            
            if (leaseStart <= simEndDate && leaseStart >= simStartDate) {
                generated.push({
                    id: `gen-lease-prorata-${lease.id}`,
                    entityId: lease.entityId,
                    accountId: lease.accountId,
                    type: 'income',
                    category: 'שכירות',
                    description: `שכירות יחסית: ${lease.tenantName} (${lease.property})`,
                    date: leaseStart.toISOString(),
                    amount: proRataAmount,
                    includesVat: lease.includesVat,
                    isRecurring: false,
                    isActive: true,
                    isIntercompany: false
                });
            }
        } else if (leaseStart.getTime() === firstStandardDate.getTime() || freq === 'Monthly') {
            if (freq === 'Monthly') firstStandardDate = new Date(leaseStart);
        }

        let currentPaymentDate = new Date(firstStandardDate);
        currentPaymentDate.setDate(lease.paymentDay);
        if (currentPaymentDate < firstStandardDate) currentPaymentDate = addMonths(currentPaymentDate, 1);

        while (currentPaymentDate <= leaseEnd && currentPaymentDate <= simEndDate) {
            if (currentPaymentDate >= simStartDate) {
                generated.push({
                    id: `gen-lease-std-${lease.id}-${currentPaymentDate.getTime()}`,
                    entityId: lease.entityId,
                    accountId: lease.accountId,
                    type: 'income',
                    category: 'שכירות',
                    description: `שכירות: ${lease.tenantName} (${lease.property})`,
                    date: currentPaymentDate.toISOString(),
                    amount: adjustedBaseAmount,
                    includesVat: lease.includesVat,
                    isRecurring: false,
                    isActive: true,
                    isIntercompany: false
                });
            }

            if (freq === 'Monthly') currentPaymentDate = addMonths(currentPaymentDate, 1);
            else if (freq === 'Quarterly') currentPaymentDate = addMonths(currentPaymentDate, 3);
            else if (freq === 'SemiAnnually') currentPaymentDate = addMonths(currentPaymentDate, 6);
            else if (freq === 'Annually') currentPaymentDate = addMonths(currentPaymentDate, 12);
            else break;
        }
    });
    return generated;
};

export const runSimulation = (state: AppState, daysToRun: number = 730): DailySimulationResult[] => {
  const results: DailySimulationResult[] = [];
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const loanTxs = preGenerateLoanTransactions(state.loans || [], today, daysToRun, state.settings);
  const leaseTxs = preGenerateLeaseTransactions(state.leases || [], today, daysToRun, state.settings.cpi);
  
  // Custom logic to expand Asset Transactions with Milestones
  const expandedAssetTxs: Transaction[] = [];
  (state.transactions || []).forEach(tx => {
      if (tx.isActive && (tx.category === 'רכישת נכסים' || tx.category === 'מכירת נכסים') && tx.milestones && tx.milestones.length > 0) {
          tx.milestones.forEach(m => {
              let milestoneAmount = m.amount;
              // Linkage Adjustment for Assets
              if (tx.linkageIndexBase && tx.linkageIndexBase > 0 && state.settings.cpi > 0) {
                  milestoneAmount = milestoneAmount * (state.settings.cpi / tx.linkageIndexBase);
              }
              
              expandedAssetTxs.push({
                  ...tx,
                  id: `asset-${tx.id}-m-${m.id}`,
                  description: `${tx.description}: ${m.description}`,
                  amount: milestoneAmount,
                  date: m.date,
                  isRecurring: false, // Milestones are one-time by nature relative to their date
                  milestones: undefined // Prevent recursion
              });
          });
      }
  });

  const filteredOriginalTxs = (state.transactions || []).filter(tx => 
    !((tx.category === 'רכישת נכסים' || tx.category === 'מכירת נכסים') && tx.milestones && tx.milestones.length > 0)
  );

  const allInitialTxs = [...filteredOriginalTxs, ...expandedAssetTxs, ...loanTxs, ...leaseTxs];

  const entities = state.entities || [];
  const entityDailyTxs: Record<string, Transaction[][]> = {};
  const entityStaticDailyNet: Record<string, number[]> = {};

  entities.forEach(ent => {
      entityDailyTxs[ent.id] = Array.from({ length: daysToRun }, () => []);
      entityStaticDailyNet[ent.id] = new Array(daysToRun).fill(0);
  });

  const vatRate = (state.settings.vatRate || 17) / 100;
  const entityVatAccumulated: Record<string, number> = {};
  entities.forEach(ent => { entityVatAccumulated[ent.id] = 0; });

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  
  allInitialTxs.forEach(tx => {
      if (!tx || !tx.isActive || !entityDailyTxs[tx.entityId]) return;
      const txStart = new Date(tx.date);
      txStart.setHours(0,0,0,0);
      
      const applyTx = (dayIdx: number) => {
          if (dayIdx < 0 || dayIdx >= daysToRun) return;
          entityDailyTxs[tx.entityId][dayIdx].push(tx);
          let amt = tx.amount;
          if (tx.includesVat) amt *= (1 + vatRate);
          const effective = (tx.category === 'קבלת הלוואות' || tx.type === 'income') ? Math.abs(amt) : -Math.abs(amt);
          entityStaticDailyNet[tx.entityId][dayIdx] += effective;
      };

      if (!tx.isRecurring) {
          const diff = Math.floor((txStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          applyTx(diff);
      } else {
          for (let i = 0; i < daysToRun; i++) {
              const curDate = addDays(today, i);
              if (curDate < txStart) continue;
              const dayOfMonth = curDate.getDate();
              const isLastDay = addDays(curDate, 1).getDate() === 1;
              const mode = tx.recurringDayMode || 'SameAsStart';
              let dayMatch = (mode === 'LastDay' && isLastDay) || (mode === 'SameAsStart' && dayOfMonth === txStart.getDate()) || (mode === 'Specific' && dayOfMonth === (tx.dayInMonth || 1));
              
              if (dayMatch) {
                  const monthsDiff = (curDate.getFullYear() - txStart.getFullYear()) * 12 + (curDate.getMonth() - txStart.getMonth());
                  let freqMatch = (tx.frequency === 'Monthly') || (tx.frequency === 'Quarterly' && monthsDiff % 3 === 0) || (tx.frequency === 'SemiAnnually' && monthsDiff % 6 === 0) || (tx.frequency === 'Annually' && monthsDiff % 12 === 0);
                  if (freqMatch) applyTx(i);
              }
          }
      }
  });

  const entityBalances: Record<string, number> = {};
  const entityCreditUtil: Record<string, number> = {};
  const entityCreditLimits: Record<string, number> = {};
  const entityMonthRevenue: Record<string, number> = {};
  const entityMainAccounts: Record<string, string> = {}; 
  const vatSettlementQueue: { settlementDate: string, amount: number, entityId: string }[] = [];

  entities.forEach(ent => {
    entityBalances[ent.id] = 0;
    entityCreditUtil[ent.id] = 0;
    entityCreditLimits[ent.id] = 0;
    entityMonthRevenue[ent.id] = 0;
    const entAccounts = (state.accounts || []).filter(a => a.entityId === ent.id);
    if (entAccounts.length > 0) {
        const mainAccount = entAccounts.sort((a,b) => b.creditLimit - a.creditLimit)[0];
        entityMainAccounts[ent.id] = mainAccount.id;
    }
    entAccounts.forEach(acc => {
      entityBalances[ent.id] += (acc.openingBalance || 0);
      entityCreditUtil[ent.id] += (acc.currentCreditUtil || 0);
      entityCreditLimits[ent.id] += (acc.creditLimit || 0);
    });
  });

  const sortedEntities = [...entities].sort((a, b) => {
      const getDepth = (id: string, depth = 0): number => {
          const e = entities.find(x => x.id === id);
          return (!e || !e.parentId) ? depth : getDepth(e.parentId, depth + 1);
      };
      return getDepth(a.id) - getDepth(b.id);
  });

  for (let i = 0; i < daysToRun; i++) {
    const currentDate = addDays(today, i);
    const dayOfMonth = currentDate.getDate();
    const currentDateStr = currentDate.toISOString().split('T')[0];
    const dayTransactions: DailySimulationResult['transactions'] = [];
    const alerts: string[] = [];

    if (dayOfMonth === 1) {
      for (const ent of entities) {
         if (entityCreditUtil[ent.id] > 0) {
            const spread = state.accounts.find(a => a.id === entityMainAccounts[ent.id])?.interestSpread || 1.5;
            const rate = (getPrimeRateAtDate(currentDate, state.settings) + spread) / 1200;
            const interest = entityCreditUtil[ent.id] * rate;
            entityBalances[ent.id] -= interest;
            dayTransactions.push({ description: 'חיוב ריבית מסגרת', amount: -interest, entityId: ent.id, accountId: entityMainAccounts[ent.id], type: 'operational', category: 'ריבית בנקים' });
         }
         const vatToSettle = entityVatAccumulated[ent.id] || 0;
         if (Math.abs(vatToSettle) > 1) {
             let settlementDateObj = new Date(currentDate);
             if (vatToSettle > 0) settlementDateObj.setDate(22); 
             else { settlementDateObj = addMonths(currentDate, 1); settlementDateObj.setDate(15); } 
             vatSettlementQueue.push({ settlementDate: settlementDateObj.toISOString().split('T')[0], amount: -vatToSettle, entityId: ent.id });
         }
         entityVatAccumulated[ent.id] = 0;
         entityMonthRevenue[ent.id] = 0;
      }
    }

    for (let j = vatSettlementQueue.length - 1; j >= 0; j--) {
        const item = vatSettlementQueue[j];
        if (item.settlementDate === currentDateStr) {
            entityBalances[item.entityId] += item.amount;
            dayTransactions.push({ description: item.amount < 0 ? 'תשלום מע״מ' : 'החזר מע״מ', amount: item.amount, entityId: item.entityId, type: 'tax', category: 'מע"מ' });
            vatSettlementQueue.splice(j, 1);
        }
    }

    for (const ent of entities) {
        const todayTxs = entityDailyTxs[ent.id]?.[i] || [];
        for (const tx of todayTxs) {
            let amt = tx.amount;
            let vatAmount = 0;
            if (tx.includesVat) { amt *= (1 + vatRate); vatAmount = amt - tx.amount; }
            const effective = (tx.category === 'קבלת הלוואות' || tx.type === 'income') ? Math.abs(amt) : -Math.abs(amt);
            entityBalances[ent.id] += effective;
            if (tx.includesVat) entityVatAccumulated[ent.id] += (effective > 0) ? vatAmount : -vatAmount;
            if (effective > 0 && (tx.type === 'operational' || tx.type === 'income')) entityMonthRevenue[ent.id] += tx.amount;
            
            dayTransactions.push({ description: tx.description, amount: effective, entityId: ent.id, accountId: tx.accountId, type: tx.type === 'financial' ? 'financial' : (tx.type === 'intercompany' ? 'intercompany' : 'operational'), category: tx.category, includesVat: tx.includesVat });
            
            if (tx.isIntercompany && tx.targetEntityId) {
                entityBalances[tx.targetEntityId] -= effective;
                dayTransactions.push({ description: `נגדי: ${tx.description}`, amount: -effective, entityId: tx.targetEntityId, type: 'intercompany', category: 'בין-חברתי' });
            }
        }

        if (dayOfMonth === 15 && ent.hasTaxAdvances) {
            const taxPayment = (entityMonthRevenue[ent.id] || 0) * (ent.taxAdvanceRate / 100);
            if (taxPayment > 1) {
                entityBalances[ent.id] -= taxPayment;
                dayTransactions.push({ description: 'מקדמות מס הכנסה', amount: -taxPayment, entityId: ent.id, type: 'tax', category: 'מס הכנסה' });
            }
        }
    }

    for (const ent of sortedEntities) {
        if (!ent.parentId) continue;
        const currentAvail = entityBalances[ent.id] + (entityCreditLimits[ent.id] - entityCreditUtil[ent.id]);
        if (currentAvail >= ent.targetBalance) continue;

        let injectionNeeded = false;
        let runningSum = currentAvail;
        const limit = Math.min(i + 7, daysToRun - 1);
        for (let k = i + 1; k <= limit; k++) {
            runningSum += entityStaticDailyNet[ent.id][k];
            if (runningSum < ent.targetBalance) { injectionNeeded = true; break; }
        }

        if (injectionNeeded) {
            const lookahead = (ent.ownershipPercentage < 100) ? 90 : 14;
            let minProj = currentAvail; let temp = currentAvail;
            const scanLimit = Math.min(i + lookahead, daysToRun);
            for (let k = i + 1; k < scanLimit; k++) {
                temp += entityStaticDailyNet[ent.id][k];
                if (temp < minProj) minProj = temp;
            }
            const amount = ent.targetBalance - minProj;
            if (amount > 100) {
                 const parentId = ent.parentId;
                 const parentShare = (ent.ownershipPercentage / 100) * amount;
                 const partnerShare = amount - parentShare;
                 
                 const pAvail = entityBalances[parentId] + (entityCreditLimits[parentId] - entityCreditUtil[parentId]);
                 if (pAvail >= parentShare) {
                     entityBalances[ent.id] += parentShare; entityBalances[parentId] -= parentShare;
                     dayTransactions.push({ description: `הזרמת הון`, amount: parentShare, entityId: ent.id, type: 'financial', category: 'הון בעלים' });
                     dayTransactions.push({ description: `הזרמה לבת`, amount: -parentShare, entityId: parentId, type: 'financial', category: 'הזרמת בעלים' });
                     if (partnerShare > 0.01) {
                         entityBalances[ent.id] += partnerShare;
                         dayTransactions.push({ description: `קריאת הון שותף`, amount: partnerShare, entityId: ent.id, type: 'financial', category: 'הון משקיעים' });
                     }
                 } else {
                     alerts.push(`כשל קריאת הון ל-${ent.name}: גירעון בחברת האם.`);
                 }
            }
        }
    }

    for (const ent of entities) {
        const op = calculateBalanceWithCredit(entityBalances[ent.id], ent.targetBalance, entityCreditLimits[ent.id], entityCreditUtil[ent.id]);
        if (op.action !== 'none') {
             entityBalances[ent.id] = op.newCash; entityCreditUtil[ent.id] = op.newCreditUtil;
             dayTransactions.push({ description: op.action === 'draw' ? 'משיכה ממסגרת' : 'החזר למסגרת', amount: op.action === 'draw' ? op.amount : -op.amount, entityId: ent.id, type: 'financial', category: 'איזון אשראי' });
        }
    }

    results.push({
        date: currentDateStr,
        entityBalances: { ...entityBalances },
        entityCreditUtil: { ...entityCreditUtil },
        aggregatedCash: Object.values(entityBalances).reduce((a, b) => a + b, 0),
        transactions: dayTransactions,
        alerts
    });
  }

  return results;
};

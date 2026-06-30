import { Expense, GroupMember, MemberBalance, SettlementPayment } from '../types';

/**
 * Calculates the total paid, total share, and net balance for each member in a group.
 */
export function calculateMemberBalances(
  members: GroupMember[],
  expenses: Expense[]
): MemberBalance[] {
  const balanceMap: Record<string, { paid: number; share: number }> = {};
  
  // Initialize map
  members.forEach(member => {
    balanceMap[member.id] = { paid: 0, share: 0 };
  });

  expenses.forEach(expense => {
    const { paidById, amount, splitType, splitDetails } = expense;

    // 1. Add to paid amount for the person who paid (only if they are a current member)
    if (balanceMap[paidById]) {
      balanceMap[paidById].paid += amount;
    }

    // 2. Distribute shares
    if (splitType === 'equal') {
      // Find who is included in the split. If splitDetails is empty, assume all members split equally.
      const splitMemberIds = Object.keys(splitDetails).length > 0 
        ? Object.keys(splitDetails) 
        : members.map(m => m.id);
      
      const count = splitMemberIds.length;
      if (count > 0) {
        const sharePerPerson = amount / count;
        splitMemberIds.forEach(mId => {
          if (balanceMap[mId]) {
            balanceMap[mId].share += sharePerPerson;
          }
        });
      }
    } else if (splitType === 'exact') {
      Object.entries(splitDetails).forEach(([mId, val]) => {
        if (balanceMap[mId]) {
          balanceMap[mId].share += val;
        }
      });
    } else if (splitType === 'percentage') {
      Object.entries(splitDetails).forEach(([mId, percent]) => {
        if (balanceMap[mId]) {
          balanceMap[mId].share += (percent / 100) * amount;
        }
      });
    } else if (splitType === 'shares') {
      const totalShares = Object.values(splitDetails).reduce((sum, s) => sum + s, 0);
      if (totalShares > 0) {
        Object.entries(splitDetails).forEach(([mId, shareCount]) => {
          if (balanceMap[mId]) {
            balanceMap[mId].share += (shareCount / totalShares) * amount;
          }
        });
      }
    }
  });

  return members.map(member => {
    const b = balanceMap[member.id] || { paid: 0, share: 0 };
    return {
      memberId: member.id,
      memberName: member.name,
      paid: b.paid,
      share: b.share,
      netBalance: b.paid - b.share
    };
  });
}

/**
 * Greedy algorithm to find the minimum number of transactions needed to settle debts.
 */
export function calculateSettlements(
  balances: MemberBalance[]
): SettlementPayment[] {
  // Filter and map debtors (net < 0) and creditors (net > 0)
  const debtors = balances
    .filter(b => b.netBalance < -0.01)
    .map(b => ({ ...b, netBalance: Math.abs(b.netBalance) }))
    .sort((a, b) => b.netBalance - a.netBalance); // Sort descending (most debt first)

  const creditors = balances
    .filter(b => b.netBalance > 0.01)
    .map(b => ({ ...b }))
    .sort((a, b) => b.netBalance - a.netBalance); // Sort descending (owed most first)

  const settlements: SettlementPayment[] = [];

  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const transferAmount = Math.min(debtor.netBalance, creditor.netBalance);
    
    if (transferAmount > 0.01) {
      settlements.push({
        fromId: debtor.memberId,
        fromName: debtor.memberName,
        toId: creditor.memberId,
        toName: creditor.memberName,
        amount: Number(transferAmount.toFixed(2))
      });
    }

    debtor.netBalance -= transferAmount;
    creditor.netBalance -= transferAmount;

    if (debtor.netBalance < 0.01) {
      dIdx++;
    }
    if (creditor.netBalance < 0.01) {
      cIdx++;
    }
  }

  return settlements;
}

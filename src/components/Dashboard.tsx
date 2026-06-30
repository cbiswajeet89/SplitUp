import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { calculateMemberBalances, calculateSettlements } from '../utils/splits';
import { convertCurrency, formatCurrency, SUPPORTED_CURRENCIES } from '../utils/currency';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, RefreshCw, Users, PlusCircle, ArrowRight, Wallet, Sparkles } from 'lucide-react';

export const Dashboard: React.FC<{ 
  onNavigateToGroup: (groupId: string) => void; 
  onOpenCreateGroup: () => void;
}> = ({ onNavigateToGroup, onOpenCreateGroup }) => {
  const { groups, allExpenses, isDemo, triggerDemoSeeding, user } = useApp();
  const [preferredCurrency, setPreferredCurrency] = useState('USD');
  const [overallOwedToYou, setOverallOwedToYou] = useState(0);
  const [overallYouOwe, setOverallYouOwe] = useState(0);
  const [balanceList, setBalanceList] = useState<{ memberName: string; groupName: string; amount: number; type: 'owe' | 'owed'; groupId: string }[]>([]);

  useEffect(() => {
    if (!user) return;

    let totalOwedToYou = 0;
    let totalUserOwes = 0;
    const tempBalances: typeof balanceList = [];

    // Compile balances across all groups
    groups.forEach(group => {
      // We need to fetch the expenses and members for this group.
      // Since they are not globally in context for all groups at once, 
      // we can compile them from allExpenses.
      const groupExpenses = allExpenses.filter(e => e.groupId === group.id);
      
      // We don't have members for all groups in global state easily, 
      // but we can infer the members list from the unique paidByIds and splitDetails keys in group expenses,
      // plus the creator. Or wait, let's look at the group's members.
      // In the demo context, we store members in local storage. Let's retrieve them!
      let groupMembers: { id: string; name: string }[] = [];
      if (isDemo) {
        const stored = localStorage.getItem('splitwise_demo_members_' + group.id);
        if (stored) {
          groupMembers = JSON.parse(stored);
        }
      } else {
        // For production, we can retrieve them or fall back to unique names from expenses.
        // To be safe and fast, let's accumulate unique members from the expenses splitDetails/paidBy,
        // and always include the current user.
        const memberMap = new Map<string, string>();
        memberMap.set(user.uid, user.displayName);
        
        groupExpenses.forEach(exp => {
          if (exp.paidById === user.uid) {
            memberMap.set(user.uid, user.displayName);
          } else {
            memberMap.set(exp.paidById, 'Group Member');
          }
          Object.keys(exp.splitDetails).forEach(id => {
            if (id !== user.uid) memberMap.set(id, 'Group Member');
          });
        });

        groupMembers = Array.from(memberMap.entries()).map(([id, name]) => ({ id, name }));
      }

      if (groupMembers.length === 0) {
        groupMembers = [{ id: user.uid, name: user.displayName }];
      }

      const balances = calculateMemberBalances(groupMembers as any, groupExpenses);
      const settlements = calculateSettlements(balances);

      // Find settlements involving current user
      settlements.forEach(settlement => {
        // Convert settlement amount to preferred currency
        const amtInPreferred = convertCurrency(settlement.amount, group.currency, preferredCurrency);

        if (settlement.fromId === user.uid) {
          // Current user owes someone
          totalUserOwes += amtInPreferred;
          tempBalances.push({
            memberName: settlement.toName,
            groupName: group.name,
            amount: amtInPreferred,
            type: 'owe',
            groupId: group.id
          });
        } else if (settlement.toId === user.uid) {
          // Someone owes current user
          totalOwedToYou += amtInPreferred;
          tempBalances.push({
            memberName: settlement.fromName,
            groupName: group.name,
            amount: amtInPreferred,
            type: 'owed',
            groupId: group.id
          });
        }
      });
    });

    setOverallOwedToYou(totalOwedToYou);
    setOverallYouOwe(totalUserOwes);
    setBalanceList(tempBalances);
  }, [groups, allExpenses, preferredCurrency, user, isDemo]);

  const netOverall = overallOwedToYou - overallYouOwe;

  return (
    <div className="space-y-6">
      {/* Upper header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-display flex items-center gap-2">
            Welcome back, {user?.displayName}
          </h1>
          <p className="text-sm text-slate-500">
            Here is your dynamic financial standing across all shared groups.
          </p>
        </div>

        {/* Currency selector */}
        <div className="flex items-center space-x-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
          <span className="text-xs font-semibold text-slate-400 pl-2 pr-1 uppercase">Convert Display:</span>
          <select
            value={preferredCurrency}
            onChange={(e) => setPreferredCurrency(e.target.value)}
            className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            {SUPPORTED_CURRENCIES.map(curr => (
              <option key={curr.code} value={curr.code}>
                {curr.code} ({curr.symbol})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Aggregate balance stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Total Net Balance Card */}
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between"
        >
          <div className="flex justify-between items-start">
            <span className="text-sm font-semibold text-slate-400">Net Overall Balance</span>
            <div className={`p-2 rounded-xl ${netOverall >= 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-650'}`}>
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className={`text-3xl font-bold font-display ${netOverall >= 0 ? 'text-indigo-600' : 'text-rose-650'}`}>
              {netOverall >= 0 ? '+' : ''}{formatCurrency(netOverall, preferredCurrency)}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {netOverall >= 0 ? 'You are owed overall' : 'You owe overall'} across {groups.length} groups
            </p>
          </div>
        </motion.div>

        {/* You Owe Card */}
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between"
        >
          <div className="flex justify-between items-start">
            <span className="text-sm font-semibold text-slate-400">Total You Owe</span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <TrendingDown className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-bold font-display text-rose-650">
              {formatCurrency(overallYouOwe, preferredCurrency)}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Money you need to pay back to friends
            </p>
          </div>
        </motion.div>

        {/* You Are Owed Card */}
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between"
        >
          <div className="flex justify-between items-start">
            <span className="text-sm font-semibold text-slate-400">Total You Are Owed</span>
            <div className="p-2 rounded-xl bg-green-50 text-green-600">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-bold font-display text-green-600">
              {formatCurrency(overallOwedToYou, preferredCurrency)}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Money your friends owe you
            </p>
          </div>
        </motion.div>
      </div>

      {/* Main Split details grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: detailed debts list */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight font-display">
                Balances breakdown
              </h2>
              <span className="text-xs font-semibold text-slate-400 px-2 py-1 bg-slate-50 border border-slate-200 rounded-xl">
                {balanceList.length} total links
              </span>
            </div>

            {balanceList.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <div className="bg-slate-50 inline-block p-4 rounded-2xl border border-slate-200 text-slate-400">
                  <Users className="h-8 w-8" />
                </div>
                <h3 className="text-sm font-semibold text-slate-800">No active balances</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  You are completely settled up with everyone! Create a group and add an expense to start tracking.
                </p>
                <div className="pt-2">
                  <button
                    onClick={onOpenCreateGroup}
                    className="inline-flex items-center text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl hover:bg-indigo-100 transition-colors cursor-pointer"
                  >
                    <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
                    Create shared group
                  </button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
                {balanceList.map((bal, idx) => (
                  <div key={idx} className="flex justify-between items-center py-3.5 first:pt-0 last:pb-0">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800">{bal.memberName}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        In group <span className="font-medium text-slate-600">{bal.groupName}</span>
                      </p>
                    </div>

                    <div className="text-right flex items-center space-x-3">
                      <div>
                        <span className={`text-xs font-bold uppercase tracking-wider block ${bal.type === 'owe' ? 'text-rose-500' : 'text-green-600'}`}>
                          {bal.type === 'owe' ? 'You owe' : 'Owes you'}
                        </span>
                        <span className={`text-sm font-bold font-mono ${bal.type === 'owe' ? 'text-rose-650' : 'text-green-600'}`}>
                          {formatCurrency(bal.amount, preferredCurrency)}
                        </span>
                      </div>

                      <button
                        onClick={() => onNavigateToGroup(bal.groupId)}
                        className="p-1.5 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 rounded-xl transition-colors cursor-pointer"
                        title="Go to group details"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Group shortcut list & Demo seeding */}
        <div className="lg:col-span-4 space-y-6">
          {/* Quick Groups List */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                Your Groups
              </h2>
              <button 
                onClick={onOpenCreateGroup}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline cursor-pointer"
              >
                + New
              </button>
            </div>

            {groups.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">No groups created yet.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {groups.map(group => (
                  <button
                    key={group.id}
                    onClick={() => onNavigateToGroup(group.id)}
                    className="w-full text-left p-3 hover:bg-slate-50 rounded-2xl border border-transparent hover:border-slate-100 flex justify-between items-center transition-all group cursor-pointer"
                  >
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">
                        {group.name}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[150px]">
                        {group.description || 'No description'}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors uppercase">
                      {group.currency}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Seed demo data card for sandbox explorers */}
          {isDemo && groups.length === 0 && (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-gradient-to-br from-indigo-900 to-slate-900 p-6 rounded-3xl text-white shadow-lg shadow-indigo-950/20 space-y-4 relative overflow-hidden"
            >
              <div className="absolute right-0 bottom-0 opacity-10">
                <Sparkles className="h-40 w-40 text-indigo-100" />
              </div>

              <div className="space-y-1 z-10 relative">
                <span className="inline-flex items-center text-[10px] font-bold bg-indigo-550/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-lg uppercase tracking-wider">
                  Sandbox Active
                </span>
                <h3 className="text-base font-bold font-display pt-1">
                  Populate Demo Sandbox
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Instantly load mock groups, multi-currency expenses, and pre-calculated debts to explore the dashboard.
                </p>
              </div>

              <button
                onClick={triggerDemoSeeding}
                className="w-full inline-flex justify-center items-center py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-500/20 hover:scale-[1.02] cursor-pointer"
              >
                Seed Mock Data
                <Sparkles className="ml-1.5 h-3.5 w-3.5" />
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

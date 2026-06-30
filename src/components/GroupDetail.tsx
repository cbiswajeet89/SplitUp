import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { calculateMemberBalances, calculateSettlements } from '../utils/splits';
import { convertCurrency, formatCurrency, getCurrencySymbol, SUPPORTED_CURRENCIES } from '../utils/currency';
import { CATEGORIES, getCategoryInfo } from '../utils/reports';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, PlusCircle, Trash2, Check, AlertTriangle, Users, 
  DollarSign, Calendar, ChevronRight, CheckCircle2, RefreshCw, Plus, Sparkles
} from 'lucide-react';

export const GroupDetail: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { 
    activeGroup, 
    activeGroupMembers, 
    activeGroupExpenses, 
    addExpense, 
    deleteExpense,
    addVirtualMember,
    user 
  } = useApp();

  const [activeTab, setActiveTab] = useState<'expenses' | 'balances' | 'settlements'>('expenses');
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);

  // Add Member State
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [memberError, setMemberError] = useState('');

  // Add Expense Form State
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(activeGroup?.currency || 'USD');
  const [paidById, setPaidById] = useState('');
  const [splitType, setSplitType] = useState<'equal' | 'exact' | 'percentage' | 'shares'>('equal');
  const [category, setCategory] = useState('food');
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [isSettlement, setIsSettlement] = useState(false);
  const [recipientId, setRecipientId] = useState(''); // for settlements

  // Maps memberId to split value (checkbox state for equal, amounts/percents/shares for others)
  const [splitValues, setSplitValues] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');

  // Settle Up Shortcut State
  const [settlePayerId, setSettlePayerId] = useState('');
  const [settleReceiverId, setSettleReceiverId] = useState('');
  const [settleAmount, setSettleAmount] = useState('');

  // 1. Calculate Group balances and settlements
  const balances = calculateMemberBalances(activeGroupMembers, activeGroupExpenses);
  const settlements = calculateSettlements(balances);

  // 2. Initialize/Update form defaults when active group or members change
  useEffect(() => {
    if (activeGroup) {
      setCurrency(activeGroup.currency);
    }
    if (activeGroupMembers.length > 0) {
      // Default payer is current user, or first member
      const currentUserMember = activeGroupMembers.find(m => m.uid === user?.uid);
      setPaidById(currentUserMember?.id || activeGroupMembers[0].id);
      
      // Default recipient for settlement is second member
      const otherMembers = activeGroupMembers.filter(m => m.id !== (currentUserMember?.id || activeGroupMembers[0].id));
      if (otherMembers.length > 0) {
        setRecipientId(otherMembers[0].id);
      }

      // Initialize split checkboxes/inputs (all checked/active by default)
      const initialSplits: Record<string, string> = {};
      activeGroupMembers.forEach(m => {
        initialSplits[m.id] = splitType === 'equal' ? 'true' : '1';
      });
      setSplitValues(initialSplits);
    }
  }, [activeGroup, activeGroupMembers, splitType, user]);

  if (!activeGroup) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Group not found.</p>
        <button onClick={onBack} className="mt-4 text-indigo-600 hover:underline cursor-pointer">Go back</button>
      </div>
    );
  }

  // Handle splitting dynamic values change
  const handleSplitValueChange = (mId: string, val: string) => {
    setSplitValues(prev => ({ ...prev, [mId]: val }));
  };

  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) {
      setMemberError('Name is required');
      return;
    }

    if (activeGroupMembers.some(m => m.name.toLowerCase() === newMemberName.trim().toLowerCase())) {
      setMemberError('A member with this name already exists in the group');
      return;
    }

    try {
      await addVirtualMember(activeGroup.id, newMemberName.trim(), newMemberEmail.trim() || undefined);
      setNewMemberName('');
      setNewMemberEmail('');
      setIsAddMemberOpen(false);
      setMemberError('');
    } catch (err) {
      setMemberError('Error adding member');
    }
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setFormError('Please enter a valid positive amount');
      return;
    }

    if (!description.trim()) {
      setFormError('Please enter a description');
      return;
    }

    // Process split details
    const finalSplitDetails: Record<string, number> = {};

    if (isSettlement) {
      // A settlement is paidById pays recipientId.
      // So paidById has paid, and recipientId's share is 100% of the amount.
      if (!paidById || !recipientId) {
        setFormError('Please specify both the sender and recipient');
        return;
      }
      if (paidById === recipientId) {
        setFormError('Sender and recipient cannot be the same person');
        return;
      }
      finalSplitDetails[recipientId] = numericAmount;
    } else {
      // Standard splitting rules
      if (splitType === 'equal') {
        const splittingMembers = Object.entries(splitValues)
          .filter(([_, checked]) => checked === 'true')
          .map(([mId]) => mId);

        if (splittingMembers.length === 0) {
          setFormError('At least one member must be selected for equal splitting');
          return;
        }
        
        // Equal details: we store splittingMembers as keys, amount / count as value
        const share = numericAmount / splittingMembers.length;
        splittingMembers.forEach(mId => {
          finalSplitDetails[mId] = Number(share.toFixed(2));
        });
      } else if (splitType === 'exact') {
        let sum = 0;
        activeGroupMembers.forEach(m => {
          const val = parseFloat(splitValues[m.id]) || 0;
          if (val < 0) {
            setFormError('Exact amounts cannot be negative');
            return;
          }
          finalSplitDetails[m.id] = val;
          sum += val;
        });

        if (Math.abs(sum - numericAmount) > 0.05) {
          setFormError(`The sum of exact amounts (${formatCurrency(sum, currency)}) does not match the total expense (${formatCurrency(numericAmount, currency)})`);
          return;
        }
      } else if (splitType === 'percentage') {
        let sumPct = 0;
        activeGroupMembers.forEach(m => {
          const val = parseFloat(splitValues[m.id]) || 0;
          if (val < 0) {
            setFormError('Percentages cannot be negative');
            return;
          }
          finalSplitDetails[m.id] = val;
          sumPct += val;
        });

        if (Math.abs(sumPct - 100) > 0.05) {
          setFormError(`The sum of percentages must equal 100% (currently ${sumPct}%)`);
          return;
        }
      } else if (splitType === 'shares') {
        let totalShares = 0;
        activeGroupMembers.forEach(m => {
          const val = parseFloat(splitValues[m.id]) || 0;
          if (val < 0) {
            setFormError('Shares cannot be negative');
            return;
          }
          finalSplitDetails[m.id] = val;
          totalShares += val;
        });

        if (totalShares <= 0) {
          setFormError('Total shares must be greater than 0');
          return;
        }
      }
    }

    try {
      await addExpense({
        groupId: activeGroup.id,
        description: isSettlement ? 'Settled Balances' : description.trim(),
        amount: numericAmount,
        currency,
        paidById,
        splitType: isSettlement ? 'exact' : splitType,
        splitDetails: finalSplitDetails,
        date,
        category: isSettlement ? 'others' : category,
        isSettlement
      });

      // Clear Form and Close Modal
      setDescription('');
      setAmount('');
      setIsAddExpenseOpen(false);
      setIsSettlement(false);
      setFormError('');
    } catch (err) {
      setFormError('Error logging expense');
    }
  };

  // Pre-fill a settlement directly from transaction suggestions!
  const triggerSettleUpModal = (fromId: string, toId: string, amountToSettle: number) => {
    setIsSettlement(true);
    setPaidById(fromId);
    setRecipientId(toId);
    setAmount(amountToSettle.toFixed(2));
    setDescription('Settle Balance Payment');
    setDate(new Date().toISOString().substring(0, 10));
    setIsAddExpenseOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Upper header segment */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-2xl transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight font-display">
              {activeGroup.name}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-sm sm:max-w-md">
              {activeGroup.description || 'Log expense items and settle balances.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddMemberOpen(true)}
            className="inline-flex items-center text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-2xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Member
          </button>

          <button
            id="add-expense-btn"
            onClick={() => {
              setIsSettlement(false);
              setIsAddExpenseOpen(true);
            }}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-2xl shadow-sm shadow-indigo-100 transition-all hover:scale-[1.01] cursor-pointer"
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Log Expense
          </button>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-slate-200">
        {(['expenses', 'balances', 'settlements'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 text-xs font-semibold capitalize border-b-2 -mb-[2px] transition-colors cursor-pointer ${
              activeTab === tab 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Main interactive grid based on tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT/MAIN CONTAINER - TABS CONTENT */}
        <div className="lg:col-span-8 space-y-6">
          {activeTab === 'expenses' && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight font-display">Itemized log</h2>
              
              {activeGroupExpenses.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <div className="bg-slate-50 inline-block p-4 rounded-2xl border border-slate-200 text-slate-400">
                    <Calendar className="h-8 w-8" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">No expenses logged yet</h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    All items logged inside this group will appear here with dynamic splitting calculations.
                  </p>
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        setIsSettlement(false);
                        setIsAddExpenseOpen(true);
                      }}
                      className="inline-flex items-center text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl hover:bg-indigo-100 transition-colors cursor-pointer"
                    >
                      <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
                      Add first expense
                    </button>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {activeGroupExpenses.map((expense) => {
                    const catInfo = getCategoryInfo(expense.category);
                    const payer = activeGroupMembers.find(m => m.id === expense.paidById);
                    
                    // Determine current user share
                    const currentUserMember = activeGroupMembers.find(m => m.uid === user?.uid);
                    const userShare = expense.splitDetails[currentUserMember?.id || ''] || 0;

                    return (
                      <div key={expense.id} className="flex justify-between items-center py-4 first:pt-0 last:pb-0 group">
                        <div className="flex items-center space-x-3">
                          {/* Category icon */}
                          <div className={`p-2.5 rounded-2xl text-white ${catInfo.color} shadow-sm shadow-slate-100`}>
                            <span className="text-xs font-semibold capitalize">
                              {expense.description.charAt(0).toUpperCase()}
                            </span>
                          </div>

                          <div>
                            <div className="flex items-center space-x-2">
                              <h4 className="text-sm font-semibold text-slate-800 line-clamp-1">{expense.description}</h4>
                              {expense.isSettlement && (
                                <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                                  Settlement
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-1 flex items-center space-x-1.5">
                              <span>Paid by <span className="font-semibold text-slate-600">{payer?.name || 'Someone'}</span></span>
                              <span>•</span>
                              <span>{expense.date}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <span className="text-xs font-semibold text-slate-400 block uppercase">Total Spent</span>
                            <span className="text-sm font-bold text-slate-800 font-mono">
                              {formatCurrency(expense.amount, expense.currency)}
                            </span>
                            {userShare > 0 && !expense.isSettlement && (
                              <span className="text-[10px] text-slate-500 block">
                                Your share: <span className="font-mono">{formatCurrency(userShare, expense.currency)}</span>
                              </span>
                            )}
                          </div>

                          {/* Delete capability */}
                          {(expense.createdBy === user?.uid || activeGroup.createdBy === user?.uid) && (
                            <button
                              onClick={() => deleteExpense(activeGroup.id, expense.id)}
                              className="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Delete expense"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'balances' && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight font-display">Member split standings</h2>
              
              <div className="divide-y divide-slate-100">
                {balances.map((bal) => (
                  <div key={bal.memberId} className="flex justify-between items-center py-3.5 first:pt-0 last:pb-0">
                    <div className="flex items-center space-x-2.5">
                      <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                        {bal.memberName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                          {bal.memberName}
                          {bal.memberId === user?.uid && (
                            <span className="text-[9px] font-bold text-slate-400 bg-slate-50 border border-slate-200 px-1 py-0.2 rounded">You</span>
                          )}
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Paid: <span className="font-mono font-medium text-slate-600">{formatCurrency(bal.paid, activeGroup.currency)}</span> • 
                          Share: <span className="font-mono font-medium text-slate-600">{formatCurrency(bal.share, activeGroup.currency)}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`text-xs font-bold uppercase block ${bal.netBalance >= 0.01 ? 'text-green-600' : bal.netBalance < -0.01 ? 'text-rose-500' : 'text-slate-400'}`}>
                        {bal.netBalance >= 0.01 ? 'Owed' : bal.netBalance < -0.01 ? 'Owes' : 'Settled'}
                      </span>
                      <span className={`text-sm font-bold font-mono ${bal.netBalance >= 0 ? 'text-green-600' : 'text-rose-650'}`}>
                        {bal.netBalance >= 0 ? '+' : ''}{formatCurrency(bal.netBalance, activeGroup.currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'settlements' && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight font-display">Debt optimization list</h2>
              <p className="text-xs text-slate-400">
                Minimal-transaction settlement suggestions to balance the group completely.
              </p>

              {settlements.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <div className="bg-indigo-50 inline-block p-4 rounded-full text-indigo-600 border border-indigo-100">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">Everything settled!</h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    All balances in this group are perfectly balanced. No transactions needed!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {settlements.map((settlement, idx) => (
                    <div key={idx} className="flex justify-between items-center p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                      <div className="flex items-center space-x-2 text-xs font-semibold text-slate-600">
                        <span className="font-bold text-slate-800">{settlement.fromName}</span>
                        <span>owes</span>
                        <span className="font-bold text-slate-800">{settlement.toName}</span>
                      </div>

                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-bold font-mono text-slate-800 bg-white border border-slate-200 px-2.5 py-1 rounded-xl">
                          {formatCurrency(settlement.amount, activeGroup.currency)}
                        </span>

                        <button
                          onClick={() => triggerSettleUpModal(settlement.fromId, settlement.toId, settlement.amount)}
                          className="inline-flex items-center py-1 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer transition-colors"
                        >
                          Settle Up
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR: Group member directories and stats */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Group directory</h3>
            
            <div className="space-y-2">
              {activeGroupMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition-colors">
                  <div className="flex items-center space-x-2">
                    <div className="h-6 w-6 rounded-full bg-indigo-50 flex items-center justify-center text-xs font-bold text-indigo-600">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-800 block truncate max-w-[130px]">{member.name}</span>
                      {member.email && <span className="text-[9px] text-slate-400 block max-w-[130px] truncate">{member.email}</span>}
                    </div>
                  </div>

                  {!member.uid && (
                    <span className="text-[8px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.2 rounded">
                      Virtual
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: ADD EXPENSE FORM */}
      <AnimatePresence>
        {isAddExpenseOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                <h3 className="text-base font-bold font-display text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-indigo-600" />
                  {isSettlement ? 'Record Settlement Payment' : 'Log Shared Expense'}
                </h3>
                <button
                  onClick={() => setIsAddExpenseOpen(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleExpenseSubmit} className="space-y-4">
                {formError && (
                  <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl text-xs font-semibold text-rose-600">
                    {formError}
                  </div>
                )}

                {/* Settlement Toggle */}
                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div>
                    <label className="text-xs font-bold text-slate-700">Is this a settlement payment?</label>
                    <p className="text-[10px] text-slate-400 mt-0.5">Check if this represents one person paying back another directly.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={isSettlement}
                    onChange={(e) => setIsSettlement(e.target.checked)}
                    className="h-4.5 w-4.5 text-indigo-600 focus:ring-indigo-500 rounded-sm cursor-pointer"
                  />
                </div>

                {isSettlement ? (
                  // SETTLEMENT FIELDS
                  <div className="grid grid-cols-2 gap-3 bg-indigo-50/20 p-4 border border-indigo-100 rounded-2xl">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Who Paid?</label>
                      <select
                        value={paidById}
                        onChange={(e) => setPaidById(e.target.value)}
                        className="w-full border border-slate-200 bg-white rounded-xl px-2.5 py-1.5 text-xs text-slate-800 cursor-pointer"
                      >
                        {activeGroupMembers.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Sent To?</label>
                      <select
                        value={recipientId}
                        onChange={(e) => setRecipientId(e.target.value)}
                        className="w-full border border-slate-200 bg-white rounded-xl px-2.5 py-1.5 text-xs text-slate-800 cursor-pointer"
                      >
                        {activeGroupMembers.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  // STANDARD EXPENSE DESCRIPTION & CATEGORY
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Description *</label>
                      <input
                        type="text"
                        placeholder="e.g. Italian dinner, taxi ride"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Category</label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full border border-slate-200 bg-white rounded-xl px-2.5 py-1.5 text-xs text-slate-800 cursor-pointer"
                      >
                        {CATEGORIES.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* AMOUNT, CURRENCY & DATE */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Amount *</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Currency</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full border border-slate-200 bg-white rounded-xl px-2 py-1.5 text-xs text-slate-800 cursor-pointer"
                    >
                      {SUPPORTED_CURRENCIES.map(curr => (
                        <option key={curr.code} value={curr.code}>{curr.code} ({curr.symbol})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Date *</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 cursor-pointer focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                {!isSettlement && (
                  // STANDARD SPLITTING CONTROLS
                  <div className="border-t border-slate-100 pt-3 space-y-3">
                    <div className="flex justify-between items-center bg-slate-50 p-2 border border-slate-200 rounded-2xl">
                      <label className="text-[11px] font-bold text-slate-500 uppercase pl-1">Split Strategy:</label>
                      <select
                        value={splitType}
                        onChange={(e) => setSplitType(e.target.value as any)}
                        className="border border-slate-200 bg-white rounded-lg px-2 py-0.5 text-xs text-slate-800 cursor-pointer"
                      >
                        <option value="equal">Split Equally</option>
                        <option value="exact">Exact Amounts</option>
                        <option value="percentage">By Percentages</option>
                        <option value="shares">By Shares</option>
                      </select>
                    </div>

                    {/* Who paid selection (standard) */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Who Paid?</label>
                      <select
                        value={paidById}
                        onChange={(e) => setPaidById(e.target.value)}
                        className="w-full border border-slate-200 bg-white rounded-xl px-2.5 py-1.5 text-xs text-slate-800 cursor-pointer"
                      >
                        {activeGroupMembers.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Dynamic Inputs for Members */}
                    <div className="space-y-2 bg-slate-50/50 p-3 border border-slate-200 rounded-2xl max-h-48 overflow-y-auto">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block pb-1 border-b border-slate-200">
                        {splitType === 'equal' ? 'Who shares?' : splitType === 'exact' ? 'Exact share amounts' : splitType === 'percentage' ? 'Shares by percentage' : 'Shares count'}
                      </label>

                      {activeGroupMembers.map(m => {
                        const val = splitValues[m.id] || '';
                        return (
                          <div key={m.id} className="flex items-center justify-between py-1">
                            <span className="text-xs font-semibold text-slate-700">{m.name}</span>

                            {splitType === 'equal' ? (
                              <input
                                type="checkbox"
                                checked={val === 'true'}
                                onChange={(e) => handleSplitValueChange(m.id, e.target.checked ? 'true' : 'false')}
                                className="h-4.5 w-4.5 text-indigo-600 focus:ring-indigo-500 rounded-sm cursor-pointer"
                              />
                            ) : (
                              <div className="flex items-center space-x-1">
                                {splitType === 'exact' && <span className="text-xs text-slate-400 font-mono">{getCurrencySymbol(currency)}</span>}
                                <input
                                  type="number"
                                  step="any"
                                  value={val}
                                  placeholder={splitType === 'exact' ? '0.00' : splitType === 'percentage' ? '0' : '1'}
                                  onChange={(e) => handleSplitValueChange(m.id, e.target.value)}
                                  className="border border-slate-200 bg-white rounded-lg px-2 py-0.5 text-xs text-slate-800 text-right w-20 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none"
                                />
                                {splitType === 'percentage' && <span className="text-xs text-slate-400 font-mono">%</span>}
                                {splitType === 'shares' && <span className="text-xs text-slate-400 font-mono">sh</span>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="border-t border-slate-100 pt-3 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsAddExpenseOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm shadow-indigo-100 cursor-pointer"
                  >
                    {isSettlement ? 'Record Settlement' : 'Log Expense'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: ADD MEMBER FORM */}
      <AnimatePresence>
        {isAddMemberOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl max-w-sm w-full"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                <h3 className="text-base font-bold font-display text-slate-900">Add new group member</h3>
                <button
                  onClick={() => setIsAddMemberOpen(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleAddMemberSubmit} className="space-y-4">
                {memberError && (
                  <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl text-xs font-semibold text-rose-600">
                    {memberError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Member Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Clara Dubois"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Email Address (Optional)</label>
                  <input
                    type="email"
                    placeholder="e.g. clara.d@example.com"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="border-t border-slate-100 pt-3 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsAddMemberOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm shadow-indigo-100 cursor-pointer"
                  >
                    Add Member
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

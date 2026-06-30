import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { SUPPORTED_CURRENCIES } from '../utils/currency';
import { motion } from 'motion/react';
import { PlusCircle, Trash2, ArrowRight, BookOpen, Users, HelpCircle, Check, Coins } from 'lucide-react';

export const Groups: React.FC<{ 
  onNavigateToGroup: (groupId: string) => void;
  isCreateOpen: boolean;
  setIsCreateOpen: (open: boolean) => void;
}> = ({ onNavigateToGroup, isCreateOpen, setIsCreateOpen }) => {
  const { groups, createGroup, user } = useApp();
  
  // Creation Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [tempMemberName, setTempMemberName] = useState('');
  const [tempMemberEmail, setTempMemberEmail] = useState('');
  const [membersList, setMembersList] = useState<{ name: string; email?: string }[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleAddMember = () => {
    if (!tempMemberName.trim()) {
      setErrorMsg('Friend name cannot be empty');
      return;
    }
    
    // Check if name already added
    if (membersList.some(m => m.name.toLowerCase() === tempMemberName.trim().toLowerCase())) {
      setErrorMsg('This friend name is already added');
      return;
    }

    setMembersList([...membersList, { 
      name: tempMemberName.trim(), 
      email: tempMemberEmail.trim() || undefined 
    }]);

    setTempMemberName('');
    setTempMemberEmail('');
    setErrorMsg('');
  };

  const handleRemoveMember = (idx: number) => {
    setMembersList(membersList.filter((_, i) => i !== idx));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Group name is required');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const newId = await createGroup(name.trim(), description.trim(), currency, membersList);
      
      // Reset form
      setName('');
      setDescription('');
      setCurrency('USD');
      setMembersList([]);
      setIsCreateOpen(false);
      
      // Navigate to new group
      onNavigateToGroup(newId);
    } catch (error) {
      console.error(error);
      setErrorMsg('Error creating group. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header card with quick actions */}
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-display flex items-center gap-2">
            Shared Groups
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Create groups with roommates, family, or friends to keep itemized split histories.
          </p>
        </div>

        {!isCreateOpen && (
          <button
            id="create-group-btn"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-2xl shadow-sm shadow-indigo-100 transition-all hover:scale-[1.01] cursor-pointer"
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Create Group
          </button>
        )}
      </div>

      {isCreateOpen ? (
        // CREATE GROUP VIEW (Interactive Form Card)
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm max-w-2xl mx-auto"
        >
          <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-5">
            <h2 className="text-lg font-bold text-slate-900 font-display">Create new shared group</h2>
            <button
              onClick={() => {
                setIsCreateOpen(false);
                setErrorMsg('');
              }}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600 hover:underline cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-5">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs font-semibold text-rose-600">
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Group Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Summer Vacation, Apartment 4B"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Group Currency *</label>
                <div className="relative">
                  <select
                     value={currency}
                     onChange={(e) => setCurrency(e.target.value)}
                     className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 appearance-none cursor-pointer"
                  >
                    {SUPPORTED_CURRENCIES.map(curr => (
                      <option key={curr.code} value={curr.code}>
                        {curr.code} ({curr.symbol}) - {curr.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <Coins className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Description</label>
              <input
                type="text"
                placeholder="e.g. Shared expenses for our trip or shared household bills"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50"
              />
            </div>

            {/* ADD GROUP MEMBERS DYNAMIC LIST */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 tracking-tight font-display">Group Members</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  You are added automatically. Add the rest of your split group below.
                </p>
              </div>

              {/* Dynamic current list */}
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                  <div className="flex items-center space-x-2">
                    <div className="h-5 w-5 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700">
                      You
                    </div>
                    <span className="text-xs font-semibold text-slate-800">{user?.displayName}</span>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-lg uppercase tracking-wider">
                    Creator
                  </span>
                </div>

                {membersList.map((m, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex items-center space-x-2">
                      <div className="h-5 w-5 rounded-full bg-indigo-50 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-slate-800">{m.name}</span>
                        {m.email && <span className="text-[10px] text-slate-400 block">{m.email}</span>}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveMember(idx)}
                      className="text-slate-400 hover:text-rose-500 p-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Remove member"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add member sub-inputs */}
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-2xl grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-5 space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Friend's Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Sarah Jenkins"
                    value={tempMemberName}
                    onChange={(e) => setTempMemberName(e.target.value)}
                    className="w-full border border-slate-200 bg-white rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="sm:col-span-5 space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Email Address (Optional)</label>
                  <input
                    type="email"
                    placeholder="e.g. sarah.j@example.com"
                    value={tempMemberEmail}
                    onChange={(e) => setTempMemberEmail(e.target.value)}
                    className="w-full border border-slate-200 bg-white rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={handleAddMember}
                    className="w-full py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 hover:border-indigo-300 text-indigo-700 font-bold text-xs rounded-xl transition-colors h-[34px] cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setIsCreateOpen(false);
                  setErrorMsg('');
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                id="submit-group-btn"
                disabled={submitting}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-xs rounded-xl shadow-sm shadow-indigo-100 transition-colors cursor-pointer"
              >
                {submitting ? 'Creating...' : 'Create Group'}
              </button>
            </div>
          </form>
        </motion.div>
      ) : (
        // GROUPS GRID LIST
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {groups.length === 0 ? (
            <div className="col-span-full bg-white p-12 text-center border border-slate-200 rounded-3xl space-y-4">
              <div className="bg-slate-50 inline-block p-5 rounded-2xl border border-slate-200 text-slate-400">
                <Users className="h-10 w-10" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-800 font-display">No shared groups yet</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Get started by creating a group for roommates, trip splits, or household expense logs with your friends.
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm shadow-indigo-100 transition-colors cursor-pointer"
                >
                  Create your first group
                  <PlusCircle className="ml-2 h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            groups.map(group => (
              <motion.div
                key={group.id}
                whileHover={{ y: -3 }}
                className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col justify-between group"
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded-lg uppercase tracking-wider font-mono">
                      {group.currency} Currency
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      Created {new Date(group.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-800 group-hover:text-indigo-600 transition-colors font-display line-clamp-1">
                      {group.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 min-h-[32px]">
                      {group.description || 'No description provided.'}
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 mt-4 flex justify-between items-center">
                  <div className="flex items-center space-x-1.5 text-slate-500">
                    <Users className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-semibold">{group.memberIds?.length || 1} members</span>
                  </div>

                  <button
                    onClick={() => onNavigateToGroup(group.id)}
                    className="inline-flex items-center text-xs font-bold text-indigo-600 hover:text-indigo-700 group-hover:underline cursor-pointer"
                  >
                    Manage Splits
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

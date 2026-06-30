import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  onSnapshot,
  addDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  getDocs
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { Group, GroupMember, Expense, UserProfile } from '../types';

interface AppContextType {
  user: UserProfile | null;
  loading: boolean;
  isDemo: boolean;
  groups: Group[];
  activeGroup: Group | null;
  activeGroupMembers: GroupMember[];
  activeGroupExpenses: Expense[];
  allExpenses: Expense[]; // flattened across all groups for monthly reports
  setActiveGroupId: (id: string | null) => void;
  loginWithGoogle: () => Promise<void>;
  loginAsDemo: () => void;
  logout: () => Promise<void>;
  createGroup: (name: string, description: string, currency: string, members: { name: string; email?: string }[]) => Promise<string>;
  addExpense: (expenseData: Omit<Expense, 'id' | 'createdBy' | 'createdAt'>) => Promise<void>;
  deleteExpense: (groupId: string, expenseId: string) => Promise<void>;
  addVirtualMember: (groupId: string, name: string, email?: string) => Promise<void>;
  triggerDemoSeeding: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_USER = 'splitwise_demo_user';
const LOCAL_STORAGE_KEY_GROUPS = 'splitwise_demo_groups';
const LOCAL_STORAGE_KEY_MEMBERS = 'splitwise_demo_members_'; // prefix
const LOCAL_STORAGE_KEY_EXPENSES = 'splitwise_demo_expenses_'; // prefix

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [activeGroupMembers, setActiveGroupMembers] = useState<GroupMember[]>([]);
  const [activeGroupExpenses, setActiveGroupExpenses] = useState<Expense[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);

  // 1. Manage Auth State
  useEffect(() => {
    // Check if demo user was active
    const savedDemoUser = localStorage.getItem(LOCAL_STORAGE_KEY_USER);
    if (savedDemoUser) {
      setUser(JSON.parse(savedDemoUser));
      setIsDemo(true);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setIsDemo(false);
        const userProfile: UserProfile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || 'Anonymous User',
          photoURL: firebaseUser.photoURL || undefined,
          createdAt: new Date().toISOString()
        };

        // Save profile to Firestore
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (!userDocSnap.exists()) {
            await setDoc(userDocRef, userProfile);
          } else {
            const existingData = userDocSnap.data() as UserProfile;
            userProfile.createdAt = existingData.createdAt;
          }
        } catch (error) {
          console.warn("Could not save profile to firestore, continuing in memory:", error);
        }

        setUser(userProfile);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Synchronize Groups & Expenses based on Firebase vs Demo
  useEffect(() => {
    if (loading) return;

    if (!user) {
      setGroups([]);
      setActiveGroupId(null);
      setAllExpenses([]);
      return;
    }

    if (isDemo) {
      // --- DEMO / LOCAL STORAGE ENGINE ---
      const loadDemoGroups = () => {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY_GROUPS);
        if (stored) {
          const parsedGroups = JSON.parse(stored) as Group[];
          setGroups(parsedGroups);
        } else {
          setGroups([]);
        }
      };
      loadDemoGroups();

      // Listen to storage changes to keep synced
      const handleStorageChange = () => {
        loadDemoGroups();
      };
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    } else {
      // --- PRODUCTION FIREBASE FIRESTORE ENGINE ---
      const q = query(
        collection(db, 'groups'),
        where('memberIds', 'array-contains', user.uid)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedGroups: Group[] = [];
        snapshot.forEach((doc) => {
          fetchedGroups.push(doc.data() as Group);
        });
        // Sort by createdAt descending
        fetchedGroups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setGroups(fetchedGroups);
      }, (error) => {
        console.error("Error listening to groups: ", error);
        handleFirestoreError(error, OperationType.LIST, 'groups');
      });

      return () => unsubscribe();
    }
  }, [user, isDemo, loading]);

  // 3. Sync Active Group, Members and Expenses
  useEffect(() => {
    if (!user) {
      setActiveGroup(null);
      setActiveGroupMembers([]);
      setActiveGroupExpenses([]);
      return;
    }

    const currentGroup = groups.find(g => g.id === activeGroupId) || null;
    setActiveGroup(currentGroup);

    if (!activeGroupId || !currentGroup) {
      setActiveGroupMembers([]);
      setActiveGroupExpenses([]);
      return;
    }

    if (isDemo) {
      // Demo load members
      const membersKey = LOCAL_STORAGE_KEY_MEMBERS + activeGroupId;
      const storedMembers = localStorage.getItem(membersKey);
      const parsedMembers = storedMembers ? JSON.parse(storedMembers) as GroupMember[] : [];
      setActiveGroupMembers(parsedMembers);

      // Demo load expenses
      const expensesKey = LOCAL_STORAGE_KEY_EXPENSES + activeGroupId;
      const storedExpenses = localStorage.getItem(expensesKey);
      const parsedExpenses = storedExpenses ? JSON.parse(storedExpenses) as Expense[] : [];
      // Sort expenses by date desc, then createdAt desc
      parsedExpenses.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
      setActiveGroupExpenses(parsedExpenses);
    } else {
      // Firebase load members
      const membersRef = collection(db, 'groups', activeGroupId, 'members');
      const unsubscribeMembers = onSnapshot(membersRef, (snapshot) => {
        const fetchedMembers: GroupMember[] = [];
        snapshot.forEach((doc) => {
          fetchedMembers.push(doc.data() as GroupMember);
        });
        setActiveGroupMembers(fetchedMembers);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `groups/${activeGroupId}/members`);
      });

      // Firebase load expenses
      const expensesRef = collection(db, 'groups', activeGroupId, 'expenses');
      const unsubscribeExpenses = onSnapshot(expensesRef, (snapshot) => {
        const fetchedExpenses: Expense[] = [];
        snapshot.forEach((doc) => {
          fetchedExpenses.push(doc.data() as Expense);
        });
        // Sort by date desc, then createdAt desc
        fetchedExpenses.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
        setActiveGroupExpenses(fetchedExpenses);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `groups/${activeGroupId}/expenses`);
      });

      return () => {
        unsubscribeMembers();
        unsubscribeExpenses();
      };
    }
  }, [activeGroupId, groups, isDemo, user]);

  // 4. Flatten all standard expenses across groups for general monthly reports
  useEffect(() => {
    if (!user) {
      setAllExpenses([]);
      return;
    }

    if (isDemo) {
      // Fetch expenses for all demo groups
      let flattened: Expense[] = [];
      groups.forEach(group => {
        const key = LOCAL_STORAGE_KEY_EXPENSES + group.id;
        const stored = localStorage.getItem(key);
        if (stored) {
          const exps = JSON.parse(stored) as Expense[];
          flattened = [...flattened, ...exps];
        }
      });
      setAllExpenses(flattened);
    } else {
      // Listen or compile from groups. Since subcollections can be listened separately:
      // We can query all expenses across all groups by compiling activeGroupExpenses or running collectionGroup.
      // Wait, let's keep a collection of all expenses by fetching them when groups change, or compiling live.
      // A clean way is to listen to activeGroupExpenses if we only show reports on active groups, or query expenses of all groups.
      // Let's query expenses for all user's groups.
      const unsubscribes: (() => void)[] = [];
      const expenseMap: Record<string, Expense[]> = {};

      groups.forEach(group => {
        const expensesRef = collection(db, 'groups', group.id, 'expenses');
        const unsub = onSnapshot(expensesRef, (snapshot) => {
          const exps: Expense[] = [];
          snapshot.forEach(doc => {
            exps.push(doc.data() as Expense);
          });
          expenseMap[group.id] = exps;

          // Re-flatten
          const flat = Object.values(expenseMap).flat();
          setAllExpenses(flat);
        });
        unsubscribes.push(unsub);
      });

      return () => {
        unsubscribes.forEach(unsub => unsub());
      };
    }
  }, [groups, isDemo, user]);

  // --- ACTIONS ---

  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Google Sign-In failed:", error);
    }
  };

  const loginAsDemo = () => {
    const demoUser: UserProfile = {
      uid: 'demo_user_123',
      email: 'sandbox.user@example.com',
      displayName: 'Sandbox Explorer',
      photoURL: undefined,
      createdAt: new Date().toISOString()
    };
    localStorage.setItem(LOCAL_STORAGE_KEY_USER, JSON.stringify(demoUser));
    setUser(demoUser);
    setIsDemo(true);
  };

  const logout = async () => {
    if (isDemo) {
      localStorage.removeItem(LOCAL_STORAGE_KEY_USER);
      setUser(null);
      setIsDemo(false);
      setActiveGroupId(null);
    } else {
      await signOut(auth);
    }
  };

  const createGroup = async (
    name: string,
    description: string,
    currency: string,
    members: { name: string; email?: string }[]
  ): Promise<string> => {
    if (!user) throw new Error("User must be authenticated");

    const newGroupId = isDemo 
      ? 'group_' + Math.random().toString(36).substr(2, 9)
      : doc(collection(db, 'groups')).id;

    // Create the group object
    const newGroup: Group = {
      id: newGroupId,
      name,
      description,
      createdBy: user.uid,
      memberIds: [user.uid], // we'll populate with valid user uids as they join
      currency,
      createdAt: new Date().toISOString()
    };

    // The current user is always the first group member
    const firstMember: GroupMember = {
      id: user.uid,
      uid: user.uid,
      name: user.displayName,
      email: user.email,
      joinedAt: new Date().toISOString()
    };

    // Construct other members
    const otherMembers: GroupMember[] = members.map((m, idx) => ({
      id: 'member_' + idx + '_' + Math.random().toString(36).substr(2, 5),
      name: m.name,
      email: m.email || undefined,
      joinedAt: new Date().toISOString()
    }));

    const allGroupMembers = [firstMember, ...otherMembers];

    if (isDemo) {
      // 1. Save group
      const demoGroups = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY_GROUPS) || '[]') as Group[];
      demoGroups.unshift(newGroup);
      localStorage.setItem(LOCAL_STORAGE_KEY_GROUPS, JSON.stringify(demoGroups));

      // 2. Save group members
      localStorage.setItem(LOCAL_STORAGE_KEY_MEMBERS + newGroupId, JSON.stringify(allGroupMembers));

      // 3. Save empty expenses
      localStorage.setItem(LOCAL_STORAGE_KEY_EXPENSES + newGroupId, JSON.stringify([]));

      // Update state local
      setGroups(demoGroups);
    } else {
      try {
        // Create parent group doc
        await setDoc(doc(db, 'groups', newGroupId), newGroup);

        // Add members to subcollection
        for (const m of allGroupMembers) {
          await setDoc(doc(db, 'groups', newGroupId, 'members', m.id), m);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `groups/${newGroupId}`);
      }
    }

    return newGroupId;
  };

  const addExpense = async (
    expenseData: Omit<Expense, 'id' | 'createdBy' | 'createdAt'>
  ) => {
    if (!user) throw new Error("User must be authenticated");

    const newExpenseId = isDemo 
      ? 'expense_' + Math.random().toString(36).substr(2, 9)
      : doc(collection(db, 'groups', expenseData.groupId, 'expenses')).id;

    const newExpense: Expense = {
      ...expenseData,
      id: newExpenseId,
      createdBy: user.uid,
      createdAt: new Date().toISOString()
    };

    if (isDemo) {
      const expensesKey = LOCAL_STORAGE_KEY_EXPENSES + expenseData.groupId;
      const stored = JSON.parse(localStorage.getItem(expensesKey) || '[]') as Expense[];
      stored.unshift(newExpense);
      localStorage.setItem(expensesKey, JSON.stringify(stored));

      // Force refresh current expenses state
      setActiveGroupExpenses(stored);
    } else {
      try {
        await setDoc(
          doc(db, 'groups', expenseData.groupId, 'expenses', newExpenseId),
          newExpense
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `groups/${expenseData.groupId}/expenses/${newExpenseId}`);
      }
    }
  };

  const deleteExpense = async (groupId: string, expenseId: string) => {
    if (!user) throw new Error("User must be authenticated");

    if (isDemo) {
      const expensesKey = LOCAL_STORAGE_KEY_EXPENSES + groupId;
      const stored = JSON.parse(localStorage.getItem(expensesKey) || '[]') as Expense[];
      const filtered = stored.filter(e => e.id !== expenseId);
      localStorage.setItem(expensesKey, JSON.stringify(filtered));
      setActiveGroupExpenses(filtered);
    } else {
      try {
        await deleteDoc(doc(db, 'groups', groupId, 'expenses', expenseId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `groups/${groupId}/expenses/${expenseId}`);
      }
    }
  };

  const addVirtualMember = async (groupId: string, name: string, email?: string) => {
    if (!user) throw new Error("User must be authenticated");

    const newMemberId = 'member_' + Math.random().toString(36).substr(2, 5);
    const newMember: GroupMember = {
      id: newMemberId,
      name,
      email: email || undefined,
      joinedAt: new Date().toISOString()
    };

    if (isDemo) {
      const membersKey = LOCAL_STORAGE_KEY_MEMBERS + groupId;
      const stored = JSON.parse(localStorage.getItem(membersKey) || '[]') as GroupMember[];
      stored.push(newMember);
      localStorage.setItem(membersKey, JSON.stringify(stored));
      setActiveGroupMembers(stored);
    } else {
      try {
        await setDoc(doc(db, 'groups', groupId, 'members', newMemberId), newMember);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `groups/${groupId}/members/${newMemberId}`);
      }
    }
  };

  const triggerDemoSeeding = () => {
    if (!isDemo || !user) return;

    // Seed beautiful mock Splitwise groups and transactions so the sandbox looks rich instantly!
    const mockGroups: Group[] = [
      {
        id: 'demo_grp_roomies',
        name: 'Apartment 4B roommates',
        description: 'Rent, electricity, grocery splits',
        createdBy: user.uid,
        memberIds: [user.uid],
        currency: 'USD',
        createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
      },
      {
        id: 'demo_grp_euro',
        name: 'Euro Trip 2026 🇪🇺',
        description: 'Summer holiday travels and dining',
        createdBy: user.uid,
        memberIds: [user.uid],
        currency: 'EUR',
        createdAt: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString()
      }
    ];

    const mockMembersRoomies: GroupMember[] = [
      { id: user.uid, uid: user.uid, name: user.displayName, email: user.email, joinedAt: new Date().toISOString() },
      { id: 'm_sarah', name: 'Sarah Jenkins', email: 'sarah.j@example.com', joinedAt: new Date().toISOString() },
      { id: 'm_alex', name: 'Alex Rivera', email: 'alex.r@example.com', joinedAt: new Date().toISOString() }
    ];

    const mockMembersEuro: GroupMember[] = [
      { id: user.uid, uid: user.uid, name: user.displayName, email: user.email, joinedAt: new Date().toISOString() },
      { id: 'm_clara', name: 'Clara Dubois', email: 'clara.d@example.com', joinedAt: new Date().toISOString() },
      { id: 'm_marco', name: 'Marco Rossi', email: 'marco.r@example.com', joinedAt: new Date().toISOString() },
      { id: 'm_emma', name: 'Emma Watson', email: 'emma.w@example.com', joinedAt: new Date().toISOString() }
    ];

    const mockExpensesRoomies: Expense[] = [
      {
        id: 'e_rent',
        groupId: 'demo_grp_roomies',
        description: 'Monthly Apartment Rent',
        amount: 1800,
        currency: 'USD',
        paidById: user.uid,
        splitType: 'equal',
        splitDetails: { [user.uid]: 600, 'm_sarah': 600, 'm_alex': 600 },
        date: new Date().toISOString().substring(0, 10),
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
        category: 'lodging',
        isSettlement: false
      },
      {
        id: 'e_groceries',
        groupId: 'demo_grp_roomies',
        description: 'Organic Groceries & Supplies',
        amount: 120,
        currency: 'USD',
        paidById: 'm_sarah',
        splitType: 'equal',
        splitDetails: { [user.uid]: 40, 'm_sarah': 40, 'm_alex': 40 },
        date: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString().substring(0, 10),
        createdBy: 'm_sarah',
        createdAt: new Date().toISOString(),
        category: 'food',
        isSettlement: false
      },
      {
        id: 'e_wifi',
        groupId: 'demo_grp_roomies',
        description: 'Gigabit Fiber Internet',
        amount: 60,
        currency: 'USD',
        paidById: 'm_alex',
        splitType: 'equal',
        splitDetails: { [user.uid]: 20, 'm_sarah': 20, 'm_alex': 20 },
        date: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString().substring(0, 10),
        createdBy: 'm_alex',
        createdAt: new Date().toISOString(),
        category: 'utilities',
        isSettlement: false
      }
    ];

    const mockExpensesEuro: Expense[] = [
      {
        id: 'e_dinner_paris',
        groupId: 'demo_grp_euro',
        description: 'Le Bistrot Dining Paris',
        amount: 240,
        currency: 'EUR',
        paidById: 'm_clara',
        splitType: 'equal',
        splitDetails: { [user.uid]: 60, 'm_clara': 60, 'm_marco': 60, 'm_emma': 60 },
        date: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString().substring(0, 10),
        createdBy: 'm_clara',
        createdAt: new Date().toISOString(),
        category: 'food',
        isSettlement: false
      },
      {
        id: 'e_train_tickets',
        groupId: 'demo_grp_euro',
        description: 'TGV Train Paris to Amsterdam',
        amount: 320,
        currency: 'EUR',
        paidById: user.uid,
        splitType: 'shares',
        splitDetails: { [user.uid]: 1, 'm_clara': 1, 'm_marco': 1, 'm_emma': 1 },
        date: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString().substring(0, 10),
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
        category: 'travel',
        isSettlement: false
      },
      {
        id: 'e_museum',
        groupId: 'demo_grp_euro',
        description: 'Van Gogh Museum Entry',
        amount: 90,
        currency: 'EUR',
        paidById: 'm_marco',
        splitType: 'exact',
        splitDetails: { [user.uid]: 22.5, 'm_clara': 22.5, 'm_marco': 22.5, 'm_emma': 22.5 },
        date: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString().substring(0, 10),
        createdBy: 'm_marco',
        createdAt: new Date().toISOString(),
        category: 'entertainment',
        isSettlement: false
      }
    ];

    localStorage.setItem(LOCAL_STORAGE_KEY_GROUPS, JSON.stringify(mockGroups));
    localStorage.setItem(LOCAL_STORAGE_KEY_MEMBERS + 'demo_grp_roomies', JSON.stringify(mockMembersRoomies));
    localStorage.setItem(LOCAL_STORAGE_KEY_EXPENSES + 'demo_grp_roomies', JSON.stringify(mockExpensesRoomies));
    localStorage.setItem(LOCAL_STORAGE_KEY_MEMBERS + 'demo_grp_euro', JSON.stringify(mockMembersEuro));
    localStorage.setItem(LOCAL_STORAGE_KEY_EXPENSES + 'demo_grp_euro', JSON.stringify(mockExpensesEuro));

    // Force updates
    setGroups(mockGroups);
    setActiveGroupId('demo_grp_roomies');
  };

  return (
    <AppContext.Provider value={{
      user,
      loading,
      isDemo,
      groups,
      activeGroup,
      activeGroupMembers,
      activeGroupExpenses,
      allExpenses,
      setActiveGroupId,
      loginWithGoogle,
      loginAsDemo,
      logout,
      createGroup,
      addExpense,
      deleteExpense,
      addVirtualMember,
      triggerDemoSeeding
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};

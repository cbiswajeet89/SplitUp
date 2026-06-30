export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  memberIds: string[];
  currency: string;
  createdAt: string;
}

export interface GroupMember {
  id: string; // matches uid if registered, or a random ID if virtual (friend added by name)
  uid?: string; // empty for virtual members
  name: string;
  email?: string;
  joinedAt: string;
}

export type SplitType = 'equal' | 'exact' | 'percentage' | 'shares';

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  currency: string;
  paidById: string; // ID of the GroupMember who paid
  splitType: SplitType;
  // splitDetails maps each memberId to their specific split value:
  // - for 'equal': not strictly needed, but can map to split amount
  // - for 'exact': maps to the exact amount they owe
  // - for 'percentage': maps to the percentage they owe (e.g. 50 for 50%)
  // - for 'shares': maps to the number of shares they owe (e.g. 2 shares)
  splitDetails: Record<string, number>;
  date: string; // YYYY-MM-DD
  createdBy: string;
  createdAt: string;
  category: string;
  isSettlement: boolean; // if true, this represents a settlement payment (i.e. settling debt)
}

export interface Currency {
  code: string;
  symbol: string;
  name: string;
  rateToUSD: number; // static exchange rates for conversion
}

export interface SettlementPayment {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
}

export interface MemberBalance {
  memberId: string;
  memberName: string;
  paid: number;
  share: number;
  netBalance: number; // paid - share
}

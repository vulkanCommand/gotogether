import { CrewMember, ExpenseGroup, ExpenseItem, ExpenseSplit } from '../store/tripStore';

export type BalanceLine = {
  fromMemberId: string;
  fromMemberName: string;
  toMemberId: string;
  toMemberName: string;
  amount: number;
};

export type MemberTotals = {
  memberId: string;
  memberName: string;
  paid: number;
  owed: number;
  net: number;
};

export type ExpenseGroupSummary = {
  totalSpent: number;
  currentUserOwes: number;
  currentUserIsOwed: number;
  netBalance: number;
  balanceLines: BalanceLine[];
  currentUserBalanceLines: BalanceLine[];
  memberTotals: MemberTotals[];
};

type ExpenseMonthGroup = {
  key: string;
  label: string;
  expenses: ExpenseItem[];
};

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const toMoneyNumber = (value: number | undefined | null) => roundCurrency(Number(value || 0));

export const formatMoney = (value: number) => `$${toMoneyNumber(value).toFixed(2)}`;

export const getExpenseGroupDisplayName = (groupName: string, tripName?: string | null) => {
  const normalized = groupName.trim().toLowerCase();
  if (normalized === 'trip expenses' && tripName?.trim()) {
    return tripName.trim();
  }
  return groupName;
};

const buildMemberNameMap = (group: ExpenseGroup, crew: CrewMember[]) => {
  const names = new Map<string, string>();

  crew.forEach((member) => {
    if (member.id) {
      names.set(String(member.id), member.name || 'Crew member');
    }
  });

  group.expenses.forEach((expense) => {
    if (expense.paidByUserId) {
      names.set(String(expense.paidByUserId), expense.paidBy || names.get(String(expense.paidByUserId)) || 'Crew member');
    }
    expense.splitPreview.forEach((split) => {
      if (split.memberId) {
        names.set(String(split.memberId), split.memberName || names.get(String(split.memberId)) || 'Crew member');
      }
    });
  });

  return names;
};

const calculateNetByMember = (group: ExpenseGroup, crew: CrewMember[]) => {
  const memberNameMap = buildMemberNameMap(group, crew);
  const paidByMember = new Map<string, number>();
  const owedByMember = new Map<string, number>();

  memberNameMap.forEach((_, memberId) => {
    paidByMember.set(memberId, 0);
    owedByMember.set(memberId, 0);
  });

  group.expenses.forEach((expense) => {
    const payerId = expense.paidByUserId ? String(expense.paidByUserId) : '';
    if (payerId) {
      paidByMember.set(payerId, toMoneyNumber((paidByMember.get(payerId) || 0) + expense.amount));
      if (!memberNameMap.has(payerId)) {
        memberNameMap.set(payerId, expense.paidBy || 'Crew member');
      }
    }

    expense.splitPreview.forEach((split) => {
      const memberId = String(split.memberId);
      owedByMember.set(memberId, toMoneyNumber((owedByMember.get(memberId) || 0) + split.amount));
      if (!memberNameMap.has(memberId)) {
        memberNameMap.set(memberId, split.memberName || 'Crew member');
      }
    });
  });

  const memberTotals: MemberTotals[] = Array.from(memberNameMap.entries()).map(([memberId, memberName]) => {
    const paid = toMoneyNumber(paidByMember.get(memberId) || 0);
    const owed = toMoneyNumber(owedByMember.get(memberId) || 0);
    return {
      memberId,
      memberName,
      paid,
      owed,
      net: toMoneyNumber(paid - owed),
    };
  });

  return memberTotals.sort((first, second) => second.net - first.net || first.memberName.localeCompare(second.memberName));
};

const settleMemberBalances = (memberTotals: MemberTotals[]): BalanceLine[] => {
  const creditors = memberTotals
    .filter((member) => member.net > 0.009)
    .map((member) => ({ ...member, remaining: member.net }));
  const debtors = memberTotals
    .filter((member) => member.net < -0.009)
    .map((member) => ({ ...member, remaining: Math.abs(member.net) }));

  const lines: BalanceLine[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amount = toMoneyNumber(Math.min(creditor.remaining, debtor.remaining));

    if (amount > 0) {
      lines.push({
        fromMemberId: debtor.memberId,
        fromMemberName: debtor.memberName,
        toMemberId: creditor.memberId,
        toMemberName: creditor.memberName,
        amount,
      });
    }

    creditor.remaining = toMoneyNumber(creditor.remaining - amount);
    debtor.remaining = toMoneyNumber(debtor.remaining - amount);

    if (creditor.remaining <= 0.009) {
      creditorIndex += 1;
    }
    if (debtor.remaining <= 0.009) {
      debtorIndex += 1;
    }
  }

  return lines;
};

export const calculateExpenseGroupSummary = (
  group: ExpenseGroup,
  crew: CrewMember[],
  currentUserId?: number | string | null
): ExpenseGroupSummary => {
  const memberTotals = calculateNetByMember(group, crew);
  const balanceLines = settleMemberBalances(memberTotals);
  const currentUserKey = currentUserId != null ? String(currentUserId) : '';
  const currentUserBalanceLines = currentUserKey
    ? balanceLines.filter((line) => line.fromMemberId === currentUserKey || line.toMemberId === currentUserKey)
    : [];

  const currentUserOwes = currentUserBalanceLines
    .filter((line) => line.fromMemberId === currentUserKey)
    .reduce((sum, line) => sum + line.amount, 0);
  const currentUserIsOwed = currentUserBalanceLines
    .filter((line) => line.toMemberId === currentUserKey)
    .reduce((sum, line) => sum + line.amount, 0);

  return {
    totalSpent: toMoneyNumber(group.expenses.reduce((sum, expense) => sum + expense.amount, 0)),
    currentUserOwes: toMoneyNumber(currentUserOwes),
    currentUserIsOwed: toMoneyNumber(currentUserIsOwed),
    netBalance: toMoneyNumber(currentUserIsOwed - currentUserOwes),
    balanceLines,
    currentUserBalanceLines,
    memberTotals,
  };
};

export const calculateOverallExpenseSummary = (
  groups: ExpenseGroup[],
  crew: CrewMember[],
  currentUserId?: number | string | null
) => {
  const summary = groups.reduce(
    (accumulator, group) => {
      const groupSummary = calculateExpenseGroupSummary(group, crew, currentUserId);
      accumulator.totalSpent += groupSummary.totalSpent;
      accumulator.currentUserOwes += groupSummary.currentUserOwes;
      accumulator.currentUserIsOwed += groupSummary.currentUserIsOwed;
      return accumulator;
    },
    { totalSpent: 0, currentUserOwes: 0, currentUserIsOwed: 0 }
  );

  return {
    totalSpent: toMoneyNumber(summary.totalSpent),
    currentUserOwes: toMoneyNumber(summary.currentUserOwes),
    currentUserIsOwed: toMoneyNumber(summary.currentUserIsOwed),
    netBalance: toMoneyNumber(summary.currentUserIsOwed - summary.currentUserOwes),
  };
};

export const groupExpensesByMonth = (expenses: ExpenseItem[]): ExpenseMonthGroup[] => {
  const groups = new Map<string, ExpenseMonthGroup>();

  expenses.forEach((expense) => {
    const parsedDate = new Date(expense.createdAt);
    const safeDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
    const key = `${safeDate.getFullYear()}-${safeDate.getMonth()}`;
    const label = safeDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const existing = groups.get(key);
    if (existing) {
      existing.expenses.push(expense);
      return;
    }
    groups.set(key, {
      key,
      label,
      expenses: [expense],
    });
  });

  return Array.from(groups.values()).sort((first, second) => {
    const firstDate = new Date(first.expenses[0]?.createdAt || 0).getTime();
    const secondDate = new Date(second.expenses[0]?.createdAt || 0).getTime();
    return secondDate - firstDate;
  });
};

export const getExpenseImpactLabel = (
  expense: ExpenseItem,
  currentUserId?: number | string | null
) => {
  if (currentUserId == null) {
    return '';
  }
  const userKey = String(currentUserId);
  const userSplit = expense.splitPreview.find((split) => String(split.memberId) === userKey);
  const paidAmount = expense.paidByUserId != null && String(expense.paidByUserId) === userKey ? expense.amount : 0;
  const owedAmount = userSplit?.amount || 0;
  const net = toMoneyNumber(paidAmount - owedAmount);

  if (net > 0.009) {
    return `You paid ${formatMoney(net)} more than your share`;
  }
  if (net < -0.009) {
    return `Your share is ${formatMoney(Math.abs(net))}`;
  }
  if (owedAmount > 0) {
    return 'You are settled on this one';
  }
  return '';
};

export const buildEqualSplitPreview = (
  members: Array<{ id: string; name: string }>,
  selectedIds: string[],
  amount: number
): ExpenseSplit[] => {
  const activeMembers = members.filter((member) => selectedIds.includes(member.id));
  if (activeMembers.length === 0) {
    return [];
  }

  const totalCents = Math.round(toMoneyNumber(amount) * 100);
  const baseShare = Math.floor(totalCents / activeMembers.length);
  const remainder = totalCents - baseShare * activeMembers.length;

  return activeMembers.map((member, index) => ({
    memberId: member.id,
    memberName: member.name,
    amount: toMoneyNumber((baseShare + (index < remainder ? 1 : 0)) / 100),
  }));
};

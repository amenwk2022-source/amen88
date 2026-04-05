export type UserRole = 'admin' | 'lawyer' | 'staff' | 'client';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  civilId?: string;
  address?: string;
  poaNumber?: string;
}

export type CaseStatus = 'pre-filing' | 'active' | 'execution' | 'archive';

export interface Case {
  id: string;
  clientId: string;
  clientName?: string;
  caseNumber?: string;
  year?: string;
  court?: string;
  circuit?: string;
  autoNumber?: string;
  opponent?: string;
  caseType?: string;
  status: CaseStatus;
  lawyerId?: string;
  createdAt: string;
}

export interface Session {
  id: string;
  caseId: string;
  date: string;
  decision?: string;
  nextDate?: string;
  lawyerId?: string;
  notes?: string;
  caseInfo?: Partial<Case>;
}

export interface Procedure {
  id: string;
  caseId: string;
  type: string;
  staffId: string;
  date: string;
  notes?: string;
}

export interface Finance {
  id: string;
  caseId: string;
  totalFees: number;
  receivedAmount: number;
  expenses: number;
  sundries: number;
}

export interface Document {
  id: string;
  caseId: string;
  title: string;
  fileUrl: string;
  uploadDate: string;
}

export interface Judgment {
  id: string;
  caseId: string;
  date: string;
  type: 'initial' | 'appeal' | 'cassation';
  result: string;
  appealDeadline: string; // ISO date
  isAppealed: boolean;
  notes?: string;
}

export interface ExpertSession {
  id: string;
  caseId: string;
  date: string;
  expertName: string;
  officeLocation: string;
  status: 'pending' | 'attended' | 'postponed';
  notes?: string;
  caseInfo?: Partial<Case>;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'deadline' | 'session' | 'system';
  date: string;
  isRead: boolean;
  link?: string;
}

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

export type CaseStatus = 'pre-filing' | 'active' | 'execution' | 'archive' | 'judgment';

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
  tag?: string;
  clientPosition?: 'plaintiff' | 'defendant' | 'appellant' | 'appellee';
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
  appealStatus: 'pending' | 'appealed' | 'final';
  isAppealed: boolean;
  notes?: string;
}

export interface ExpertSession {
  id: string;
  caseId: string;
  date: string;
  time?: string;
  expertName: string;
  officeLocation: string;
  status: 'pending' | 'attended' | 'postponed' | 'reserved_for_report';
  notes?: string;
  nextDate?: string;
  decision?: string;
  isRelayed?: boolean;
  caseInfo?: Partial<Case>;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'deadline' | 'session' | 'system' | 'expert' | 'task' | 'note' | 'consultation';
  date: string;
  isRead: boolean;
  link?: string;
  relatedId?: string;
}

export interface UserNotificationSettings {
  id: string; // userId
  emailNotifications: boolean;
  browserNotifications: boolean;
  types: {
    deadline: boolean;
    session: boolean;
    expert: boolean;
    task: boolean;
    note: boolean;
    consultation: boolean;
  };
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  assignedTo: string; // User UID
  dueDate: string;
  status: 'pending' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  caseId?: string;
  createdAt: string;
}

export interface ConsultationRequest {
  id: string;
  clientId: string;
  clientName: string;
  subject: string;
  description: string;
  status: 'pending' | 'replied' | 'closed';
  date: string;
  reply?: string;
}

export interface SystemSettings {
  id: string;
  officeName: string;
  officeAddress: string;
  officePhone: string;
  officeEmail: string;
  currency: string;
  caseTypes: string[];
  courtNames: string[];
  logoUrl?: string;
}

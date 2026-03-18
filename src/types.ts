export interface Group {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  adminUid: string;
  defaultDuration: number;
  pullingMode: 'individual' | 'admin';
  createdAt: any;
  activeSessionId?: string;
}

export interface Member {
  uid: string;
  name: string;
  email: string;
  joinedAt: any;
}

export interface Session {
  id: string;
  status: 'active' | 'completed';
  totalNumbers: number;
  availableNumbers: number[];
  duration: number;
  expiresAt: any;
  createdAt: any;
}

export interface Ballot {
  id: string;
  memberUid: string;
  memberName: string;
  number: number;
  timestamp: any;
  voteCount: number;
}

export interface Invitation {
  id: string;
  email: string;
  invitedBy: string;
  groupId: string;
  groupName: string;
  createdAt: any;
}

export interface UserPreferences {
  uid: string;
  notifyOnSessionStart: boolean;
  notifyOnSessionEnd: boolean;
  theme: 'light' | 'dark';
}

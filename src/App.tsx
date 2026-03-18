import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  addDoc, 
  setDoc,
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  runTransaction,
  getDocs,
  getDoc,
  collectionGroup
} from 'firebase/firestore';
import { onAuthStateChanged, User, updateProfile } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Plus, 
  LogOut, 
  Trophy, 
  Settings, 
  UserPlus, 
  Trash2, 
  Play, 
  RefreshCw,
  ChevronRight,
  LayoutDashboard,
  Hash,
  CheckCircle2,
  AlertCircle,
  Mail,
  Check,
  X,
  Clock,
  History,
  ShieldCheck,
  Link,
  Copy,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Info,
  Edit3,
  Camera
} from 'lucide-react';
import { auth, db, signInWithGoogle, logOut } from './firebase';
import { Group, Member, Session, Ballot, Invitation, UserPreferences } from './types';
import { shuffle, generateNumbers } from './utils';
import { handleFirestoreError, OperationType } from './errorUtils';
import { setUserContext, clearUserContext } from './monitoring';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteId = params.get('invite');
    if (inviteId) {
      setActiveGroupId(inviteId);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        setUserContext({
          id: u.uid,
          email: u.email,
          name: u.displayName
        });
      } else {
        clearUserContext();
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'userPreferences', user.uid), (doc) => {
      if (doc.exists()) {
        setPrefs(doc.data() as UserPreferences);
      } else {
        setPrefs({
          uid: user.uid,
          notifyOnSessionStart: true,
          notifyOnSessionEnd: true,
          theme: 'light'
        });
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `userPreferences/${user.uid}`);
    });
    return unsub;
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <RefreshCw className="w-8 h-8 text-zinc-400 dark:text-zinc-600" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <div className={cn(
      "min-h-screen bg-zinc-50 text-zinc-900 font-sans transition-colors duration-300",
      prefs?.theme === 'dark' && "dark bg-zinc-950 text-zinc-100"
    )}>
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer" 
            onClick={() => setActiveGroupId(null)}
          >
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center text-white dark:bg-zinc-100 dark:text-zinc-900">
              <Hash className="w-5 h-5" />
            </div>
            <h1 className="font-bold text-xl tracking-tight text-zinc-900 dark:text-zinc-100">BallotBox</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{user.displayName}</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{user.email}</span>
            </div>
            <button 
              onClick={() => {
                setShowProfile(!showProfile);
                setActiveGroupId(null);
              }}
              className={cn(
                "p-2 rounded-full transition-colors",
                showProfile ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "hover:bg-zinc-100 text-zinc-500 dark:hover:bg-zinc-800 dark:text-zinc-400"
              )}
              title="User Profile"
            >
              {user.photoURL ? (
                <img src={user.photoURL} className="w-6 h-6 rounded-full" alt="Profile" referrerPolicy="no-referrer" />
              ) : (
                <Settings className="w-5 h-5" />
              )}
            </button>
            <button 
              onClick={logOut}
              className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-500 dark:hover:bg-zinc-800 dark:text-zinc-400"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {showProfile ? (
            <div key="profile">
              <ProfileView 
                user={user} 
                onBack={() => setShowProfile(false)} 
                prefs={prefs}
              />
            </div>
          ) : activeGroupId ? (
            <div key="group-detail">
              <GroupDetail 
                groupId={activeGroupId} 
                user={user} 
                onBack={() => setActiveGroupId(null)} 
              />
            </div>
          ) : (
            <div key="dashboard">
              <Dashboard 
                user={user} 
                onSelectGroup={setActiveGroupId} 
              />
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function ProfileView({ user, onBack, prefs: initialPrefs }: { user: User, onBack: () => void, prefs: UserPreferences | null }) {
  const [prefs, setPrefs] = useState<UserPreferences | null>(initialPrefs);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ groups: 0, sessions: 0 });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (initialPrefs) {
      setPrefs(initialPrefs);
    }
  }, [initialPrefs]);

  useEffect(() => {
    // Fetch stats
    const fetchStats = async () => {
      try {
        const groupsSnap = await getDocs(query(collection(db, 'groups'), where('adminUid', '==', user.uid)));
        const membersSnap = await getDocs(query(collectionGroup(db, 'members'), where('uid', '==', user.uid)));
        setStats({
          groups: groupsSnap.size + (membersSnap.size - groupsSnap.size),
          sessions: 0 // This would require a more complex query across all sessions
        });
      } catch (err) {
        console.error("Error fetching stats:", err);
      }
    };
    fetchStats();
  }, [user.uid]);

  const updatePref = async (key: keyof UserPreferences, value: any) => {
    if (!prefs) return;
    setSaving(true);
    try {
      const newPrefs = { ...prefs, [key]: value };
      await setDoc(doc(db, 'userPreferences', user.uid), newPrefs);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `userPreferences/${user.uid}`);
    } finally {
      setSaving(false);
    }
  };

  if (!prefs) return (
    <div className="flex items-center justify-center p-12">
      <RefreshCw className="w-8 h-8 text-zinc-300 animate-spin" />
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-2xl mx-auto"
    >
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-900 dark:text-zinc-100"
        >
          <ChevronRight className="w-5 h-5 rotate-180" />
        </button>
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">User Profile</h2>
      </div>

      <div className="space-y-6">
        <section className="bg-white border border-zinc-200 rounded-3xl p-8 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="relative group">
              {user.photoURL ? (
                <img src={user.photoURL} className="w-24 h-24 rounded-3xl object-cover shadow-lg group-hover:opacity-50 transition-opacity" alt="Profile" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-24 h-24 bg-zinc-900 rounded-3xl flex items-center justify-center text-white text-3xl font-bold dark:bg-zinc-800 dark:text-zinc-100 group-hover:opacity-50 transition-opacity">
                  {user.displayName?.charAt(0)}
                </div>
              )}
              <label className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                <Camera className="w-8 h-8 text-white drop-shadow-lg" />
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, (url) => {
                    updateProfile(auth.currentUser!, { photoURL: url });
                    // Also update preferences if needed, but photoURL is on the auth user
                  })}
                  className="hidden"
                />
              </label>
              <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-1.5 rounded-xl shadow-lg">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{user.displayName}</h3>
              <p className="text-zinc-500 mb-4 dark:text-zinc-400">{user.email}</p>
              <div className="flex flex-wrap justify-center md:justify-start gap-4">
                <div className="bg-zinc-50 px-4 py-2 rounded-2xl border border-zinc-100 dark:bg-zinc-800 dark:border-zinc-700">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest dark:text-zinc-500">Groups</p>
                  <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{stats.groups}</p>
                </div>
                <div className="bg-zinc-50 px-4 py-2 rounded-2xl border border-zinc-100 dark:bg-zinc-800 dark:border-zinc-700">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest dark:text-zinc-500">Account Type</p>
                  <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Standard</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white border border-zinc-200 rounded-3xl p-8 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
              <Settings className="w-5 h-5" />
              Notification Settings
            </h3>
            {saving && <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest animate-pulse">Saving...</span>}
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl dark:bg-zinc-800">
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">Session Started</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Get notified when a new balloting session begins.</p>
              </div>
              <button 
                onClick={() => updatePref('notifyOnSessionStart', !prefs.notifyOnSessionStart)}
                className={cn(
                  "w-12 h-6 rounded-full transition-all relative",
                  prefs.notifyOnSessionStart ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                  prefs.notifyOnSessionStart ? "left-7" : "left-1"
                )} />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl dark:bg-zinc-800">
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">Session Ended</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Get notified when a session expires or is completed.</p>
              </div>
              <button 
                onClick={() => updatePref('notifyOnSessionEnd', !prefs.notifyOnSessionEnd)}
                className={cn(
                  "w-12 h-6 rounded-full transition-all relative",
                  prefs.notifyOnSessionEnd ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                  prefs.notifyOnSessionEnd ? "left-7" : "left-1"
                )} />
              </button>
            </div>
          </div>
        </section>

        <section className="bg-white border border-zinc-200 rounded-3xl p-8 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
            <LayoutDashboard className="w-5 h-5" />
            Appearance
          </h3>
          
          <div className="flex gap-4">
            <button 
              onClick={() => updatePref('theme', 'light')}
              className={cn(
                "flex-1 p-4 rounded-2xl border-2 transition-all text-center",
                prefs.theme === 'light' ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900" : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600 text-zinc-900 dark:text-zinc-100"
              )}
            >
              <p className="font-bold">Light Mode</p>
            </button>
            <button 
              onClick={() => updatePref('theme', 'dark')}
              className={cn(
                "flex-1 p-4 rounded-2xl border-2 transition-all text-center",
                prefs.theme === 'dark' ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900" : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600 text-zinc-900 dark:text-zinc-100"
              )}
            >
              <p className="font-bold">Dark Mode</p>
            </button>
          </div>
        </section>

        <section className="bg-white border border-zinc-200 rounded-3xl p-8 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-red-600">
            <AlertCircle className="w-5 h-5" />
            Danger Zone
          </h3>
          <div className="p-6 bg-red-50 rounded-2xl border border-red-100 dark:bg-red-950/20 dark:border-red-900/30">
            <h4 className="font-bold text-red-900 mb-1 dark:text-red-400">Delete Account</h4>
            <p className="text-sm text-red-700 mb-4 dark:text-red-500/80">Once you delete your account, there is no going back. Please be certain.</p>
            
            {showDeleteConfirm ? (
              <div className="space-y-4">
                <p className="text-sm font-bold text-red-600 dark:text-red-400">Are you absolutely sure? This cannot be undone.</p>
                {deleteError && <p className="text-xs text-red-500 bg-white p-2 rounded-lg border border-red-200 dark:bg-zinc-900 dark:border-red-900/50">{deleteError}</p>}
                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      user.delete().catch(err => {
                        console.error("Error deleting account:", err);
                        setDeleteError("To delete your account, you must have recently signed in. Please sign out and sign back in, then try again.");
                      });
                    }}
                    className="flex-1 px-6 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors"
                  >
                    Yes, Delete
                  </button>
                  <button 
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteError(null);
                    }}
                    className="flex-1 px-6 py-2 bg-white text-zinc-900 border border-zinc-200 rounded-xl font-bold hover:bg-zinc-50 transition-colors dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setShowDeleteConfirm(true)}
                className="px-6 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors"
              >
                Delete My Account
              </button>
            )}
          </div>
        </section>

        <div className="flex justify-center pt-4">
          <button 
            onClick={logOut}
            className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 font-medium transition-colors dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <LogOut className="w-5 h-5" />
            Sign Out of BallotBox
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function LoginView() {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (err.code !== 'auth/cancelled-popup-request' && err.code !== 'auth/popup-closed-by-user') {
        console.error("Login error:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen vibrant-bg flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-[3rem] p-12 shadow-2xl text-center border border-white/20 relative z-10"
      >
        <div className="w-24 h-24 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[2rem] flex items-center justify-center text-white mx-auto mb-8 shadow-xl shadow-indigo-500/20 animate-float">
          <Hash className="w-12 h-12" />
        </div>
        <h2 className="text-4xl font-black tracking-tight mb-3 text-zinc-900 dark:text-white gradient-text">BallotBox</h2>
        <p className="text-zinc-500 dark:text-zinc-400 mb-10 font-medium leading-relaxed">
          The most colorful way to handle group numbering. Fair, transparent, and real-time.
        </p>
        
        <button 
          onClick={handleLogin}
          disabled={loading}
          className="btn-primary w-full py-5 text-lg flex items-center justify-center gap-3 shadow-xl shadow-indigo-500/30"
        >
          {loading ? (
            <RefreshCw className="w-6 h-6 animate-spin" />
          ) : (
            <>
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
              Continue with Google
            </>
          )}
        </button>
        
        <div className="mt-10 pt-8 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-center gap-6">
          <div className="text-center">
            <p className="text-xl font-black text-zinc-900 dark:text-white">100%</p>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Fair</p>
          </div>
          <div className="w-px h-8 bg-zinc-100 dark:bg-zinc-800" />
          <div className="text-center">
            <p className="text-xl font-black text-zinc-900 dark:text-white">Live</p>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Sync</p>
          </div>
          <div className="w-px h-8 bg-zinc-100 dark:bg-zinc-800" />
          <div className="text-center">
            <p className="text-xl font-black text-zinc-900 dark:text-white">Free</p>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Forever</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Helper for image uploads
const handleImageUpload = (e: ChangeEvent<HTMLInputElement>, onComplete: (url: string) => void) => {
  const file = e.target.files?.[0];
  if (!file) return;

  if (file.size > 1024 * 1024) { // 1MB limit
    return;
  }

  // In a real app, we'd upload to Firebase Storage
  // For now, we'll use a FileReader to get a base64 string
  const reader = new FileReader();
  reader.onloadend = () => {
    onComplete(reader.result as string);
  };
  reader.readAsDataURL(file);
};

function CountdownTimer({ expiresAt, onExpire }: { expiresAt: any, onExpire: () => void }) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const expirationTime = expiresAt?.toDate?.()?.getTime() || new Date(expiresAt).getTime();
      const difference = expirationTime - Date.now();
      return Math.max(0, difference);
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        onExpire();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt, onExpire]);

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);

  return (
    <div className={cn(
      "flex items-center gap-2 px-5 py-2.5 rounded-2xl font-mono font-black text-xl shadow-sm border-2",
      timeLeft < 60000 
        ? "bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/40 animate-pulse" 
        : "bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-900/40"
    )}>
      <Clock className={cn("w-5 h-5", timeLeft < 60000 ? "animate-pulse" : "animate-pulse")} />
      {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
    </div>
  );
}

function Dashboard({ user, onSelectGroup }: { user: User, onSelectGroup: (id: string) => void }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'groups'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const g = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
      setGroups(g);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'groups');
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user.email) return;
    const q = query(collection(db, 'invitations'), where('email', '==', user.email));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const invs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invitation));
      setInvitations(invs);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'invitations');
    });
    return unsubscribe;
  }, [user.email]);

  const handleCreateGroup = async (e: FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    try {
      const docRef = await addDoc(collection(db, 'groups'), {
        name: newGroupName,
        description: newGroupDescription,
        adminUid: user.uid,
        defaultDuration: 10,
        pullingMode: 'individual',
        createdAt: serverTimestamp()
      });
      
      await setDoc(doc(db, `groups/${docRef.id}/members`, user.uid), {
        uid: user.uid,
        name: user.displayName,
        email: user.email,
        joinedAt: serverTimestamp()
      });

      setNewGroupName('');
      setNewGroupDescription('');
      setIsCreating(false);
      onSelectGroup(docRef.id);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'groups');
    }
  };

  const acceptInvitation = async (invitation: Invitation) => {
    try {
      await setDoc(doc(db, `groups/${invitation.groupId}/members`, user.uid), {
        uid: user.uid,
        name: user.displayName,
        email: user.email,
        joinedAt: serverTimestamp()
      });
      await deleteDoc(doc(db, 'invitations', invitation.id));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `groups/${invitation.groupId}/members`);
    }
  };

  const declineInvitation = async (invitationId: string) => {
    try {
      await deleteDoc(doc(db, 'invitations', invitationId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `invitations/${invitationId}`);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {invitations.length > 0 && (
        <div className="mb-8 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2 dark:text-zinc-500">
            <Mail className="w-4 h-4" />
            Pending Invitations
          </h3>
          {invitations.map(inv => (
            <motion.div 
              key={inv.id}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="bg-zinc-900 text-white p-4 rounded-2xl flex items-center justify-between shadow-lg dark:bg-zinc-800"
            >
              <div>
                <p className="font-bold">Invite to join "{inv.groupName}"</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">Sent by another member</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => acceptInvitation(inv)}
                  className="bg-emerald-500 hover:bg-emerald-600 p-2 rounded-xl transition-colors"
                >
                  <Check className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => declineInvitation(inv.id)}
                  className="bg-zinc-800 hover:bg-zinc-700 p-2 rounded-xl transition-colors dark:bg-zinc-700 dark:hover:bg-zinc-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-16 p-10 bg-gradient-to-br from-indigo-600/10 to-purple-600/10 rounded-[3rem] border border-white/20 shadow-inner relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-3xl rounded-full -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 blur-3xl rounded-full -ml-32 -mb-32" />
        
        <div className="relative z-10 text-center md:text-left">
          <h2 className="text-5xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 gradient-text mb-2">Your Groups</h2>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium text-lg">Manage or join balloting groups with ease.</p>
        </div>
        
        <button 
          onClick={() => setIsCreating(true)}
          className="btn-primary flex items-center gap-3 px-8 py-4 text-lg shadow-xl shadow-indigo-500/20 relative z-10"
        >
          <Plus className="w-6 h-6" />
          Create New Group
        </button>
      </div>

      {isCreating && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card mb-12 bg-indigo-50/30 dark:bg-indigo-500/5 border-indigo-500/20"
        >
          <form onSubmit={handleCreateGroup} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 px-1">Group Name</label>
                <input 
                  autoFocus
                  type="text" 
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g., Friday Football Team"
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 px-1">Description (Optional)</label>
                <input 
                  type="text" 
                  value={newGroupDescription}
                  onChange={(e) => setNewGroupDescription(e.target.value)}
                  placeholder="What is this group for?"
                  className="input-field"
                />
              </div>
            </div>
            <div className="flex gap-4 justify-end">
              <button 
                type="button"
                onClick={() => setIsCreating(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="btn-primary"
              >
                Create Group
              </button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {groups.map((group) => (
          <motion.div 
            key={group.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -8, scale: 1.02 }}
            onClick={() => onSelectGroup(group.id)}
            className="card group cursor-pointer hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
            
            <div className="flex items-center gap-5 mb-6">
              <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-900 dark:text-zinc-100 overflow-hidden border-2 border-white dark:border-zinc-700 shadow-md group-hover:scale-110 transition-transform duration-500">
                {group.avatarUrl ? (
                  <img src={group.avatarUrl} alt={group.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <Users className="w-8 h-8 text-indigo-500" />
                )}
              </div>
              <div>
                <h4 className="text-xl font-black text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{group.name}</h4>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {group.pullingMode === 'admin' ? 'Admin Pull' : 'Individual Pull'}
                </p>
              </div>
            </div>
            
            <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-6 font-medium leading-relaxed">
              {group.description || "No description provided for this group."}
            </p>
            
            <div className="flex items-center justify-between pt-6 border-t border-zinc-50 dark:border-zinc-800">
              <div className="flex -space-x-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[10px] font-bold text-zinc-400">
                    {i}
                  </div>
                ))}
                <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                  +
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Admin</p>
                <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{group.adminUid === user.uid ? 'You' : 'Member'}</p>
              </div>
            </div>
          </motion.div>
        ))}
        
        {groups.length === 0 && !isCreating && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="col-span-full py-24 text-center border-2 border-dashed border-zinc-200 rounded-[2.5rem] bg-white/50 dark:bg-zinc-900/50 dark:border-zinc-800"
          >
            <div className="w-20 h-20 bg-zinc-100 rounded-3xl flex items-center justify-center text-zinc-300 mx-auto mb-6 dark:bg-zinc-800 dark:text-zinc-700">
              <LayoutDashboard className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold text-zinc-900 mb-2 dark:text-white">No groups yet</h3>
            <p className="text-zinc-500 max-w-sm mx-auto mb-8 dark:text-zinc-400">
              Create your first group to start organizing fair and transparent balloting sessions with your friends or colleagues.
            </p>
            <button 
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center gap-2 bg-zinc-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-zinc-800 transition-all active:scale-95 shadow-lg shadow-zinc-900/10 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            >
              <Plus className="w-5 h-5" />
              Create Your First Group
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

function GroupDetail({ groupId, user, onBack }: { groupId: string, user: User, onBack: () => void }) {
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [ballots, setBallots] = useState<Ballot[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(10);
  const [customDuration, setCustomDuration] = useState('');
  const [pastSessions, setPastSessions] = useState<Session[]>([]);
  const [isBallotsLoading, setIsBallotsLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'start' | 'reset' | null>(null);
  const [showGroupProfile, setShowGroupProfile] = useState(false);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [editingGroupDescription, setEditingGroupDescription] = useState('');
  const [editingGroupAvatar, setEditingGroupAvatar] = useState('');
  const [isUpdatingGroup, setIsUpdatingGroup] = useState(false);
  const [editingPullingMode, setEditingPullingMode] = useState<'individual' | 'admin'>('individual');

  useEffect(() => {
    const unsubGroup = onSnapshot(doc(db, 'groups', groupId), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as Group;
        setGroup({ id: doc.id, ...data } as Group);
        setEditingPullingMode(data.pullingMode || 'individual');
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `groups/${groupId}`);
    });

    const unsubMembers = onSnapshot(collection(db, `groups/${groupId}/members`), (snapshot) => {
      const m = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any as Member));
      setMembers(m);
      setIsMember(m.some(member => member.uid === user.uid));
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `groups/${groupId}/members`);
    });

    return () => {
      unsubGroup();
      unsubMembers();
    };
  }, [groupId, user.uid]);

  useEffect(() => {
    if (group?.activeSessionId && (isMember || group.adminUid === user.uid)) {
      const unsubSession = onSnapshot(doc(db, `groups/${groupId}/sessions`, group.activeSessionId), (doc) => {
        if (doc.exists()) setSession({ id: doc.id, ...doc.data() } as Session);
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, `groups/${groupId}/sessions/${group.activeSessionId}`);
      });
      
      const unsubBallots = onSnapshot(collection(db, `groups/${groupId}/sessions/${group.activeSessionId}/ballots`), (snapshot) => {
        const b = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ballot));
        setBallots(b.sort((x, y) => x.number - y.number));
        setIsBallotsLoading(false);
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, `groups/${groupId}/sessions/${group.activeSessionId}/ballots`);
        setIsBallotsLoading(false);
      });

      // Periodic polling as a fallback/extra check for status changes
      const pollInterval = setInterval(async () => {
        try {
          const docRef = doc(db, `groups/${groupId}/sessions`, group.activeSessionId!);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = { id: docSnap.id, ...docSnap.data() } as Session;
            setSession(prev => {
              if (prev?.status !== data.status) return data;
              return prev;
            });
          }
        } catch (err) {
          console.error("Session poll error:", err);
        }
      }, 5000);

      return () => {
        unsubSession();
        unsubBallots();
        clearInterval(pollInterval);
      };
    } else {
      setSession(null);
      setBallots([]);
      setIsBallotsLoading(false);
    }
  }, [group?.activeSessionId, groupId, isMember, group?.adminUid, user.uid]);

  useEffect(() => {
    if (!isMember && group?.adminUid !== user.uid) {
      setPastSessions([]);
      setIsHistoryLoading(false);
      return;
    }
    const q = query(
      collection(db, `groups/${groupId}/sessions`),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const s = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
      setPastSessions(s);
      setIsHistoryLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `groups/${groupId}/sessions`);
      setIsHistoryLoading(false);
    });
    return unsubscribe;
  }, [groupId, isMember, group?.adminUid, user.uid]);

  useEffect(() => {
    if (group?.defaultDuration) {
      setSelectedDuration(group.defaultDuration);
    }
  }, [group?.id, group?.defaultDuration]);

  useEffect(() => {
    if (session?.status === 'active' && session.expiresAt) {
      const expirationTime = session.expiresAt?.toDate?.()?.getTime() || new Date(session.expiresAt).getTime();
      
      const checkExpiration = () => {
        if (Date.now() >= expirationTime) {
          completeSession();
          return true;
        }
        return false;
      };

      // Initial check
      if (checkExpiration()) return;

      const interval = setInterval(() => {
        if (checkExpiration()) {
          clearInterval(interval);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [session?.id, session?.status, session?.expiresAt]);

  useEffect(() => {
    if (group?.name) {
      setEditingGroupName(group.name);
      setEditingGroupDescription(group.description || '');
      setEditingGroupAvatar(group.avatarUrl || '');
    }
  }, [group?.name, group?.description, group?.avatarUrl]);

  const updateGroupProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!group || !editingGroupName.trim()) return;
    setIsUpdatingGroup(true);
    try {
      await updateDoc(doc(db, 'groups', groupId), {
        name: editingGroupName.trim(),
        description: editingGroupDescription.trim(),
        avatarUrl: editingGroupAvatar.trim(),
        pullingMode: editingPullingMode
      });
      setShowGroupProfile(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `groups/${groupId}`);
    } finally {
      setIsUpdatingGroup(false);
    }
  };

  const vote = async (ballotId: string, direction: 'up' | 'down') => {
    if (!group || !session || !isMember) return;
    
    try {
      await runTransaction(db, async (transaction) => {
        const ballotRef = doc(db, `groups/${groupId}/sessions/${session.id}/ballots`, ballotId);
        const ballotDoc = await transaction.get(ballotRef);
        if (!ballotDoc.exists()) throw new Error("Ballot not found");
        
        const voteRef = doc(db, `groups/${groupId}/sessions/${session.id}/ballots/${ballotId}/votes`, user.uid);
        const voteDoc = await transaction.get(voteRef);
        
        const currentVoteCount = ballotDoc.data().voteCount || 0;
        let newVoteCount = currentVoteCount;
        
        if (voteDoc.exists()) {
          const oldVote = voteDoc.data().direction;
          if (oldVote === direction) {
            // Remove vote
            newVoteCount = direction === 'up' ? currentVoteCount - 1 : currentVoteCount + 1;
            transaction.delete(voteRef);
          } else {
            // Change vote
            newVoteCount = direction === 'up' ? currentVoteCount + 2 : currentVoteCount - 2;
            transaction.update(voteRef, { direction });
          }
        } else {
          // New vote
          newVoteCount = direction === 'up' ? currentVoteCount + 1 : currentVoteCount - 1;
          transaction.set(voteRef, { direction, timestamp: serverTimestamp() });
        }
        
        transaction.update(ballotRef, { voteCount: newVoteCount });
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `groups/${groupId}/sessions/${session.id}/ballots/${ballotId}/votes`);
    }
  };

  const completeSession = async () => {
    if (!session || session.status === 'completed') return;
    try {
      await updateDoc(doc(db, `groups/${groupId}/sessions`, session.id), {
        status: 'completed'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `groups/${groupId}/sessions/${session.id}`);
    }
  };

  const joinGroup = async () => {
    try {
      await setDoc(doc(db, `groups/${groupId}/members`, user.uid), {
        uid: user.uid,
        name: user.displayName,
        email: user.email,
        joinedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `groups/${groupId}/members/${user.uid}`);
    }
  };

  const startSession = async () => {
    if (!group) return;
    const total = members.length;
    if (total === 0) return; // In a real app, show a toast or inline error

    const shuffled = shuffle(generateNumbers(total));
    const expiresAt = new Date(Date.now() + selectedDuration * 60000);
    
    try {
      const sessionRef = await addDoc(collection(db, `groups/${groupId}/sessions`), {
        status: 'active',
        totalNumbers: total,
        availableNumbers: shuffled,
        duration: selectedDuration,
        expiresAt: expiresAt,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'groups', groupId), {
        activeSessionId: sessionRef.id
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `groups/${groupId}/sessions`);
    }
  };

  const resetSession = async () => {
    if (!group) return;
    try {
      await updateDoc(doc(db, 'groups', groupId), {
        activeSessionId: null
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `groups/${groupId}`);
    }
  };

  const pullNumber = async () => {
    if (!group || !session || !isMember) return;
    if (ballots.some(b => b.memberUid === user.uid)) return;

    setIsPulling(true);
    try {
      await runTransaction(db, async (transaction) => {
        const sessionDoc = await transaction.get(doc(db, `groups/${groupId}/sessions`, session.id));
        if (!sessionDoc.exists()) throw new Error("Session not found");
        
        const data = sessionDoc.data() as Session;
        if (data.availableNumbers.length === 0) throw new Error("No numbers left");

        const newAvailable = [...data.availableNumbers];
        const pulledNumber = newAvailable.pop();

        transaction.update(doc(db, `groups/${groupId}/sessions`, session.id), {
          availableNumbers: newAvailable
        });

        const ballotRef = doc(collection(db, `groups/${groupId}/sessions/${session.id}/ballots`));
        transaction.set(ballotRef, {
          memberUid: user.uid,
          memberName: user.displayName || 'Anonymous',
          number: pulledNumber,
          timestamp: serverTimestamp(),
          voteCount: 0
        });
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `groups/${groupId}/sessions/${session.id}/ballots`);
    } finally {
      setIsPulling(false);
    }
  };

  const generateAllNumbers = async () => {
    if (!group || !session || !isAdmin) return;
    setIsPulling(true);
    try {
      await runTransaction(db, async (transaction) => {
        const sessionDoc = await transaction.get(doc(db, `groups/${groupId}/sessions`, session.id));
        if (!sessionDoc.exists()) throw new Error("Session not found");
        
        const data = sessionDoc.data() as Session;
        const available = [...data.availableNumbers];
        
        // Find members who don't have a ballot yet
        const existingBallotsSnap = await getDocs(collection(db, `groups/${groupId}/sessions/${session.id}/ballots`));
        const membersWithBallots = new Set(existingBallotsSnap.docs.map(d => d.data().memberUid));
        
        const membersToPull = members.filter(m => !membersWithBallots.has(m.uid));
        
        if (membersToPull.length > available.length) throw new Error("Not enough numbers");

        for (const member of membersToPull) {
          const pulledNumber = available.pop();
          const ballotRef = doc(collection(db, `groups/${groupId}/sessions/${session.id}/ballots`));
          transaction.set(ballotRef, {
            memberUid: member.uid,
            memberName: member.name || 'Anonymous',
            number: pulledNumber,
            timestamp: serverTimestamp(),
            voteCount: 0
          });
        }

        transaction.update(doc(db, `groups/${groupId}/sessions`, session.id), {
          availableNumbers: available
        });
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `groups/${groupId}/sessions/${session.id}/ballots`);
    } finally {
      setIsPulling(false);
    }
  };

  const handleAvatarUpload = (e: ChangeEvent<HTMLInputElement>, setAvatar: (val: string) => void) => {
    handleImageUpload(e, setAvatar);
  };

  const sendInvitation = async (e: FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !group) return;
    
    setIsInviting(true);
    try {
      await addDoc(collection(db, 'invitations'), {
        email: inviteEmail.trim().toLowerCase(),
        invitedBy: user.uid,
        groupId: groupId,
        groupName: group.name,
        createdAt: serverTimestamp()
      });
      setInviteEmail('');
      // Using a simple state for feedback would be better, but for now let's just avoid alert()
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'invitations');
    } finally {
      setIsInviting(false);
    }
  };

  const removeMember = async (memberUid: string) => {
    try {
      await deleteDoc(doc(db, `groups/${groupId}/members`, memberUid));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `groups/${groupId}/members/${memberUid}`);
    }
  };

  const updateDefaultDuration = async (duration: number) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'groups', groupId), {
        defaultDuration: duration
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `groups/${groupId}`);
    }
  };

  const copyInviteLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?invite=${groupId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isAdmin = group?.adminUid === user.uid;
  const userBallot = ballots.find(b => b.memberUid === user.uid);

  if (!group) return null;

  if (!isMember && !isAdmin) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto py-20 text-center"
      >
        <div className="w-24 h-24 bg-zinc-100 dark:bg-zinc-800 rounded-[2.5rem] flex items-center justify-center text-zinc-300 dark:text-zinc-600 mx-auto mb-8">
          <ShieldCheck className="w-12 h-12" />
        </div>
        <h2 className="text-4xl font-black text-zinc-900 dark:text-zinc-100 mb-4 tracking-tight">Private Group</h2>
        <p className="text-zinc-500 dark:text-zinc-400 text-lg mb-10 max-w-md mx-auto">
          This group is restricted to members only. Join the group to participate in balloting sessions and view the public ledger.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button 
            onClick={onBack}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
          >
            Back to Dashboard
          </button>
          <button 
            onClick={joinGroup}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-10 py-4 rounded-2xl font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all active:scale-95 shadow-xl shadow-zinc-900/20"
          >
            <UserPlus className="w-5 h-5" />
            Join Group Now
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <button 
            onClick={onBack}
            className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1 mb-2 transition-colors"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            Back to Dashboard
          </button>
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-[2rem] flex items-center justify-center text-zinc-900 dark:text-zinc-100 overflow-hidden border-4 border-white dark:border-zinc-900 shadow-xl animate-float">
              {group.avatarUrl ? (
                <img src={group.avatarUrl} alt={group.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <Users className="w-10 h-10 text-indigo-500" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 gradient-text">{group.name}</h2>
                {isAdmin && (
                  <button 
                    onClick={() => setShowGroupProfile(true)}
                    className="p-2.5 text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-2xl transition-all"
                    title="Edit Group Profile"
                  >
                    <Edit3 className="w-5 h-5" />
                  </button>
                )}
              </div>
              <p className="text-zinc-500 dark:text-zinc-400 font-medium mt-1">
                {group.description || `${members.length} members • Created by ${isAdmin ? 'you' : 'Admin'}`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {!isMember && (
            <button 
              onClick={joinGroup}
              className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2 rounded-xl font-medium flex items-center gap-2 hover:bg-zinc-800 dark:hover:bg-zinc-200"
            >
              <UserPlus className="w-4 h-4" />
              Join Group
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Active Session Card */}
          <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm overflow-hidden relative">
            {!session ? (
              <div className="text-center py-20">
                <div className="w-20 h-20 bg-zinc-50 dark:bg-zinc-800 rounded-[2rem] flex items-center justify-center text-zinc-300 dark:text-zinc-600 mx-auto mb-6">
                  <Hash className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-zinc-900 dark:text-zinc-100">No Active Session</h3>
                <p className="text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mb-10">
                  {isAdmin 
                    ? "You haven't started a balloting session yet. Use the Admin Controls in the sidebar to start a new session." 
                    : "The group admin hasn't started a balloting session yet. You'll be notified here as soon as the session begins."}
                </p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md mb-2 inline-block",
                      session.status === 'active' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    )}>
                      Session {session.status}
                    </span>
                    <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                      {session.status === 'active' ? 'Pick Your Number' : 'Session Results'}
                    </h3>
                  </div>
                  <div className="flex items-center gap-4">
                    {session.status === 'active' && (
                      <CountdownTimer 
                        expiresAt={session.expiresAt} 
                        onExpire={completeSession} 
                      />
                    )}
                    <div className="text-right">
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">Remaining</p>
                      <p className="text-2xl font-mono font-bold text-zinc-900 dark:text-zinc-100">{session.availableNumbers.length}/{session.totalNumbers}</p>
                    </div>
                  </div>
                </div>

                {session.status === 'completed' ? (
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-emerald-50 dark:bg-emerald-900/10 rounded-3xl p-10 text-center border border-emerald-100 dark:border-emerald-800/30 relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-500" />
                    <div className="flex justify-center items-center gap-3 mb-6">
                      <motion.div
                        animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                      >
                        <Sparkles className="w-8 h-8 text-emerald-500" />
                      </motion.div>
                      <Trophy className="w-16 h-16 text-emerald-600 dark:text-emerald-400" />
                      <motion.div
                        animate={{ rotate: [0, 10, -10, 10, 0], scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
                      >
                        <Sparkles className="w-8 h-8 text-emerald-500" />
                      </motion.div>
                    </div>
                    <h4 className="text-3xl font-black mb-3 text-emerald-900 dark:text-emerald-100 tracking-tight">
                      Session Completed!
                    </h4>
                    <p className="text-emerald-700 dark:text-emerald-400 font-medium text-lg">
                      The balloting window has closed successfully.
                    </p>
                    <div className="mt-6 flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-500 text-sm font-bold uppercase tracking-widest">
                      <CheckCircle2 className="w-4 h-4" />
                      Results Finalized
                    </div>
                  </motion.div>
                ) : userBallot ? (
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="p-10 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[3rem] text-white text-center shadow-2xl shadow-indigo-500/30 relative overflow-hidden group"
                  >
                    <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
                    <div className="relative z-10">
                      <p className="text-indigo-100 font-bold uppercase tracking-widest text-xs mb-4">Your Pulled Number</p>
                      <div className="text-9xl font-black mb-6 drop-shadow-2xl group-hover:scale-110 transition-transform duration-500">{userBallot.number}</div>
                      <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-6 py-3 rounded-2xl font-bold text-sm">
                        <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                        Successfully assigned to you
                      </div>
                    </div>
                  </motion.div>
                ) : isMember ? (
                  <div className="flex flex-col items-center py-12">
                    {group.pullingMode === 'admin' ? (
                      isAdmin ? (
                        <div className="text-center space-y-6">
                          <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-3xl flex items-center justify-center text-indigo-600 mx-auto animate-bounce">
                            <Sparkles className="w-10 h-10" />
                          </div>
                          <div>
                            <h4 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 mb-2">Ready to distribute?</h4>
                            <p className="text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto">As admin, you can generate and assign numbers for all members with a single click.</p>
                          </div>
                          <button 
                            onClick={generateAllNumbers}
                            disabled={isPulling || session.availableNumbers.length === 0}
                            className="btn-primary px-12 py-5 text-xl flex items-center gap-3 mx-auto"
                          >
                            {isPulling ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
                            Generate All Numbers
                          </button>
                        </div>
                      ) : (
                        <div className="text-center py-12 bg-zinc-50 dark:bg-zinc-800/50 rounded-[2.5rem] border border-dashed border-zinc-200 dark:border-zinc-700 w-full">
                          <Clock className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
                          <h4 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Waiting for Admin</h4>
                          <p className="text-zinc-500 dark:text-zinc-400">The administrator will generate and assign numbers for everyone shortly.</p>
                        </div>
                      )
                    ) : (
                      <button 
                        onClick={pullNumber}
                        disabled={isPulling || session.availableNumbers.length === 0}
                        className="w-64 h-64 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-black text-3xl shadow-2xl hover:scale-105 active:scale-95 transition-all flex flex-col items-center justify-center gap-2 group relative overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative z-10 flex flex-col items-center">
                          {isPulling ? (
                            <RefreshCw className="w-12 h-12 animate-spin" />
                          ) : (
                            <>
                              <span className="text-sm font-bold tracking-[0.3em] text-indigo-400 group-hover:text-white transition-colors">TAP TO</span>
                              <span>PULL</span>
                            </>
                          )}
                        </div>
                      </button>
                    )}
                    {session.availableNumbers.length === 0 && (
                      <p className="mt-8 text-amber-600 dark:text-amber-500 flex items-center justify-center gap-2 font-bold">
                        <AlertCircle className="w-5 h-5" />
                        All numbers have been taken.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-8 text-center border border-zinc-200 dark:border-zinc-800">
                    <p className="text-zinc-500 dark:text-zinc-400 mb-4">You must be a member to participate in the ballot.</p>
                    <button onClick={joinGroup} className="text-zinc-900 dark:text-zinc-100 font-bold underline">Join Group Now</button>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Public Ledger */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Public Ledger</h3>
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-widest">Real-time Sync</span>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
              <div className="grid grid-cols-12 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                <div className="col-span-1">#</div>
                <div className="col-span-7">Member Name</div>
                <div className="col-span-4 text-right">Assigned Number</div>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {isBallotsLoading ? (
                  <div className="px-6 py-20 text-center flex flex-col items-center justify-center gap-3">
                    <RefreshCw className="w-8 h-8 text-zinc-200 dark:text-zinc-700 animate-spin" />
                    <p className="text-zinc-400 text-sm font-medium">Syncing ledger...</p>
                  </div>
                ) : ballots.length === 0 ? (
                  <div className="px-6 py-20 text-center">
                    <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-200 dark:text-zinc-700 mx-auto mb-4">
                      <Trophy className="w-6 h-6" />
                    </div>
                    <p className="text-zinc-400 font-medium italic">No ballots have been pulled yet.</p>
                    <p className="text-zinc-400 text-xs mt-1">Results will appear here in real-time as members participate.</p>
                  </div>
                ) : (
                  ballots.map((ballot, idx) => (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={ballot.id} 
                      className="grid grid-cols-12 px-6 py-4 items-center hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <div className="col-span-1 text-zinc-400 dark:text-zinc-500 font-mono text-xs">{idx + 1}</div>
                      <div className="col-span-6 font-medium flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                        {ballot.memberName}
                        {ballot.memberUid === user.uid && (
                          <span className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[8px] px-1.5 py-0.5 rounded uppercase">You</span>
                        )}
                      </div>
                      <div className="col-span-3 flex items-center justify-end gap-3 px-2">
                        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg">
                          <button 
                            onClick={() => vote(ballot.id, 'up')}
                            disabled={!isMember || session?.status !== 'active'}
                            className="p-1 text-zinc-400 hover:text-emerald-500 dark:hover:text-emerald-400 disabled:opacity-30 transition-colors"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>
                          <span className={cn(
                            "text-xs font-bold min-w-[1.5rem] text-center",
                            (ballot.voteCount || 0) > 0 ? "text-emerald-600 dark:text-emerald-400" : (ballot.voteCount || 0) < 0 ? "text-red-600 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400"
                          )}>
                            {ballot.voteCount || 0}
                          </span>
                          <button 
                            onClick={() => vote(ballot.id, 'down')}
                            disabled={!isMember || session?.status !== 'active'}
                            className="p-1 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-30 transition-colors"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="inline-block w-8 h-8 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-center leading-8 font-bold text-zinc-900 dark:text-zinc-100">
                          {ballot.number}
                        </span>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* Session History */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Session History</h3>
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-widest">Past Events</span>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {isHistoryLoading ? (
                  <div className="px-6 py-12 text-center flex flex-col items-center justify-center gap-3">
                    <RefreshCw className="w-6 h-6 text-zinc-200 dark:text-zinc-700 animate-spin" />
                    <p className="text-zinc-400 text-xs font-medium">Loading history...</p>
                  </div>
                ) : pastSessions.filter(s => s.id !== group.activeSessionId).length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-200 dark:text-zinc-700 mx-auto mb-4">
                      <History className="w-6 h-6" />
                    </div>
                    <p className="text-zinc-400 font-medium italic">No past sessions recorded.</p>
                  </div>
                ) : (
                  pastSessions.filter(s => s.id !== group.activeSessionId).map((s) => (
                    <div key={s.id} className="px-6 py-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-900 dark:text-zinc-100">
                          <Clock className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-zinc-900 dark:text-zinc-100">{s.totalNumbers} Numbers • {s.duration}m</p>
                          <p className="text-xs text-zinc-400 dark:text-zinc-500">
                            {s.createdAt?.toDate?.()?.toLocaleString() || 'Recently'}
                          </p>
                        </div>
                      </div>
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md",
                        s.status === 'completed' ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      )}>
                        {s.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {isAdmin && (
            <section className="bg-zinc-900 text-white rounded-3xl p-6 shadow-xl border border-zinc-800">
              <div className="flex items-center gap-2 mb-6 text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
                <h3 className="font-bold uppercase tracking-widest text-xs">Admin Controls</h3>
              </div>
              
              <div className="space-y-8">
                {/* Session Management */}
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Session Management</label>
                  {!session ? (
                    <div className="space-y-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-1">
                          {[5, 10, 15, 30].map(d => (
                            <button
                              key={d}
                              onClick={() => {
                                setSelectedDuration(d);
                                setCustomDuration('');
                              }}
                              title={`Select ${d} minutes for the next session`}
                              className={cn(
                                "flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                                selectedDuration === d && !customDuration
                                  ? "bg-white text-zinc-900 shadow-md" 
                                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                              )}
                            >
                              {d}m
                            </button>
                          ))}
                        </div>
                        <input 
                          type="number" 
                          value={customDuration}
                          onChange={(e) => {
                            setCustomDuration(e.target.value);
                            const val = parseInt(e.target.value);
                            if (!isNaN(val) && val > 0) setSelectedDuration(val);
                          }}
                          placeholder="Custom duration (m)"
                          title="Enter a custom duration in minutes"
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder:text-zinc-600"
                        />
                      </div>
                      <button 
                        onClick={() => setConfirmAction('start')}
                        title={`Start a new ${selectedDuration}m balloting session`}
                        className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        Start {selectedDuration}m Session
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setConfirmAction('reset')}
                      title="End the current session and clear active ballots"
                      className="w-full bg-zinc-800 text-white py-3 rounded-xl text-sm font-bold hover:bg-zinc-700 transition-all flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Reset & New Session
                    </button>
                  )}
                </div>

                {/* Group Settings */}
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Default Duration</label>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-1">
                      {[5, 10, 15, 30].map(d => (
                        <button
                          key={d}
                          onClick={() => updateDefaultDuration(d)}
                          title={`Set ${d} minutes as the default for new sessions`}
                          className={cn(
                            "flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                            group.defaultDuration === d 
                              ? "bg-indigo-600 text-white shadow-md" 
                              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                          )}
                        >
                          {d}m
                        </button>
                      ))}
                    </div>
                    <input 
                      type="number" 
                      placeholder="Set custom default (m)"
                      title="Enter a custom default duration in minutes"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder:text-zinc-600"
                      onBlur={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val > 0) updateDefaultDuration(val);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = parseInt((e.target as HTMLInputElement).value);
                          if (!isNaN(val) && val > 0) updateDefaultDuration(val);
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Member Management */}
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Invite Member</label>
                  <form onSubmit={sendInvitation} className="space-y-2">
                    <input 
                      type="email" 
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="member@email.com"
                      title="Enter the email of the person you want to invite"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder:text-zinc-600"
                      required
                    />
                    <button 
                      type="submit"
                      disabled={isInviting}
                      title="Send an invitation email to join this group"
                      className="w-full bg-white text-zinc-900 py-2 rounded-xl text-xs font-bold hover:bg-zinc-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <UserPlus className="w-3 h-3" />
                      {isInviting ? 'Sending...' : 'Send Invitation'}
                    </button>
                  </form>
                  
                  <div className="pt-4 border-t border-zinc-800">
                    <button 
                      onClick={copyInviteLink}
                      title="Copy the group invitation link to your clipboard"
                      className="w-full bg-zinc-800 text-zinc-300 py-2 rounded-xl text-xs font-bold hover:bg-zinc-700 transition-all flex items-center justify-center gap-2"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Link className="w-3 h-3" />
                          Copy Invite Link
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
            <h3 className="font-bold mb-4 flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
              <Users className="w-4 h-4" />
              Members ({members.length})
            </h3>
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {members.map(member => (
                  <motion.div 
                    key={member.uid} 
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-xs font-bold text-zinc-500 dark:text-zinc-400">
                        {member.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium leading-none text-zinc-900 dark:text-zinc-100">{member.name}</p>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{member.email}</p>
                      </div>
                    </div>
                    {isAdmin && member.uid !== user.uid && (
                      <button 
                        onClick={() => removeMember(member.uid)}
                        className="p-1.5 text-zinc-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                        title="Remove member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </section>

          <section className="bg-zinc-900 dark:bg-zinc-800 text-white rounded-3xl p-6 shadow-xl">
            <h3 className="font-bold mb-2 flex items-center gap-2 text-zinc-100">
              <Settings className="w-4 h-4" />
              Fairness Logic
            </h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-300 leading-relaxed">
              This application uses the Fisher-Yates shuffle algorithm to ensure true randomness. 
              Numbers are pre-shuffled on session start and assigned atomically via Firestore transactions, 
              guaranteeing that no two members receive the same number.
            </p>
          </section>
        </div>

        {/* Group Profile Modal */}
      <AnimatePresence>
        {showGroupProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGroupProfile(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-zinc-200 dark:border-zinc-800"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-zinc-900 dark:bg-zinc-100 rounded-2xl flex items-center justify-center text-white dark:text-zinc-900">
                  <Settings className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">Group Profile</h3>
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm">Update your group's identity</p>
                </div>
              </div>

              <form onSubmit={updateGroupProfile} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 px-1">Group Name</label>
                  <input 
                    type="text" 
                    value={editingGroupName}
                    onChange={(e) => setEditingGroupName(e.target.value)}
                    placeholder="Enter group name"
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-6 py-3 text-lg font-bold focus:outline-none focus:ring-4 focus:ring-zinc-900/5 dark:focus:ring-white/5 text-zinc-900 dark:text-zinc-100 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 px-1">Description</label>
                  <textarea 
                    value={editingGroupDescription}
                    onChange={(e) => setEditingGroupDescription(e.target.value)}
                    placeholder="What is this group for?"
                    rows={3}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-6 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-zinc-900/5 dark:focus:ring-white/5 text-zinc-900 dark:text-zinc-100 transition-all resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 px-1">Avatar</label>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-xl overflow-hidden flex-shrink-0">
                      {editingGroupAvatar ? (
                        <img src={editingGroupAvatar} className="w-full h-full object-cover" alt="Preview" />
                      ) : (
                        <Users className="w-6 h-6 m-3 text-zinc-400" />
                      )}
                    </div>
                    <label className="flex-1">
                      <div className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-4 py-2 text-xs font-bold text-zinc-600 dark:text-zinc-400 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all text-center">
                        Upload Image
                      </div>
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => handleAvatarUpload(e, setEditingGroupAvatar)}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 px-1">Pulling Mode</label>
                  <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setEditingPullingMode('individual')}
                      className={cn(
                        "flex-1 py-2 rounded-xl text-xs font-bold transition-all",
                        editingPullingMode === 'individual' ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm" : "text-zinc-500"
                      )}
                    >
                      Individual
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingPullingMode('admin')}
                      className={cn(
                        "flex-1 py-2 rounded-xl text-xs font-bold transition-all",
                        editingPullingMode === 'admin' ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm" : "text-zinc-500"
                      )}
                    >
                      Admin Only
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-2 px-1">
                    {editingPullingMode === 'individual' ? "Members pull their own numbers." : "Admin generates numbers for everyone with one click."}
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowGroupProfile(false)}
                    className="flex-1 px-6 py-4 rounded-2xl font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isUpdatingGroup || !editingGroupName.trim() || (editingGroupName === group.name && editingGroupDescription === (group.description || '') && editingGroupAvatar === (group.avatarUrl || '') && editingPullingMode === (group.pullingMode || 'individual'))}
                    className="flex-1 bg-indigo-600 text-white px-6 py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/20"
                  >
                    {isUpdatingGroup ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Dialog */}
        <AnimatePresence>
          {confirmAction && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl"
              >
                <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center mb-6 mx-auto">
                  <AlertCircle className="w-6 h-6 text-amber-500" />
                </div>
                <h3 className="text-xl font-bold text-white text-center mb-2">
                  {confirmAction === 'start' ? 'Start New Session?' : 'Reset Session?'}
                </h3>
                <p className="text-zinc-400 text-center text-sm mb-8">
                  {confirmAction === 'start' 
                    ? `This will start a new ${selectedDuration}m balloting session for all members.`
                    : 'This will end the current session and clear all active ballots. This cannot be undone.'}
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setConfirmAction(null)}
                    className="flex-1 px-6 py-3 rounded-xl bg-zinc-800 text-white font-bold text-sm hover:bg-zinc-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      if (confirmAction === 'start') startSession();
                      else resetSession();
                      setConfirmAction(null);
                    }}
                    className="flex-1 px-6 py-3 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
                  >
                    Confirm
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}


import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { supabase } from '../services/supabase';
import { Session, User } from '@supabase/supabase-js';
import { Logo, Input, Button, Label, Spinner } from '../components/ui';

// --- Helper Functions ---
const generateLicenseKey = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segment = () => Array.from({ length: 4 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
  return `${segment()}-${segment()}-${segment()}-${segment()}`;
};

// --- Components ---

const AdminLoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            setError('بيانات الدخول غير صحيحة.');
        }
        setIsLoading(false);
    };

    return (
        <div className="w-full max-w-sm">
            <div className="text-center mb-8">
                <Logo />
            </div>
            <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-gray-200 mb-6">دخول لوحة التحكم</h2>
            <form onSubmit={handleLogin} className="space-y-4">
                <div>
                    <Label htmlFor="email">البريد الإلكتروني</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                    <Label htmlFor="password">كلمة المرور</Label>
                    <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                <div>
                    <Button type="submit" className="w-full" isLoading={isLoading}>
                        تسجيل الدخول
                    </Button>
                </div>
            </form>
        </div>
    );
};

const AdminDashboard: React.FC<{ user: User }> = () => {
    const [numKeys, setNumKeys] = useState(10);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedKeys, setGeneratedKeys] = useState<string[]>([]);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const handleGenerate = async () => {
        setError('');
        setSuccessMessage('');
        setGeneratedKeys([]);
        setIsGenerating(true);

        const keysToInsert = Array.from({ length: numKeys }, () => ({
            key: generateLicenseKey(),
            is_used: false,
        }));
        
        const { data, error: insertError } = await supabase.from('licenses').insert(keysToInsert).select();

        if (insertError) {
            setError('حدث خطأ أثناء توليد الأكواد. الرجاء المحاولة مرة أخرى.');
            console.error(insertError);
        } else if(data) {
            const keys = data.map(item => item.key);
            setGeneratedKeys(keys);
            setSuccessMessage(`تم توليد ورفع ${keys.length} كود تفعيل بنجاح.`);
        }

        setIsGenerating(false);
    };
    
    const handleLogout = async () => {
        await supabase.auth.signOut();
    };


    return (
        <div className="w-full max-w-2xl">
             <header className="flex justify-between items-center mb-8">
                <Logo />
                <Button variant="secondary" onClick={handleLogout}>
                   تسجيل الخروج
                </Button>
            </header>

            <div className="w-full p-4 text-center">
                 <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">لوحة التحكم الإدارية</h1>
                 <p className="text-gray-600 dark:text-gray-400 mb-6">أداة توليد أكواد التفعيل لنظام YSK.</p>

                <div className="space-y-4 max-w-sm mx-auto">
                    <div>
                        <Label htmlFor="numKeys" className="text-right">عدد الأكواد المطلوب توليدها:</Label>
                        <Input
                            id="numKeys"
                            type="number"
                            value={numKeys}
                            onChange={(e) => setNumKeys(Math.max(1, parseInt(e.target.value, 10)))}
                            min="1"
                            max="100"
                        />
                    </div>
                    <Button onClick={handleGenerate} isLoading={isGenerating} disabled={isGenerating} className="w-full">
                        {isGenerating ? 'جاري التوليد...' : 'توليد ورفع الأكواد'}
                    </Button>
                </div>

                {error && <p className="mt-4 text-red-500 text-center">{error}</p>}
                {successMessage && <p className="mt-4 text-green-500 text-center">{successMessage}</p>}

                {generatedKeys.length > 0 && (
                    <div className="mt-6">
                        <Label className="text-right">الأكواد الجديدة:</Label>
                        <textarea
                            readOnly
                            className="w-full h-48 p-2 border rounded-md bg-gray-100 dark:bg-gray-700 font-mono text-sm text-left"
                            value={generatedKeys.join('\n')}
                        />
                        <p className="text-xs text-gray-500 mt-1 text-right">يمكنك نسخ هذه الأكواد وتوزيعها على المستخدمين.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const AdminApp: React.FC = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const checkSessionAndAdmin = async () => {
            setIsLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            setSession(session);

            if (session?.user) {
                try {
                    const { data, error: adminError } = await supabase
                        .from('admins')
                        .select('user_id')
                        .eq('user_id', session.user.id)
                        .single();

                    if (adminError || !data) {
                       throw new Error("Access Denied. You are not an administrator.");
                    }
                    setIsAdmin(true);
                } catch (err: any) {
                    setError(err.message);
                    setIsAdmin(false);
                     // Log out non-admin user trying to access admin panel
                    await supabase.auth.signOut();
                    setSession(null);
                }
            }
            setIsLoading(false);
        };
        
        checkSessionAndAdmin();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
            setSession(newSession);
             if (!newSession) {
                setIsAdmin(false);
                setError('');
                setIsLoading(false);
            } else if (newSession?.user?.id !== session?.user?.id) { // Check if user has changed
                checkSessionAndAdmin();
            }
        });

        return () => subscription.unsubscribe();
    }, [session?.user?.id]);
    
    if (isLoading) {
        return <div className="flex justify-center items-center h-screen"><Spinner className="w-10 h-10" /></div>;
    }

    const renderContent = () => {
        if (!session?.user) {
            return <AdminLoginPage />;
        }
        if (error) {
            return <p className="text-red-500 text-center p-4">{error}</p>
        }
        if (isAdmin) {
            return <AdminDashboard user={session.user} />;
        }
        return <div className="flex justify-center items-center h-screen"><Spinner className="w-10 h-10" /></div>;
    }


    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col justify-center items-center p-4">
            {renderContent()}
        </div>
    );
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AdminApp />
  </React.StrictMode>
);

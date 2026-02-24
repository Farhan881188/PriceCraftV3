import { useAuth } from '../context/AuthContext';
import { Clock, LogOut } from 'lucide-react';

export default function InactiveAccountPage() {
  const { signOut, user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock className="h-7 w-7 text-amber-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Account Pending Activation</h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          Your account ({user?.email}) has been created but is pending activation by an administrator.
          Please contact your system administrator to activate your account.
        </p>
        <button
          onClick={signOut}
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}

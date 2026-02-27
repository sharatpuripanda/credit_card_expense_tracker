import { AuthProvider, useAuth } from "@/lib/AuthContext";
import SBCashbackTracker from "@/components/SBCashbackTracker";
import LoginPage from "@/components/LoginPage";

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50">
        <p className="text-slate-500 text-sm">Loading...</p>
      </div>
    );
  }

  return user ? <SBCashbackTracker /> : <LoginPage />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;

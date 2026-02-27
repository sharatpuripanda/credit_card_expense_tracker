import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const { error: authError } = isSignUp
      ? await signUp(email, password)
      : await signIn(email, password);

    setLoading(false);

    if (authError) {
      setError(authError.message);
    } else if (isSignUp) {
      setMessage("Account created! Signing you in...");
      // Auto-switch to sign in view after brief delay
      setTimeout(() => {
        setIsSignUp(false);
        setMessage("");
      }, 1500);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <Card className="rounded-2xl shadow-lg border-indigo-100 border">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-6 justify-center">
              <img src="/sbi-logo.svg" alt="SBI" className="w-10 h-10" />
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-800 to-blue-500 bg-clip-text text-transparent">
                SBI Finance Tracker
              </h1>
            </div>

            <h2 className="text-lg font-semibold text-slate-800 text-center mb-4">
              {isSignUp ? "Create Account" : "Sign In"}
            </h2>

            <form onSubmit={handleSubmit} className="grid gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Email</label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Password</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</p>
              )}
              {message && (
                <p className="text-sm text-emerald-600 bg-emerald-50 rounded-lg p-2">{message}</p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white mt-1"
              >
                {loading ? "Please wait..." : isSignUp ? "Sign Up" : "Sign In"}
              </Button>
            </form>

            <p className="text-sm text-slate-500 text-center mt-4">
              {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
              <button
                onClick={() => { setIsSignUp(!isSignUp); setError(""); setMessage(""); }}
                className="text-indigo-600 hover:text-indigo-800 font-medium"
              >
                {isSignUp ? "Sign In" : "Sign Up"}
              </button>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

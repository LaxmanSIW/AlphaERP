import { useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/providers/trpc";
import { LogIn, BookOpen } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      window.location.href = "/";
    },
    onError: (err) => {
      setError(err.message || "Invalid credentials");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password");
      return;
    }
    loginMutation.mutate({ username, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f0e8]">
      <div className="w-full max-w-sm px-4">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#c4703f] flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-[#1e2a4a]">Alpha Wholesale</h1>
            <p className="text-xs text-[#3d4f6f]">ERP System</p>
          </div>
        </div>

        <Card className="border-[#d9cfc0] shadow-lg">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-lg font-semibold text-[#1e2a4a]">Sign In</CardTitle>
            <p className="text-xs text-[#3d4f6f]">
              Default: username <strong>admin</strong> / password <strong>admin</strong>
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm text-[#1e2a4a]">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="bg-[#f5f0e8] border-[#d9cfc0] focus:border-[#c4703f]"
                  autoComplete="username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm text-[#1e2a4a]">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="admin"
                  className="bg-[#f5f0e8] border-[#d9cfc0] focus:border-[#c4703f]"
                  autoComplete="current-password"
                />
              </div>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>
              )}
              <Button
                type="submit"
                className="w-full bg-[#c4703f] hover:bg-[#a85d32] text-white"
                disabled={loginMutation.isPending}
              >
                <LogIn className="w-4 h-4 mr-2" />
                {loginMutation.isPending ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

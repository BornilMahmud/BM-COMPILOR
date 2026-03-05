import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SiGithub } from "react-icons/si";
import { Loader2 } from "lucide-react";

export default function Login() {
  const { user, loading, login, loginError } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (user && !loading) {
      navigate("/repo-setup");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1a2e]" data-testid="loading-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a1a2e] p-4">
      <Card className="w-full max-w-md bg-[#16213e] border-[#0f3460] text-white shadow-2xl">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg" data-testid="logo">
            <span className="text-3xl font-bold text-white">BM</span>
          </div>
          <CardTitle className="text-2xl font-bold text-white" data-testid="title">BM Compiler</CardTitle>
          <CardDescription className="text-gray-300 text-base">
            Online compiler and code runner with GitHub integration.
            <br />
            Built with C + Flex + Bison.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {loginError && (
            <Alert variant="destructive" data-testid="login-error">
              <AlertDescription className="text-sm">{loginError}</AlertDescription>
            </Alert>
          )}
          <Button
            onClick={login}
            className="w-full bg-[#0f3460] hover:bg-[#1a4080] text-white border border-[#1a4080] h-12 text-base"
            data-testid="button-login-github"
          >
            <SiGithub className="mr-2 h-5 w-5" />
            Sign in with GitHub
          </Button>
          <p className="text-center text-xs text-gray-400">
            Uses Firebase Authentication with GitHub OAuth provider
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SiGithub } from "react-icons/si";
import { Loader2, Code2 } from "lucide-react";

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
      <div className="min-h-screen flex items-center justify-center bg-black" data-testid="loading-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  const handleGuest = () => {
    navigate("/ide");
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0">
        <img
          src="/login-bg.gif"
          alt=""
          className="w-full h-full object-cover"
          style={{ objectPosition: "center" }}
        />
        <div className="absolute inset-0 bg-black/55" />
      </div>

      <Card className="relative z-10 w-full max-w-md bg-black/65 backdrop-blur-md border-white/10 text-white shadow-2xl">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto" data-testid="logo">
            <img src="/bm-logo.png" alt="BM Compiler Logo" className="w-28 h-28 object-contain drop-shadow-xl" />
          </div>
          <CardTitle className="text-2xl font-bold text-white" data-testid="title">BM Compiler</CardTitle>
          <CardDescription className="text-gray-300 text-base">
            Online compiler and code runner with GitHub integration.
            <br />
            Built with Flex + Bison.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {loginError && (
            <Alert variant="destructive" data-testid="login-error">
              <AlertDescription className="text-sm">{loginError}</AlertDescription>
            </Alert>
          )}
          <Button
            onClick={login}
            className="w-full bg-[#0f3460] hover:bg-[#1a4080] text-white border border-[#1a4080]/60 h-12 text-base"
            data-testid="button-login-github"
          >
            <SiGithub className="mr-2 h-5 w-5" />
            Sign in with GitHub
          </Button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-transparent px-3 text-gray-400">or</span>
            </div>
          </div>
          <Button
            onClick={handleGuest}
            variant="outline"
            className="w-full border-white/20 text-gray-300 hover:bg-white/10 hover:text-white h-12 text-base bg-transparent"
            data-testid="button-guest"
          >
            <Code2 className="mr-2 h-5 w-5" />
            Continue as Guest
          </Button>
          <p className="text-center text-xs text-gray-500">
            Guest mode lets you write and run code. Sign in to save code to GitHub.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

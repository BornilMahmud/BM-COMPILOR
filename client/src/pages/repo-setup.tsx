import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, FolderGit2, Lock, Globe, LogOut } from "lucide-react";
import type { GithubRepo } from "@shared/schema";

export default function RepoSetup() {
  const { user, loading, githubToken, logout } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [creating, setCreating] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoPrivate, setNewRepoPrivate] = useState(false);
  const [newRepoDesc, setNewRepoDesc] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (githubToken) {
      loadRepos();
    }
  }, [githubToken]);

  const loadRepos = async () => {
    if (!githubToken) return;
    setLoadingRepos(true);
    setError(null);
    try {
      const res = await fetch("/api/github/repos", {
        headers: { "X-GitHub-Token": githubToken },
      });
      if (!res.ok) throw new Error("Failed to load repos");
      const data = await res.json();
      setRepos(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingRepos(false);
    }
  };

  const createRepo = async () => {
    if (!githubToken || !newRepoName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/github/createRepo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-GitHub-Token": githubToken,
        },
        body: JSON.stringify({
          name: newRepoName.trim(),
          description: newRepoDesc.trim() || undefined,
          isPrivate: newRepoPrivate,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create repo");
      }
      const repo = await res.json();
      toast({ title: "Repository created!", description: repo.full_name });
      selectRepo(repo);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const selectRepo = (repo: GithubRepo) => {
    localStorage.setItem("bm_selected_repo", JSON.stringify(repo));
    navigate("/ide");
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1a2e]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center">
              <img src="/bm-logo.png" alt="BM Compiler Logo" className="w-10 h-10 object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white" data-testid="text-page-title">BM Compiler</h1>
              <p className="text-sm text-gray-400">{user?.displayName || user?.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="text-gray-400 hover:text-white hover:bg-[#16213e]"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" data-testid="error-message">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="bg-[#16213e] border-[#0f3460] text-white">
          <CardHeader>
            <CardTitle className="text-lg">
              {showCreate ? "Create New Repository" : "Select Repository"}
            </CardTitle>
            <CardDescription className="text-gray-300">
              {showCreate
                ? "Create a new GitHub repository for your code"
                : "Choose an existing repository or create a new one"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {showCreate ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-300 mb-1 block">Repository Name</label>
                  <Input
                    value={newRepoName}
                    onChange={(e) => setNewRepoName(e.target.value)}
                    placeholder="my-project"
                    className="bg-[#1a1a2e] border-[#0f3460] text-white"
                    data-testid="input-repo-name"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-300 mb-1 block">Description (optional)</label>
                  <Input
                    value={newRepoDesc}
                    onChange={(e) => setNewRepoDesc(e.target.value)}
                    placeholder="A cool project"
                    className="bg-[#1a1a2e] border-[#0f3460] text-white"
                    data-testid="input-repo-desc"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={newRepoPrivate}
                    onCheckedChange={setNewRepoPrivate}
                    data-testid="switch-private"
                  />
                  <span className="text-sm text-gray-300">
                    {newRepoPrivate ? "Private repository" : "Public repository"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={createRepo}
                    disabled={!newRepoName.trim() || creating}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    data-testid="button-create-repo"
                  >
                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Repository
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setShowCreate(false)}
                    className="text-gray-300 hover:text-white hover:bg-[#1a1a2e]"
                    data-testid="button-back-to-list"
                  >
                    Back to list
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Button
                  onClick={() => setShowCreate(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11"
                  data-testid="button-new-repo"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create New Repository
                </Button>

                {loadingRepos ? (
                  <div className="flex items-center justify-center py-8" data-testid="loading-repos">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                  </div>
                ) : repos.length === 0 ? (
                  <p className="text-center text-gray-400 py-4" data-testid="text-no-repos">
                    No repositories found
                  </p>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {repos.map((repo) => (
                        <button
                          key={repo.full_name}
                          onClick={() => selectRepo(repo)}
                          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-[#1a1a2e] transition-colors text-left border border-transparent hover:border-[#0f3460]"
                          data-testid={`repo-item-${repo.name}`}
                        >
                          <FolderGit2 className="h-5 w-5 text-blue-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{repo.name}</p>
                            {repo.description && (
                              <p className="text-xs text-gray-400 truncate">{repo.description}</p>
                            )}
                          </div>
                          {repo.private ? (
                            <Lock className="h-4 w-4 text-yellow-400 flex-shrink-0" />
                          ) : (
                            <Globe className="h-4 w-4 text-green-400 flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LayoutDashboard, LogOut, Sparkles, User as UserIcon } from "lucide-react";

export const Navbar = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const initial = (profile?.display_name || user?.email || "?").charAt(0).toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-border/40 backdrop-blur-xl bg-background/60">
      <nav className="container flex h-20 items-center justify-between">
        <Logo />
        <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="/#features" className="hover:text-foreground transition-colors">Features</a>
          <a href="/#how" className="hover:text-foreground transition-colors">How it works</a>
          <a href="/#use-cases" className="hover:text-foreground transition-colors">Use cases</a>
          <a href="/#pricing" className="hover:text-foreground transition-colors">Pricing</a>
        </div>

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative flex items-center gap-2 rounded-full pl-1 pr-3 py-1 glass hover:border-primary/50 transition-colors">
                <span className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center font-bold text-sm shadow-[0_0_16px_hsl(var(--primary)/0.6)]">
                  {initial}
                </span>
                <span className="hidden sm:inline text-sm font-medium max-w-[120px] truncate">
                  {profile?.display_name || user.email?.split("@")[0]}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 glass-strong">
              <DropdownMenuLabel className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {user.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/dashboard")} className="cursor-pointer">
                <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/app")} className="cursor-pointer">
                <Sparkles className="mr-2 h-4 w-4" /> Studio
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link to="/get-started">
            <Button variant="neon" size="sm">
              <UserIcon className="w-4 h-4" /> Get Started
            </Button>
          </Link>
        )}
      </nav>
    </header>
  );
};

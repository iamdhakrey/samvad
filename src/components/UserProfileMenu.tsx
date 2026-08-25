import { useEffect, useRef, useState } from "react";
import { LogIn, LogOut, User, ChevronDown, Loader2 } from "lucide-react";
import { useAuth0Desktop } from "../hooks/useAuth0Desktop";
import { useAuthStore } from "../store/authStore";

function getInitials(name?: string, email?: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return "?";
}

export function UserProfileMenu() {
  const { login, logout, isAuthenticated } = useAuth0Desktop();
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleLogin = async () => {
    setOpen(false);
    await login();
  };

  const handleLogout = async () => {
    setOpen(false);
    await logout();
  };

  const initials = getInitials(user?.name, user?.email);

  return (
    <div ref={menuRef} className="relative flex items-center">
      {/* Trigger button */}
      <button
        id="user-profile-btn"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-panel transition-colors cursor-pointer"
        aria-label={isAuthenticated ? "User profile menu" : "Sign in"}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {isLoading ? (
          <Loader2 size={13} className="animate-spin text-primary" />
        ) : isAuthenticated && user ? (
          <>
            {/* Avatar */}
            <span className="relative h-4 w-4 shrink-0 overflow-hidden rounded-full ring-1 ring-primary/40">
              {user.picture ? (
                <img
                  src={user.picture}
                  alt={user.name ?? "User"}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-primary/20 text-[9px] font-bold text-primary">
                  {initials}
                </span>
              )}
            </span>

            <ChevronDown
              size={11}
              className={`shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
            />
          </>
        ) : (
          <span className="flex items-center gap-1.5">
            <User size={13} />
            <span>Sign in</span>
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          id="user-profile-dropdown"
          className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-lg border border-border bg-panel-raised shadow-elevated animate-in fade-in zoom-in-95 duration-100"
          style={{
            animation:
              "profileMenuIn 0.14s cubic-bezier(0.16,1,0.3,1) forwards",
          }}
          role="menu"
        >
          {isAuthenticated && user ? (
            <>
              {/* User info header */}
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-primary/50">
                  {user.picture ? (
                    <img
                      src={user.picture}
                      alt={user.name ?? "User"}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-linear-to-br from-primary/30 to-secondary/30 text-xs font-bold text-primary">
                      {initials}
                    </span>
                  )}
                </span>
                <div className="flex min-w-0 flex-col">
                  {user.name && (
                    <span className="truncate text-xs font-semibold text-text-primary">
                      {user.name}
                    </span>
                  )}
                  {user.email && (
                    <span className="truncate text-[10px] text-text-muted">
                      {user.email}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="p-1.5">
                <button
                  id="sign-out-btn"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-error/10 hover:text-error"
                  role="menuitem"
                >
                  <LogOut size={13} />
                  Sign Out
                </button>
              </div>
            </>
          ) : (
            /* Signed-out state */
            <div className="p-1.5">
              <div className="px-3 py-2 text-[10px] text-text-muted">
                Sign in to sync your workspaces
              </div>
              <button
                id="sign-in-btn"
                onClick={handleLogin}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-primary/10 hover:text-primary"
                role="menuitem"
              >
                <LogIn size={13} />
                Sign In with Auth0
              </button>
            </div>
          )}
        </div>
      )}

      {/* Keyframe styles injected inline */}
      <style>{`
        @keyframes profileMenuIn {
          from { opacity: 0; transform: scale(0.95) translateY(-4px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
      `}</style>
    </div>
  );
}

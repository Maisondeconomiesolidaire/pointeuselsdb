import { type ReactNode, useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  useClerk,
  useUser,
} from "@clerk/clerk-react";
import { useConvexAuth, useQuery } from "convex/react";
import {
  Building2,
  ClipboardList,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Sun,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { api } from "../convex/_generated/api";
import { cn } from "./lib/cn";
import { FullSpinner } from "./components/ui/Spinner";
import { AppSwitcher } from "./components/AppSwitcher";
import { HelpButton } from "./components/HelpButton";
import { Dashboard } from "./pages/Dashboard";
import { Pointages } from "./pages/Pointages";
import { Projets } from "./pages/Projets";
import { Clients } from "./pages/Clients";
import { Salaries } from "./pages/Salaries";
import { Fournisseurs } from "./pages/Fournisseurs";
import { Depenses } from "./pages/Depenses";
import { Factures } from "./pages/Factures";
import { UpdateAvailableBanner } from "./components/UpdateAvailableBanner";

const NAV = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard, end: true, pageKey: "pointeuse:dashboard" },
  { to: "/pointages", label: "Pointages", icon: ClipboardList, pageKey: "pointeuse:pointages" },
  { to: "/projets", label: "Projets", icon: FolderKanban, pageKey: "pointeuse:projets" },
  { to: "/clients", label: "Clients", icon: Building2, pageKey: "pointeuse:clients" },
  { to: "/salaries", label: "Salariés", icon: Users, pageKey: "pointeuse:salaries" },
  { to: "/fournisseurs", label: "Fournisseurs", icon: Truck, pageKey: "pointeuse:fournisseurs" },
  { to: "/depenses", label: "Dépenses", icon: Wallet, pageKey: "pointeuse:depenses" },
  { to: "/factures", label: "Factures", icon: FileText, pageKey: "pointeuse:factures" },
];

const NAV_ACTIVE = "bg-brand-500 text-white shadow-sm";

function Sidebar({
  onNavigate,
  theme,
  setTheme,
  currentPath,
  userName,
  points,
  userImage,
  navItems,
}: {
  onNavigate?: () => void;
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  currentPath: string;
  userName: string;
  points: number;
  userImage?: string | null;
  navItems: typeof NAV;
}) {
  return (
    <div className="flex h-full flex-col bg-[var(--card)]">
      <div className="flex h-16 items-center justify-between gap-2 border-b border-[var(--border)] px-5">
        <Link to="/" onClick={onNavigate} className="flex items-center">
          <img src="/logo-lsdb.png" alt="LSDB" className="h-11 w-11 object-contain" />
        </Link>
        <AppSwitcher current="pointeuse" />
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          const active =
            currentPath === item.to ||
            (!item.end && currentPath.startsWith(item.to));
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                  isActive
                    ? NAV_ACTIVE
                    : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                )
              }
            >
              <item.icon
                className={cn(
                  "h-[18px] w-[18px] shrink-0",
                  active ? "text-white" : "text-[var(--muted-foreground)]",
                )}
              />
              <span className={cn("min-w-0 flex-1 truncate", active && "text-white")}>
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-[var(--border)] p-3">
        <button
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--muted-foreground)] transition hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === "dark" ? "Mode clair" : "Mode sombre"}
        </button>
        <div className="flex items-center gap-1.5">
          <Link
            to="/compte"
            onClick={onNavigate}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-[var(--accent)] px-3 py-2 transition hover:brightness-95"
          >
            <UserAvatar name={userName} src={userImage} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--foreground)]">{userName}</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-700">{points} pts <span title="Les points récompensent vos réservations, retours et participations utiles. Ils pourront bientôt débloquer des cadeaux et des récompenses.">?</span></span>
            </div>
          </Link>
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}

type Access = {
  isAdmin: boolean;
  grants: { pageKey: string; actions: string[] }[];
};

function canAccess(access: Access, pageKey: string, action = "read") {
  if (access.isAdmin) return true;
  return Boolean(access.grants.find((grant) => grant.pageKey === pageKey)?.actions.includes(action));
}

function firstAllowedRoute(access: Access) {
  return NAV.find((item) => canAccess(access, item.pageKey))?.to ?? "/compte";
}

function RequirePage({
  access,
  pageKey,
  children,
}: {
  access: Access;
  pageKey: string;
  children: ReactNode;
}) {
  if (canAccess(access, pageKey)) {
    return <>{children}</>;
  }
  return <Navigate to={firstAllowedRoute(access)} replace />;
}

function MobileLogo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-black/5">
        <img src="/logo-lsdb.png" alt="LSDB" className="h-7 w-7 object-contain" />
      </span>
      <span className="text-sm font-semibold text-[var(--foreground)]">Pointeuse</span>
    </Link>
  );
}

function UserAvatar({ name, src }: { name: string; src?: string | null }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-600 text-xs font-semibold text-white">
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function SignOutButton() {
  const { signOut } = useClerk();
  return (
    <button
      type="button"
      onClick={() => void signOut({ redirectUrl: "/" })}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--muted-foreground)] transition hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
      aria-label="Se déconnecter"
      title="Se déconnecter"
    >
      <LogOut className="h-4 w-4" />
    </button>
  );
}

function Compte() {
  const { user } = useUser();
  const name = user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "Moi";

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">Compte</h1>
      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-center gap-4">
          <img
            src={user?.imageUrl || "/logo-lsdb.png"}
            alt=""
            className="h-14 w-14 rounded-full object-cover"
          />
          <div className="min-w-0">
            <p className="truncate font-semibold text-[var(--foreground)]">{name}</p>
            <p className="truncate text-sm text-[var(--muted-foreground)]">
              {user?.primaryEmailAddress?.emailAddress}
            </p>
          </div>
        </div>
        <div className="mt-5">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    const stored = window.localStorage.getItem("pointeuse-theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("pointeuse-theme", theme);
  }, [theme]);

  return [theme, setTheme] as const;
}

function AppLayout({ access }: { access: Access }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useTheme();
  const { user } = useUser();
  const location = useLocation();
  const userName = user?.firstName ?? user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "Moi";
  const points = useQuery(api.points.myPoints, {}) ?? 100;
  const navItems = NAV.filter((item) => canAccess(access, item.pageKey));

  const sidebar = (
    <Sidebar
      theme={theme}
      setTheme={setTheme}
      currentPath={location.pathname}
      userName={userName}
      points={points}
      userImage={user?.imageUrl}
      navItems={navItems}
      onNavigate={() => setMobileOpen(false)}
    />
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[var(--border)] bg-[var(--card)] lg:flex">
        {sidebar}
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-[var(--border)] bg-[var(--card)] px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--foreground)] hover:bg-[var(--accent)]"
          aria-label="Ouvrir le menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <MobileLogo />
        <div className="ml-auto flex items-center gap-1">
          <AppSwitcher current="pointeuse" />
          <Link to="/compte">
            <UserAvatar name={userName} src={user?.imageUrl} />
          </Link>
        </div>
      </header>

      {mobileOpen ? (
        <div className="lg:hidden">
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[var(--border)] bg-[var(--card)]">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
              aria-label="Fermer le menu"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      ) : null}

      <HelpButton />

      <main
        key={location.pathname}
        className="animate-page-sweep mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8"
      >
        <Routes>
          <Route path="/" element={<RequirePage access={access} pageKey="pointeuse:dashboard"><Dashboard /></RequirePage>} />
          <Route path="/pointages" element={<RequirePage access={access} pageKey="pointeuse:pointages"><Pointages /></RequirePage>} />
          <Route path="/projets" element={<RequirePage access={access} pageKey="pointeuse:projets"><Projets /></RequirePage>} />
          <Route path="/projets/:projectId" element={<RequirePage access={access} pageKey="pointeuse:projets"><Projets /></RequirePage>} />
          <Route path="/clients" element={<RequirePage access={access} pageKey="pointeuse:clients"><Clients /></RequirePage>} />
          <Route path="/salaries" element={<RequirePage access={access} pageKey="pointeuse:salaries"><Salaries /></RequirePage>} />
          <Route path="/fournisseurs" element={<RequirePage access={access} pageKey="pointeuse:fournisseurs"><Fournisseurs /></RequirePage>} />
          <Route path="/depenses" element={<RequirePage access={access} pageKey="pointeuse:depenses"><Depenses /></RequirePage>} />
          <Route path="/factures" element={<RequirePage access={access} pageKey="pointeuse:factures"><Factures /></RequirePage>} />
          <Route path="/compte" element={<Compte />} />
          <Route path="*" element={<Navigate to={firstAllowedRoute(access)} replace />} />
        </Routes>
      </main>
    </div>
  );
}

function SignInScreen() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <img
          src="/logo-lsdb.png"
          alt="LSDB"
          className="h-16 w-16 object-contain"
        />
      </div>
      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          Pointeuse LSDB
        </h1>
        <p className="mt-2 max-w-sm text-sm text-[var(--muted-foreground)]">
          Suivi des salariés et des chantiers. Connectez-vous avec votre compte
          Mes Outils.
        </p>
      </div>
      <SignInButton mode="modal">
        <button className="inline-flex h-11 items-center rounded-lg bg-brand-500 px-6 text-sm font-medium text-white hover:bg-brand-600">
          Se connecter
        </button>
      </SignInButton>
    </div>
  );
}

function AccessGate() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const access = useQuery(
    api.permissions.myAccess,
    isAuthenticated ? {} : "skip",
  );

  if (isLoading || (isAuthenticated && access === undefined)) {
    return <FullSpinner label="Chargement…" />;
  }
  const canAccess = Boolean(
    access &&
      (access.isAdmin ||
        access.grants.some((grant) => grant.pageKey.startsWith("pointeuse:"))),
  );
  if (!canAccess) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <h1 className="text-xl font-semibold text-[var(--foreground)]">
          Accès à la Pointeuse non autorisé
        </h1>
        <p className="max-w-sm text-sm text-[var(--muted-foreground)]">
          Votre compte n'a pas encore les droits « Pointeuse ». Demandez à un
          administrateur Mes Outils de vous les attribuer.
        </p>
      </div>
    );
  }
  return <AppLayout access={access as Access} />;
}

export default function App() {
  return (
    <div className="min-h-full">
      <UpdateAvailableBanner appName="Pointeuse LSDB" />
      <SignedIn>
        <AccessGate />
      </SignedIn>
      <SignedOut>
        <SignInScreen />
      </SignedOut>
    </div>
  );
}

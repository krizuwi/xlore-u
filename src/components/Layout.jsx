import { BookOpen, Heart, LayoutDashboard, LogIn, LogOut, MapPinned, Menu, Moon, Scale, School, Sparkles, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const publicLinks = [
  ["/schools", "Schools"],
  ["/programs", "Programs"],
  ["/map", "Map"],
  ["/assessment", "Assessment"]
];

export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">X</span>
      <span>
        <span className="brand-name">Xlore U</span>
        <span className="brand-subtitle">Your college path, made clearer</span>
      </span>
    </span>
  );
}

export function Layout() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("xloreTheme") || "dark");
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("xloreTheme", theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0c111b" : "#2447d8");
  }, [theme]);

  useEffect(() => {
    if (!showSignOutConfirm) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape" && !signingOut) setShowSignOutConfirm(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showSignOutConfirm, signingOut]);

  const confirmSignOut = async () => {
    setSigningOut(true);
    try {
      await logout();
      setOpen(false);
      setShowSignOutConfirm(false);
      navigate("/");
    } finally {
      setSigningOut(false);
    }
  };

  const handleNavigation = (event, destination) => {
    setOpen(false);
    if (destination === "/assessment" && !user) {
      event.preventDefault();
      navigate("/login", {
        state: {
          from: "/assessment",
          message: "Sign in or create an account to start your personalized assessment."
        }
      });
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="container topbar-inner">
          <NavLink className="logo-button" to="/" onClick={() => setOpen(false)} aria-label="Xlore U home">
            <Brand />
          </NavLink>

          <nav className={`desktop-nav ${open ? "mobile-nav-open" : ""}`} aria-label="Main navigation">
            {publicLinks.map(([to, label]) => (
              <NavLink key={to} to={to} onClick={(event) => handleNavigation(event, to)} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
                {label}
              </NavLink>
            ))}
            {user && (
              <>
                <NavLink to="/saved" onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>Saved</NavLink>
                <NavLink to="/comparison" onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>Compare Schools</NavLink>
                <NavLink to="/compare-programs" onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>Compare Programs</NavLink>
                <button
                  className="mobile-signout-btn"
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setShowSignOutConfirm(true);
                  }}
                >
                  <LogOut size={17} /> Sign out
                </button>
              </>
            )}
          </nav>

          <div className="header-actions">
            <button
              className="theme-toggle"
              onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {user ? (
              <>
                <button className="ghost-btn desktop-only" onClick={() => setShowSignOutConfirm(true)}><LogOut size={16} /> Sign out</button>
                <button className="primary-btn compact" onClick={() => navigate("/dashboard")}><LayoutDashboard size={16} /> Dashboard</button>
              </>
            ) : (
              <>
                <button className="ghost-btn desktop-only" onClick={() => navigate("/login")}><LogIn size={16} /> Sign in</button>
                <button className="primary-btn compact" onClick={() => navigate("/register")}>Create account</button>
              </>
            )}
            <button className="menu-btn" aria-label="Toggle navigation" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>

      <main><Outlet /></main>

      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div>
              <Brand />
              <p>Helping senior high school students explore programs and institutions with clearer, personalized guidance.</p>
            </div>
            <div>
              <strong>Explore</strong>
              <NavLink to="/schools"><School size={14} /> Schools</NavLink>
              <NavLink to="/programs"><BookOpen size={14} /> Programs</NavLink>
              <NavLink to="/map"><MapPinned size={14} /> Institution Map</NavLink>
              <NavLink to="/assessment" onClick={(event) => handleNavigation(event, "/assessment")}><Sparkles size={14} /> Assessment</NavLink>
            </div>
            <div>
              <strong>Your account</strong>
              <NavLink to="/dashboard"><LayoutDashboard size={14} /> Dashboard</NavLink>
              <NavLink to="/saved"><Heart size={14} /> Saved</NavLink>
              <NavLink to="/comparison"><Scale size={14} /> Compare Schools</NavLink>
              <NavLink to="/compare-programs"><BookOpen size={14} /> Compare Programs</NavLink>
            </div>
          </div>
          <div className="footer-bottom"><span>© 2026 Xlore U</span><span>STI College Global City capstone project</span></div>
        </div>
      </footer>

      {showSignOutConfirm && (
        <div
          className="signout-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !signingOut) setShowSignOutConfirm(false);
          }}
        >
          <section className="signout-dialog" role="alertdialog" aria-modal="true" aria-labelledby="signout-dialog-title" aria-describedby="signout-dialog-description">
            <div className="signout-dialog-icon" aria-hidden="true"><LogOut size={23} /></div>
            <div className="signout-dialog-copy">
              <span className="signout-dialog-eyebrow">SIGN OUT</span>
              <h2 id="signout-dialog-title">Are you sure you want to sign out?</h2>
              <p id="signout-dialog-description">You’ll need to sign in again to access your saved schools, comparisons, and dashboard.</p>
            </div>
            <div className="signout-dialog-actions">
              <button className="secondary-btn" type="button" onClick={() => setShowSignOutConfirm(false)} disabled={signingOut} autoFocus>
                Stay signed in
              </button>
              <button className="signout-confirm-btn" type="button" onClick={confirmSignOut} disabled={signingOut}>
                <LogOut size={17} /> {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

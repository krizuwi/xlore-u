import { BookOpen, Heart, Info, LayoutDashboard, LogIn, LogOut, Mail, MapPinned, Menu, Scale, School, Sparkles, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Brand } from "./Brand.jsx";
import { ThemeToggle } from "./ThemeToggle.jsx";
import { UserFeedbackPrompt } from "./UserFeedbackPrompt.jsx";
import { useUnsavedChanges } from "../context/UnsavedChangesContext.jsx";
import { CommunityNotifications } from './CommunityNotifications.jsx';

const publicLinks = [
  ["/schools", "Schools"],
  ["/programs", "Programs"],
  ["/map", "Map"],
  ["/assessment", "Assessment"]
];

export function Layout() {
  const [open, setOpen] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { user, logout } = useAuth();
  const { requestDiscard } = useUnsavedChanges();
  const navigate = useNavigate();
  const institutionAccess = useLocation().pathname.startsWith('/institution');

  useEffect(() => {
    if (!showSignOutConfirm) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape" && !signingOut) setShowSignOutConfirm(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showSignOutConfirm, signingOut]);

  const confirmSignOut = () => requestDiscard(async () => {
    setSigningOut(true);
    try {
      await logout();
      setOpen(false);
      setShowSignOutConfirm(false);
      navigate("/");
    } finally {
      setSigningOut(false);
    }
  });

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
            {publicLinks.filter(([to]) => user?.role !== 'institution' || to !== '/assessment').map(([to, label]) => (
              <NavLink key={to} to={to} onClick={(event) => handleNavigation(event, to)} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
                {label}
              </NavLink>
            ))}
            {user?.role === 'institution' && <><NavLink to="/institution" end className="nav-link" onClick={() => setOpen(false)}>My school page</NavLink><NavLink to="/institution/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setOpen(false)}>Account settings</NavLink><button className="mobile-signout-btn" type="button" onClick={() => { setOpen(false); setShowSignOutConfirm(true); }}>Sign out</button></>}
            {user && user.role !== 'institution' && (
              <>
                <NavLink to="/saved" onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>Saved</NavLink>
                <NavLink to="/comparison" onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>Compare</NavLink>
                <NavLink to="/profile" onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>Profile</NavLink>
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
            <ThemeToggle />
            <CommunityNotifications />
            {user ? (
              <>
                <button className="ghost-btn desktop-only" onClick={() => setShowSignOutConfirm(true)}><LogOut size={16} /> Sign out</button>
                <button className="primary-btn compact" onClick={() => navigate(user.role === 'institution' ? '/institution' : "/dashboard")}><LayoutDashboard size={16} /> {user.role === 'institution' ? <><span className="institution-header-full">My school page</span><span className="institution-header-short">My school</span></> : 'Dashboard'}</button>
              </>
            ) : (
              <>
                <button className="ghost-btn desktop-only" onClick={() => navigate(institutionAccess ? '/institution/login' : '/login')}><LogIn size={16} /> Sign in</button>
                <button className="primary-btn compact" onClick={() => navigate(institutionAccess ? '/institution/register' : '/register')}>Create account</button>
              </>
            )}
            <button className="menu-btn" aria-label="Toggle navigation" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>

      <main><Outlet /></main>
      <UserFeedbackPrompt />

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
              <NavLink to="/about"><Info size={14} /> About Us</NavLink>
            </div>
            <div>
              <strong>Your account</strong>
              {user?.role === 'institution' ? <>
                <NavLink to="/institution"><School size={14} /> My school page</NavLink>
                <NavLink to="/institution/settings"><UserRound size={14} /> Account settings</NavLink>
              </> : <>
              <NavLink to="/dashboard"><LayoutDashboard size={14} /> Dashboard</NavLink>
              <NavLink to="/saved"><Heart size={14} /> Saved</NavLink>
              <NavLink to="/comparison"><Scale size={14} /> Compare Schools & Programs</NavLink>
              <NavLink to="/profile"><UserRound size={14} /> Profile</NavLink>
              <NavLink to="/institution/login">Institution sign in</NavLink>
              <NavLink to="/institution/register">Register institution</NavLink>
              </>}
              <NavLink to={user?.role === 'admin' ? '/admin/messages' : '/contact'}><Mail size={14} /> {user?.role === 'admin' ? 'Contact messages' : 'Contact Admin'}</NavLink>
              <NavLink to="/terms">Terms of Use</NavLink>
              <NavLink to="/privacy">Privacy Policy</NavLink>
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

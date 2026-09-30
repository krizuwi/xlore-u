import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight, Bell, BookOpen, BriefcaseBusiness, ChevronDown, ClipboardList,
  Command, Globe2, LayoutDashboard, Menu, Search, University, UserRound,
} from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { AdminAvatar, Navbar } from "./navbar/Navbar.jsx";
import "./AdminShell.css";

function closeDetails(event) {
  const details = event.currentTarget.closest("details");
  if (details) details.open = false;
}

function dismissDetails(event) {
  if (event.key === "Escape" && event.currentTarget.open) {
    event.currentTarget.open = false;
    event.currentTarget.querySelector("summary").focus();
  }
}

export function AdminShell({ children, searchQuery, onSearchChange }) {
  const { user } = useAuth();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState("");
  const searchRef = useRef(null);
  const menuRef = useRef(null);
  const shellRef = useRef(null);
  const userName = user?.firstName || "Admin";

  useEffect(() => {
    function handleShortcut(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (shellRef.current?.querySelector(".admin-sidebar.is-open")) return;
        searchRef.current?.focus();
      }
    }
    function handlePointer(event) {
      shellRef.current?.querySelectorAll("details[open]").forEach((details) => {
        if (!details.contains(event.target)) details.open = false;
      });
    }
    document.addEventListener("keydown", handleShortcut);
    document.addEventListener("pointerdown", handlePointer);
    return () => {
      document.removeEventListener("keydown", handleShortcut);
      document.removeEventListener("pointerdown", handlePointer);
    };
  }, []);

  useEffect(() => {
    if (!navigationOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const sidebar = shellRef.current.querySelector(".admin-sidebar");
    sidebar.querySelector("a")?.focus();
    function trapNavigation(event) {
      if (event.key === "Escape") {
        setNavigationOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = Array.from(sidebar.querySelectorAll("a, button, summary")).filter((element) => element.getClientRects().length > 0);
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    function handleResize() {
      if (window.innerWidth > 900) setNavigationOpen(false);
    }
    document.addEventListener("keydown", trapNavigation);
    window.addEventListener("resize", handleResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", trapNavigation);
      window.removeEventListener("resize", handleResize);
      menuRef.current?.focus();
    };
  }, [navigationOpen]);

  return (
    <div className="admin-workspace-app" ref={shellRef}>
      <a href="#admin-main" className="aw-skip-link">Skip to main content</a>
      <Navbar isOpen={navigationOpen} onClose={() => setNavigationOpen(false)} userName={userName} />
      {navigationOpen && <div className="aw-drawer-backdrop" onClick={() => setNavigationOpen(false)} aria-hidden="true" />}

      <div className="aw-workspace" inert={navigationOpen}>
        <header className="aw-topbar">
          <button ref={menuRef} className="aw-icon-button aw-menu-toggle" onClick={() => setNavigationOpen(true)} aria-label="Open navigation" aria-controls="admin-sidebar" aria-expanded={navigationOpen} type="button"><Menu size={20} /></button>
          <Link className="aw-mobile-brand" to="/admin"><span className="admin-sidebar-logo" aria-hidden="true" /><strong>Xlore-U</strong></Link>
          <label className="aw-search">
            <Search size={17} aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              aria-label="Search universities, programs, or keywords"
              placeholder="Search universities, programs, or keywords..."
              value={searchQuery ?? localSearch}
              onChange={(event) => { setLocalSearch(event.target.value); onSearchChange?.(event.target.value); }}
            />
            <span className="aw-search-shortcut" aria-hidden="true"><Command size={11} />K</span>
          </label>

          <div className="aw-topbar-actions">
            <details className="aw-dropdown aw-notifications" onKeyDown={dismissDetails}>
              <summary className="aw-icon-button" aria-label="Open activity notifications"><Bell size={19} /><span className="aw-bell-dot" /></summary>
              <div className="aw-dropdown-panel aw-notification-panel">
                <div className="aw-dropdown-heading"><strong>Activity center</strong><span>Stay up to date with your workspace.</span></div>
                <Link to="/admin/scraping" onClick={closeDetails}><span className="aw-notification-icon"><Globe2 size={17} /></span><span><strong>Scraping activity</strong><small>Monitor jobs and collected data</small></span><ArrowUpRight size={14} /></Link>
                <Link to="/admin/logs" onClick={closeDetails}><span className="aw-notification-icon aw-notification-purple"><ClipboardList size={17} /></span><span><strong>System logs</strong><small>Review the latest workspace events</small></span><ArrowUpRight size={14} /></Link>
              </div>
            </details>
            <details className="aw-dropdown aw-account" onKeyDown={dismissDetails}>
              <summary className="aw-account-trigger" aria-label="Open account menu">
                <AdminAvatar />
                <span className="aw-account-copy"><strong>{userName}</strong><span>Super Admin</span></span>
                <ChevronDown size={14} aria-hidden="true" />
              </summary>
              <div className="aw-dropdown-panel aw-account-panel">
                <div className="aw-dropdown-heading"><strong>{userName}</strong><span>Administrator account</span></div>
                <Link to="/profile" onClick={closeDetails}><UserRound size={16} />My profile</Link>
                <Link to="/" onClick={closeDetails}><BookOpen size={16} />View website<ArrowUpRight size={14} /></Link>
              </div>
            </details>
          </div>
        </header>

        <main id="admin-main" className="aw-content" tabIndex={-1}>{children}</main>

        <footer className="aw-footer">
          <div><span className="admin-sidebar-logo" aria-hidden="true" /><strong>Xlore-U</strong><span className="aw-footer-divider" /><span>Admin Panel</span></div>
          <span>Build for a better education future.</span>
          <span className="aw-footer-year">&copy; {new Date().getFullYear()} Xlore-U</span>
        </footer>
      </div>

      <nav className="aw-mobile-navigation" aria-label="Quick navigation" inert={navigationOpen}>
        <NavLink to="/admin" end className={({ isActive }) => isActive ? "is-active" : ""}><LayoutDashboard size={19} /><span>Home</span></NavLink>
        <NavLink to="/admin/universities" className={({ isActive }) => isActive ? "is-active" : ""}><University size={19} /><span>Universities</span></NavLink>
        <NavLink to="/admin/programs" className={({ isActive }) => isActive ? "is-active" : ""}><BriefcaseBusiness size={19} /><span>Programs</span></NavLink>
        <button type="button" aria-label="Open all navigation" aria-controls="admin-sidebar" aria-expanded={navigationOpen} onClick={() => setNavigationOpen(true)}><Menu size={19} /><span>More</span></button>
      </nav>
    </div>
  );
}

export default AdminShell;

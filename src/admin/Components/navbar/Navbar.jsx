import {
  BookOpen, BriefcaseBusiness, ChevronDown, ClipboardCheck, ClipboardList,
  LayoutDashboard, Settings, Shapes,
  University, UserRound, Globe2, LogOut, X,
} from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { Brand } from "../../../components/Brand.jsx";
import "./Navbar.css";

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/admin" },
  { label: "Universities", icon: University, to: "/admin/universities" },
  { label: "Programs", icon: BriefcaseBusiness, to: "/admin/programs" },
  { label: "Categories", icon: Shapes, to: "/admin/categories" },
  { label: "Scraping", icon: Globe2, to: "/admin/scraping" },
  { label: "Assessment", icon: ClipboardCheck, to: "/admin/assessment" },
];

export function AdminAvatar({ className = "" }) {
  return (
    <span className={`aw-avatar ${className}`} aria-hidden="true">
      <svg viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="20" fill="#DEE8F2" />
        <path d="M9 18c0-9 4-14 11-14s11 5 11 14v10H9V18Z" fill="#303C50" />
        <path d="M4 40c1-10 6-14 16-14s15 4 16 14H4Z" fill="#7FABC8" />
        <path d="m15 27 5 10 5-10-5-3-5 3Z" fill="white" />
        <path d="M17 21h6v7l-3 3-3-3v-7Z" fill="#E6B49D" />
        <path d="M13 14c0-5 3-7 7-7s7 2 7 7v4c0 5-3 8-7 8s-7-3-7-8v-4Z" fill="#F4CFB8" />
        <path d="M12 15c0-8 4-10 9-10 5 0 8 4 8 10-4 0-7-3-9-6-1 4-4 6-8 6Z" fill="#303C50" />
        <path d="M17.5 21.5c1.5 1.2 3.5 1.2 5 0" stroke="#B87F72" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function NavigationItem({ label, icon: Icon, to, onNavigate }) {
  return (
    <NavLink to={to} end={to === "/admin"} onClick={onNavigate} className={({ isActive }) => `admin-sidebar-link${isActive ? " is-active" : ""}`}>
      <span className="admin-sidebar-icon"><Icon size={18} strokeWidth={1.75} aria-hidden="true" /></span>
      <span>{label}</span>
    </NavLink>
  );
}

export function Navbar({ isOpen = false, onClose, userName = "Admin", accountRole = "Administrator", onSignOut }) {
  return (
    <aside id="admin-sidebar" className={`admin-sidebar${isOpen ? " is-open" : ""}`} aria-label="Admin sidebar" role={isOpen ? "dialog" : undefined} aria-modal={isOpen ? true : undefined}>
      <div className="admin-sidebar-brand-row">
        <Link to="/admin" className="admin-sidebar-brand" aria-label="Xlore U admin dashboard" onClick={onClose}>
          <Brand subtitle="Admin panel" />
        </Link>
        <button className="admin-sidebar-close" type="button" onClick={onClose} aria-label="Close navigation"><X size={20} /></button>
      </div>

      <nav className="admin-sidebar-navigation" aria-label="Admin navigation">
        <ul className="admin-sidebar-list">
          {navigation.map((item) => <li key={item.label}><NavigationItem {...item} onNavigate={onClose} /></li>)}
        </ul>
        <ul className="admin-sidebar-list admin-sidebar-utilities">
          <li><NavigationItem label="Settings" icon={Settings} to="/admin/settings" onNavigate={onClose} /></li>
          <li><NavigationItem label="Logs" icon={ClipboardList} to="/admin/logs" onNavigate={onClose} /></li>
        </ul>
      </nav>

      <details className="admin-sidebar-account" onKeyDown={(event) => {
        if (event.key === "Escape" && event.currentTarget.open) {
          event.stopPropagation();
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary").focus();
        }
      }}>
        <summary className="admin-sidebar-profile" aria-label="Admin account options">
          <AdminAvatar />
          <span className="admin-sidebar-user"><strong>{userName}</strong><span>{accountRole}</span></span>
          <ChevronDown className="admin-sidebar-chevron" size={15} aria-hidden="true" />
        </summary>
        <div className="admin-sidebar-account-menu">
          <button type="button" onClick={onSignOut}><LogOut size={16} aria-hidden="true" />Sign out</button>
          <Link to="/profile" onClick={onClose}><UserRound size={16} aria-hidden="true" />My profile</Link>
          <Link to="/" onClick={onClose}><BookOpen size={16} aria-hidden="true" />View website</Link>
        </div>
      </details>
    </aside>
  );
}

export default Navbar;

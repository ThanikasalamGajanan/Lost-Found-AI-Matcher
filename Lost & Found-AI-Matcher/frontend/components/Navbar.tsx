'use client';

import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { notificationsApi } from '@/lib/api';
import {
  Bell,
  LogOut,
  User,
  Menu,
  X,
  LayoutDashboard,
  Search,
  PlusCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';

const navLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/report/lost', label: 'Report Lost', icon: PlusCircle },
  { href: '/report/found', label: 'Report Found', icon: Search },
  { href: '/notifications', label: 'Notifications', icon: Bell },
];

export function Navbar() {
  const { user, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    notificationsApi
      .getAll(1, 1, true)
      .then((data) => {
        if (!cancelled) setUnreadCount(data.unread_count);
      })
      .catch(() => {
        // Non-fatal: bell simply shows no badge.
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleLogout = () => {
    logout();
    setUserMenuOpen(false);
    setMobileOpen(false);
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary-700">
            <span className="text-2xl">🔍</span>
            <span className="hidden sm:inline">Lost & Found AI</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {user && navLinks.map((link) => (
              <NavLink key={link.href} href={link.href} icon={link.icon} label={link.label} />
            ))}
            {!user && (
              <>
                <NavLink href="/report/lost" icon={PlusCircle} label="Report Lost" />
                <NavLink href="/report/found" icon={Search} label="Report Found" />
              </>
            )}

            {user?.role === 'admin' && (
              <Link
                href="/admin"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-primary-600 transition-colors"
              >
                Admin
              </Link>
            )}

            {user ? (
              <div className="relative ml-3">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                  <span className="max-w-[120px] truncate hidden lg:block">
                    {user.full_name || user.email}
                  </span>
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-2">
                    <div className="px-4 py-2 border-b border-gray-100 mb-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {user.full_name || 'User'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                    <Link
                      href="/dashboard"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <LayoutDashboard className="w-4 h-4" /> Dashboard
                    </Link>
                    <Link
                      href="/notifications"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Bell className="w-4 h-4" /> Notifications
                      {unreadCount > 0 && (
                        <span className="ml-auto badge bg-red-100 text-red-700 text-xs">
                          {unreadCount}
                        </span>
                      )}
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="w-4 h-4" /> Log Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/login" className="btn-primary text-sm px-4 py-2 ml-3">
                Log In
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-4 space-y-1 border-t border-gray-100 mt-2 pt-2">
            {user && navLinks.map((link) => (
              <MobileNavLink
                key={link.href}
                href={link.href}
                icon={link.icon}
                label={link.label}
                badge={link.href === '/notifications' ? unreadCount : undefined}
                onClick={() => setMobileOpen(false)}
              />
            ))}
            {!user && (
              <>
                <MobileNavLink href="/report/lost" icon={PlusCircle} label="Report Lost" onClick={() => setMobileOpen(false)} />
                <MobileNavLink href="/report/found" icon={Search} label="Report Found" onClick={() => setMobileOpen(false)} />
              </>
            )}
            {user?.role === 'admin' && (
              <MobileNavLink href="/admin" icon={User} label="Admin" onClick={() => setMobileOpen(false)} />
            )}
            {!user && (
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-primary-600 font-medium hover:bg-primary-50"
              >
                Log In
              </Link>
            )}
            {user && (
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-red-600 hover:bg-red-50"
              >
                <LogOut className="w-5 h-5" /> Log Out
              </button>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

function NavLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-primary-600 transition-colors"
    >
      <Icon className="w-4 h-4" />
      {label}
    </Link>
  );
}

function MobileNavLink({
  href,
  icon: Icon,
  label,
  badge,
  onClick,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-3 rounded-lg text-gray-700 hover:bg-gray-50"
    >
      <Icon className="w-5 h-5 text-gray-500" />
      <span className="flex-1">{label}</span>
      {!!badge && badge > 0 && (
        <span className="badge bg-red-100 text-red-700 text-xs">{badge}</span>
      )}
    </Link>
  );
}

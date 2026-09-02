'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { notificationsApi } from '@/lib/api';
import { Bell, LogOut, User, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export function Navbar() {
  const { user, logout } = useAuthStore();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const fetchCount = async () => {
      try {
        const data = await notificationsApi.getUnreadCount();
        setUnreadCount(data.unread_count);
      } catch { /* silent */ }
    };

    // Clear badge when the user opens the notifications page.
    if (pathname === '/notifications') {
      notificationsApi.markAllRead().catch(() => {});
      setUnreadCount(0);
    } else {
      fetchCount();
    }

    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [user, pathname]);

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary-700">
            <span className="text-2xl">🔍</span>
            Lost & Found AI
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/report/lost" className="text-sm text-gray-600 hover:text-primary-600">
              Report Lost
            </Link>
            <Link href="/report/found" className="text-sm text-gray-600 hover:text-primary-600">
              Report Found
            </Link>
            {user && (
              <Link href="/dashboard" className="text-sm text-gray-600 hover:text-primary-600">
                Dashboard
              </Link>
            )}
            {user?.role === 'admin' && (
              <Link href="/admin" className="text-sm text-gray-600 hover:text-primary-600">
                Admin
              </Link>
            )}

            {user ? (
              <div className="flex items-center gap-4">
                <Link href="/notifications" className="relative text-gray-500 hover:text-primary-600">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <User className="w-4 h-4" />
                  {user.full_name || user.email}
                </div>
                <button
                  onClick={logout}
                  className="text-gray-400 hover:text-red-500"
                  title="Log out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <Link href="/login" className="btn-primary text-sm px-4 py-2">
                Log In
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden text-gray-600"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-4 space-y-2">
            <Link href="/report/lost" className="block py-2 text-gray-700" onClick={() => setMobileOpen(false)}>Report Lost</Link>
            <Link href="/report/found" className="block py-2 text-gray-700" onClick={() => setMobileOpen(false)}>Report Found</Link>
            {user && <Link href="/dashboard" className="block py-2 text-gray-700" onClick={() => setMobileOpen(false)}>Dashboard</Link>}
            {user?.role === 'admin' && <Link href="/admin" className="block py-2 text-gray-700" onClick={() => setMobileOpen(false)}>Admin</Link>}
            {!user && <Link href="/login" className="block py-2 text-primary-600 font-medium" onClick={() => setMobileOpen(false)}>Log In</Link>}
            {user && <button onClick={() => { logout(); setMobileOpen(false); }} className="block py-2 text-red-500">Log Out</button>}
          </div>
        )}
      </div>
    </nav>
  );
}

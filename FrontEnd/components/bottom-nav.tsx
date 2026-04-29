'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRightLeft,
  Boxes,
  Calendar,
  FolderOpen,
  Home,
  LayoutDashboard,
  ListTodo,
  Settings,
  Tags,
  UserCheck,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const pathname = usePathname();
  const isDashboard = pathname.startsWith('/dashboard');

  const inventoryItems = [
    { id: 'inv-overview', href: '/dashboard/inventory', icon: Boxes, label: 'Global' },
    { id: 'inv-items', href: '/dashboard/inventory/items', icon: ListTodo, label: 'Articles' },
    { id: 'inv-movements', href: '/dashboard/inventory/movements', icon: ArrowRightLeft, label: 'Mouv.' },
    { id: 'inv-refs', href: '/dashboard/inventory/references', icon: Tags, label: 'Refs' },
    { id: 'inv-assign', href: '/dashboard/inventory/assignments', icon: UserCheck, label: 'Affect.' },
    { id: 'inv-alerts', href: '/dashboard/inventory/alerts', icon: AlertTriangle, label: 'Alertes' },
  ];

  const projectItems = [
    { id: 'proj-dashboard', href: '/dashboard', icon: LayoutDashboard, label: 'Tableau' },
    { id: 'proj-projects', href: '/dashboard/projects', icon: FolderOpen, label: 'Projets' },
    { id: 'proj-teams', href: '/dashboard/teams', icon: Users, label: 'Equipes' },
    { id: 'proj-calendar', href: '/dashboard/calendar', icon: Calendar, label: 'Calend.' },
  ];

  const hrItems = [
    { id: 'hr-home', href: '/dashboard/hr', icon: Users, label: 'RH' },
    { id: 'hr-dashboard', href: '/dashboard', icon: LayoutDashboard, label: 'Tableau' },
  ];

  const gedItems = [
    { id: 'ged-home', href: '/dashboard/ged', icon: FolderOpen, label: 'Docs' },
    { id: 'ged-dashboard', href: '/dashboard', icon: LayoutDashboard, label: 'Tableau' },
  ];

  const adminItems = [
    { id: 'admin-billing', href: '/dashboard/billing', icon: Settings, label: 'Facture' },
    { id: 'admin-settings', href: '/dashboard/settings', icon: Settings, label: 'Config' },
    { id: 'admin-dashboard', href: '/dashboard', icon: LayoutDashboard, label: 'Tableau' },
  ];

  const defaultDashboardItems = [
    { id: 'default-dashboard', href: '/dashboard', icon: LayoutDashboard, label: 'Tableau' },
    { id: 'default-projects', href: '/dashboard/projects', icon: FolderOpen, label: 'Projets' },
    { id: 'default-hr', href: '/dashboard/hr', icon: Users, label: 'RH' },
    { id: 'default-ged', href: '/dashboard/ged', icon: FolderOpen, label: 'GED' },
    { id: 'default-inventory', href: '/dashboard/inventory', icon: Boxes, label: 'Stock' },
  ];

  const getVisibleItems = () => {
    if (!isDashboard) {
      return [{ id: 'home', href: '/', icon: Home, label: 'Accueil' }];
    }
    if (pathname.startsWith('/dashboard/inventory')) return inventoryItems;
    if (pathname.startsWith('/dashboard/projects') || pathname.startsWith('/dashboard/teams') || pathname.startsWith('/dashboard/calendar') || pathname === '/dashboard') {
      return projectItems;
    }
    if (pathname.startsWith('/dashboard/hr')) return hrItems;
    if (pathname.startsWith('/dashboard/ged')) return gedItems;
    if (pathname.startsWith('/dashboard/billing') || pathname.startsWith('/dashboard/settings')) return adminItems;
    return defaultDashboardItems;
  };

  const visibleItems = getVisibleItems().slice(0, 5);

  const isItemActive = (href: string) => {
    if (href === '/dashboard' || href === '/dashboard/inventory') {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border/50 bg-background/95 backdrop-blur z-40">
      <div className="flex items-center justify-around">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = isItemActive(item.href);

          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center w-16 h-16 gap-1 text-xs font-medium transition-colors',
                isActive
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

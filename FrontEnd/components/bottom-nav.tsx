'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AnimatedActivityIcon,
  AnimatedArrowDownUpIcon,
  AnimatedBoxesIcon,
  AnimatedFolderOpenIcon,
  AnimatedHouseIcon,
  AnimatedLayoutGridIcon,
  AnimatedLayoutListIcon,
  AnimatedSettingsIcon,
  AnimatedUserCheckIcon,
  AnimatedUsersIcon,
  CrmActivitiesNavIcon,
  CrmContactsNavIcon,
  CrmDashboardNavIcon,
  CrmLeadsNavIcon,
  CrmOpportunitiesNavIcon,
  FinanceAccountsNavIcon,
  FinanceDashboardNavIcon,
  FinanceReportsNavIcon,
  FinanceTransactionsNavIcon,
} from '@/components/crm-animate-icons';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const pathname = usePathname();
  const isDashboard = pathname.startsWith('/dashboard');

  const inventoryItems = [
    { id: 'inv-overview', href: '/dashboard/inventory', icon: AnimatedBoxesIcon, label: 'Global' },
    { id: 'inv-items', href: '/dashboard/inventory/items', icon: AnimatedLayoutListIcon, label: 'Articles' },
    { id: 'inv-movements', href: '/dashboard/inventory/movements', icon: AnimatedArrowDownUpIcon, label: 'Mouv.' },
    { id: 'inv-refs', href: '/dashboard/inventory/references', icon: AnimatedLayoutListIcon, label: 'Refs' },
    { id: 'inv-assign', href: '/dashboard/inventory/assignments', icon: AnimatedUserCheckIcon, label: 'Affect.' },
    { id: 'inv-alerts', href: '/dashboard/inventory/alerts', icon: AnimatedActivityIcon, label: 'Alertes' },
  ];

  const projectItems = [
    { id: 'proj-dashboard', href: '/dashboard', icon: AnimatedLayoutGridIcon, label: 'Tableau' },
    { id: 'proj-projects', href: '/dashboard/projects', icon: AnimatedFolderOpenIcon, label: 'Projets' },
    { id: 'proj-teams', href: '/dashboard/teams', icon: AnimatedUsersIcon, label: 'Equipes' },
    { id: 'proj-calendar', href: '/dashboard/calendar', icon: AnimatedLayoutGridIcon, label: 'Calend.' },
  ];

  const hrItems = [
    { id: 'hr-employees', href: '/dashboard/hr/employees', icon: AnimatedUsersIcon, label: 'Employes' },
    { id: 'hr-departments', href: '/dashboard/hr/departments', icon: AnimatedLayoutListIcon, label: 'Depts' },
    { id: 'hr-contracts', href: '/dashboard/hr/contracts', icon: AnimatedUserCheckIcon, label: 'Contrats' },
    { id: 'hr-leaves', href: '/dashboard/hr/leaves', icon: AnimatedActivityIcon, label: 'Conges' },
    { id: 'hr-payrolls', href: '/dashboard/hr/payrolls', icon: AnimatedSettingsIcon, label: 'Paies' },
  ];

  const gedItems = [
    { id: 'ged-home', href: '/dashboard/ged', icon: AnimatedFolderOpenIcon, label: 'Docs' },
    { id: 'ged-dashboard', href: '/dashboard', icon: AnimatedLayoutGridIcon, label: 'Tableau' },
  ];

  const crmItems = [
    { id: 'crm-home', href: '/dashboard/crm', icon: CrmDashboardNavIcon, label: 'CRM' },
    { id: 'crm-contacts', href: '/dashboard/crm/contacts', icon: CrmContactsNavIcon, label: 'Contacts' },
    { id: 'crm-leads', href: '/dashboard/crm/leads', icon: CrmLeadsNavIcon, label: 'Pistes' },
    { id: 'crm-opps', href: '/dashboard/crm/opportunities', icon: CrmOpportunitiesNavIcon, label: 'Opp.' },
    { id: 'crm-act', href: '/dashboard/crm/activities', icon: CrmActivitiesNavIcon, label: 'Act.' },
  ];

  const adminItems = [
    { id: 'admin-billing', href: '/dashboard/billing', icon: AnimatedSettingsIcon, label: 'Facture' },
    { id: 'admin-settings', href: '/dashboard/settings', icon: AnimatedSettingsIcon, label: 'Config' },
    { id: 'admin-dashboard', href: '/dashboard', icon: AnimatedLayoutGridIcon, label: 'Tableau' },
  ];

  const financeItems = [
    { id: 'fin-home', href: '/dashboard/finance', icon: FinanceDashboardNavIcon, label: 'Finance' },
    { id: 'fin-trans', href: '/dashboard/finance/transactions', icon: FinanceTransactionsNavIcon, label: 'Transac.' },
    { id: 'fin-accounts', href: '/dashboard/finance/accounts', icon: FinanceAccountsNavIcon, label: 'Comptes' },
    { id: 'fin-invoices', href: '/dashboard/finance/invoices', icon: AnimatedSettingsIcon, label: 'Factures' },
    { id: 'fin-reports', href: '/dashboard/finance/reports', icon: FinanceReportsNavIcon, label: 'Rapports' },
  ];

  const defaultDashboardItems = [
    { id: 'default-dashboard', href: '/dashboard', icon: AnimatedLayoutGridIcon, label: 'Tableau' },
    { id: 'default-projects', href: '/dashboard/projects', icon: AnimatedFolderOpenIcon, label: 'Projets' },
    { id: 'default-hr', href: '/dashboard/hr', icon: AnimatedUsersIcon, label: 'RH' },
    { id: 'default-ged', href: '/dashboard/ged', icon: AnimatedFolderOpenIcon, label: 'GED' },
    { id: 'default-inventory', href: '/dashboard/inventory', icon: AnimatedBoxesIcon, label: 'Stock' },
  ];

  const getVisibleItems = () => {
    if (!isDashboard) {
      return [{ id: 'home', href: '/', icon: AnimatedHouseIcon, label: 'Accueil' }];
    }
    if (pathname.startsWith('/dashboard/inventory')) return inventoryItems;
    if (pathname.startsWith('/dashboard/projects') || pathname.startsWith('/dashboard/teams') || pathname.startsWith('/dashboard/calendar') || pathname === '/dashboard') {
      return projectItems;
    }
    if (pathname.startsWith('/dashboard/hr')) return hrItems;
    if (pathname.startsWith('/dashboard/finance')) return financeItems;
    if (pathname.startsWith('/dashboard/ged')) return gedItems;
    if (pathname.startsWith('/dashboard/crm')) return crmItems;
    if (pathname.startsWith('/dashboard/billing') || pathname.startsWith('/dashboard/settings')) return adminItems;
    return defaultDashboardItems;
  };

  const visibleItems = getVisibleItems().slice(0, 5);

  const isItemActive = (href: string) => {
    if (href === '/dashboard' || href === '/dashboard/inventory' || href === '/dashboard/crm') {
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

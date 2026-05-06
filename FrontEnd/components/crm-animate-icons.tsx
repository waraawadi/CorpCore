'use client'

import {
  ActivityIcon,
  ArrowDownUpIcon,
  BoxesIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardIcon,
  ContactRoundIcon,
  CreditCardIcon,
  FolderOpenIcon,
  HouseIcon,
  LayoutGridIcon,
  LayoutListIcon,
  LogoutIcon,
  SettingsIcon,
  TrendingUpIcon,
  UsersIcon,
  UsersRoundIcon,
} from '@animateicons/react/lucide'
import type { LucideIcon } from 'lucide-react'

function wrapAnimateIcon(Cmp: typeof ContactRoundIcon): LucideIcon {
  const Icon = ({ className }: { className?: string }) => <Cmp size={20} className={className} />
  return Icon as LucideIcon
}

/** Icônes animées (@animateicons/react) stylées comme lucide-react pour la sidebar / bottom nav. */
export const CrmModuleIcon = wrapAnimateIcon(ContactRoundIcon)
export const CrmDashboardNavIcon = wrapAnimateIcon(LayoutGridIcon)
export const CrmContactsNavIcon = wrapAnimateIcon(UsersRoundIcon)
export const CrmLeadsNavIcon = wrapAnimateIcon(ActivityIcon)
export const CrmOpportunitiesNavIcon = wrapAnimateIcon(TrendingUpIcon)
export const CrmActivitiesNavIcon = wrapAnimateIcon(ClipboardIcon)
export const FinanceModuleIcon = wrapAnimateIcon(CreditCardIcon)
export const FinanceDashboardNavIcon = wrapAnimateIcon(LayoutGridIcon)
export const FinanceTransactionsNavIcon = wrapAnimateIcon(ArrowDownUpIcon)
export const FinanceAccountsNavIcon = wrapAnimateIcon(CreditCardIcon)
export const FinanceCategoriesNavIcon = wrapAnimateIcon(LayoutListIcon)
export const FinanceReportsNavIcon = wrapAnimateIcon(ClipboardIcon)

// Sidebar (global modules)
export const AnimatedLayoutGridIcon = wrapAnimateIcon(LayoutGridIcon)
export const AnimatedLayoutListIcon = wrapAnimateIcon(LayoutListIcon)
export const AnimatedUsersIcon = wrapAnimateIcon(UsersIcon)
export const AnimatedFolderOpenIcon = wrapAnimateIcon(FolderOpenIcon)
export const AnimatedHouseIcon = wrapAnimateIcon(HouseIcon)
export const AnimatedBoxesIcon = wrapAnimateIcon(BoxesIcon)
export const AnimatedArrowDownUpIcon = wrapAnimateIcon(ArrowDownUpIcon)
export const AnimatedSettingsIcon = wrapAnimateIcon(SettingsIcon)
export const AnimatedCreditCardIcon = wrapAnimateIcon(CreditCardIcon)
export const AnimatedActivityIcon = wrapAnimateIcon(ActivityIcon)
export const AnimatedUserCheckIcon = wrapAnimateIcon(UsersRoundIcon)
export const AnimatedLogoutIcon = wrapAnimateIcon(LogoutIcon)
export const AnimatedChevronDownIcon = wrapAnimateIcon(ChevronDownIcon)
export const AnimatedChevronLeftIcon = wrapAnimateIcon(ChevronLeftIcon)
export const AnimatedChevronRightIcon = wrapAnimateIcon(ChevronRightIcon)

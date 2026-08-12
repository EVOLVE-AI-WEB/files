/**
 * AppShell (Task 17.2, 17.3; R22.1, R20.1, R20.2, R20.4, R20.5, R20.6, R21.4).
 *
 * The real application shell that wraps every protected route (replacing the
 * temporary PlaceholderShell). It provides:
 *   - the brand header with the JPEG logo (BrandLogo) and the theme toggle,
 *   - primary navigation that is a BOTTOM bar on mobile and a SIDEBAR on larger
 *     screens (R20.4), each link a 44–48px touch target with aria-current,
 *   - a centered elevated circular gradient "+" FAB (design.md; R21.3) that
 *     opens the Calculator,
 *   - safe-area insets so nothing sits under the notch / home indicator (R20.1),
 *   - an app-wide disclaimer footer (R24).
 *
 * Navigation is keyboard operable and screen-reader labelled; active state is
 * conveyed by text weight + an indicator, never by color alone (R20.6).
 */
import {
  LayoutDashboard,
  Calculator,
  TrendingUp,
  CircleUser,
  Plus,
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { ThemeToggle } from './ThemeToggle';
import { TapScale } from '../shared/motion';
import { Disclaimer } from '../shared/Disclaimer';

type NavItem = {
  to: string;
  label: string;
  end: boolean;
  icon: LucideIcon;
};

const DASHBOARD_ITEM: NavItem = {
  to: '/',
  label: 'Dashboard',
  end: true,
  icon: LayoutDashboard,
};
const CALCULATOR_ITEM: NavItem = {
  to: '/calculator',
  label: 'Calculator',
  end: false,
  icon: Calculator,
};
const PROGRESS_ITEM: NavItem = {
  to: '/progress',
  label: 'Progress',
  end: false,
  icon: TrendingUp,
};
const PROFILE_ITEM: NavItem = {
  to: '/profile',
  label: 'Profile',
  end: false,
  icon: CircleUser,
};

const NAV_ITEMS: NavItem[] = [
  DASHBOARD_ITEM,
  CALCULATOR_ITEM,
  PROGRESS_ITEM,
  PROFILE_ITEM,
];

/** Vertical sidebar link (>= sm screens). */
function SidebarLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `flex min-h-[48px] items-center gap-3 rounded-xl px-3 text-sm font-medium ${
          isActive
            ? 'bg-slate-100 font-semibold text-brand-navy'
            : 'text-slate-500 hover:bg-slate-50'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="h-5 w-5" aria-hidden="true" />
          <span>{item.label}</span>
          {isActive ? (
            <span className="ml-auto h-2 w-2 rounded-full bg-brand-navy" aria-hidden="true" />
          ) : null}
        </>
      )}
    </NavLink>
  );
}

/** Bottom-bar link (< sm screens). */
function BottomLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `flex min-h-[48px] min-w-[48px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
          isActive ? 'font-semibold text-brand-navy' : 'text-slate-500'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className="h-5 w-5"
            aria-hidden="true"
            strokeWidth={isActive ? 2.5 : 2}
          />
          <span>{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

export function AppShell() {
  const navigate = useNavigate();

  return (
    <div className="min-h-full bg-app-bg text-brand-navy sm:flex">
      {/* Sidebar (>= sm) */}
      <aside
        className="sticky top-0 hidden h-screen w-60 flex-col gap-2 border-r border-slate-200 bg-white p-4 pt-safe sm:flex"
      >
        <div className="mb-4 px-1">
          <BrandLogo />
        </div>
        <nav aria-label="Primary" className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          <ThemeToggle withLabel className="w-full justify-start" />
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-h-full flex-1 flex-col">
        {/* Mobile header (< sm) */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 pt-safe sm:hidden">
          <BrandLogo />
          <ThemeToggle />
        </header>

        {/* Routed content */}
        <main className="flex-1 pb-28 sm:pb-8">
          <Outlet />
          <div className="mx-auto max-w-md px-6 pb-6 sm:max-w-2xl">
            <Disclaimer />
          </div>
        </main>
      </div>

      {/* Bottom navigation + FAB (< sm) */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-20 flex items-stretch border-t border-slate-200 bg-white pb-safe sm:hidden"
      >
        <BottomLink item={DASHBOARD_ITEM} />
        <BottomLink item={CALCULATOR_ITEM} />

        {/* Centered elevated circular gradient FAB (design.md; R21.3). */}
        <div className="relative flex w-16 flex-shrink-0 items-center justify-center">
          <TapScale
            type="button"
            onClick={() => navigate('/calculator')}
            aria-label="Open calculator"
            className="absolute -top-6 flex h-14 w-14 items-center justify-center rounded-full bg-fab-gradient text-white shadow-glow"
          >
            <Plus className="h-7 w-7" aria-hidden="true" />
          </TapScale>
        </div>

        <BottomLink item={PROGRESS_ITEM} />
        <BottomLink item={PROFILE_ITEM} />
      </nav>
    </div>
  );
}

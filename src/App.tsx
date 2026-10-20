import { lazy, Suspense } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/Shell';
import { Toaster } from '@/components/Toaster';
import { RouteErrorBoundary } from '@/components/ErrorBoundary';
import { PageSpinner } from '@/components/ui';
import Home from '@/pages/Home';
import Explore from '@/pages/Explore';
import EventPage from '@/pages/Event';
import Checkout from '@/pages/Checkout';
import OrderPage from '@/pages/Order';
import Tickets, { TicketDetail } from '@/pages/Tickets';
import Login from '@/pages/Login';
import { Kickbacks, Notifications, OrgProfile, Saved, SeriesPage, Settings, UserProfile } from '@/pages/Profiles';
import { Help, Legal, NotFound, Platform, Simple } from '@/pages/Info';

const DashboardLayout = lazy(() => import('@/pages/dashboard/Layout'));
const NewOrg = lazy(() => import('@/pages/dashboard/Layout').then((m) => ({ default: m.NewOrg })));
const Overview = lazy(() => import('@/pages/dashboard/Org').then((m) => ({ default: m.Overview })));
const EventsList = lazy(() => import('@/pages/dashboard/Org').then((m) => ({ default: m.EventsList })));
const Insights = lazy(() => import('@/pages/dashboard/Org').then((m) => ({ default: m.Insights })));
const Sms = lazy(() => import('@/pages/dashboard/Org').then((m) => ({ default: m.Sms })));
const Finance = lazy(() => import('@/pages/dashboard/Org').then((m) => ({ default: m.Finance })));
const OrgSettings = lazy(() => import('@/pages/dashboard/Org').then((m) => ({ default: m.OrgSettings })));
const EventManage = lazy(() => import('@/pages/dashboard/EventManage'));
const CreateEvent = lazy(() => import('@/pages/dashboard/EventEditor'));
const Scanner = lazy(() => import('@/pages/Scanner'));

export default function App() {
  return (
    <HashRouter>
      <Toaster />
      <RouteErrorBoundary>
        <Suspense fallback={<PageSpinner />}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<Home />} />
              <Route path="explore" element={<Explore />} />
              <Route path="e/:slug" element={<EventPage />} />
              <Route path="e/:slug/checkout" element={<Checkout />} />
              <Route path="orders/:id" element={<OrderPage />} />
              <Route path="tickets" element={<Tickets />} />
              <Route path="tickets/:id" element={<TicketDetail />} />
              <Route path="g/:slug" element={<OrgProfile />} />
              <Route path="u/:username" element={<UserProfile />} />
              <Route path="series/:id" element={<SeriesPage />} />
              <Route path="saved" element={<Saved />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="kickbacks" element={<Kickbacks />} />
              <Route path="settings" element={<Settings />} />
              <Route path="platform" element={<Platform />} />
              <Route path="help" element={<Help />} />
              <Route path="terms/:doc" element={<Legal />} />
              <Route path="app" element={<Simple kind="app" />} />
              <Route path="vision" element={<Simple kind="vision" />} />
              <Route path="careers" element={<Simple kind="careers" />} />
              <Route path="login" element={<Login />} />
              <Route path="*" element={<NotFound />} />
            </Route>
            <Route path="create" element={<CreateEvent />} />
            <Route path="scanner" element={<Scanner />} />
            <Route path="dashboard" element={<DashboardLayout />}>
              <Route index element={<Overview />} />
              <Route path="events" element={<EventsList />} />
              <Route path="events/:id" element={<EventManage />} />
              <Route path="events/:id/:tab" element={<EventManage />} />
              <Route path="insights" element={<Insights />} />
              <Route path="sms" element={<Sms />} />
              <Route path="finance" element={<Finance />} />
              <Route path="settings" element={<OrgSettings />} />
              <Route path="new-org" element={<NewOrg />} />
            </Route>
          </Routes>
        </Suspense>
      </RouteErrorBoundary>
    </HashRouter>
  );
}

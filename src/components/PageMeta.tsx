import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const DEFAULT_TITLE = 'Events in Bangladesh: Music, Art & Nightlife | Dekha Hobe';
const DEFAULT_DESCRIPTION = 'Find your next live music night, art show, comedy gig or community event in Bangladesh. Explore Dhaka and beyond with Dekha Hobe, a concern of Bpop Tags.';
const PUBLIC: Record<string, [string, string]> = {
  '/': [DEFAULT_TITLE, DEFAULT_DESCRIPTION],
  '/explore': ['Discover Events in Bangladesh | Dekha Hobe', 'Explore concerts, nightlife, art, comedy and community events. Filter by city, date and budget to find your next plan in Bangladesh.'],
  '/platform': ['Event Organizer Tools in Bangladesh | Dekha Hobe', 'Create an event, manage tickets, build your guest list and bring your community together with Dekha Hobe organizer tools.'],
  '/help': ['Event & Ticket Help | Dekha Hobe', 'Get help with Dekha Hobe event tickets, transfers, payments and organizer tools.'],
};
export function setPageMeta(title: string, description: string) {
  document.title = title;
  for (const [selector, value] of [
    ['meta[name="description"]', description], ['meta[property="og:title"]', title],
    ['meta[property="og:description"]', description], ['meta[name="twitter:title"]', title],
    ['meta[name="twitter:description"]', description],
  ]) document.querySelector(selector)?.setAttribute('content', value);
}
export function PageMeta() {
  const { pathname } = useLocation();
  useEffect(() => {
    const known = PUBLIC[pathname];
    // Event metadata is set when the event data arrives; it is demo content, not Event rich-result data.
    setPageMeta(...(known ?? [pathname.startsWith('/e/') ? 'Event Details | Dekha Hobe' : 'Dekha Hobe | Your plans, with a pulse', DEFAULT_DESCRIPTION]));
    document.querySelector('meta[name="robots"]')?.setAttribute('content', known ? 'index,follow,max-image-preview:large' : 'noindex,follow');
  }, [pathname]);
  return null;
}

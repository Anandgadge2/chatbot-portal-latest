import RouteRedirectLoader from '@/components/ui/RouteRedirectLoader';

export default function GlobalLoading() {
  return (
    <RouteRedirectLoader
      title="Loading application"
      message="Fetching data and preparing your workspace..."
    />
  );
}

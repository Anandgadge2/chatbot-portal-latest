import RouteRedirectLoader from '@/components/ui/RouteRedirectLoader';

export default function RouteLoading() {
  return (
    <RouteRedirectLoader
      title="Loading dashboard"
      message="Please wait while we prepare your workspace and latest operational data..."
    />
  );
}

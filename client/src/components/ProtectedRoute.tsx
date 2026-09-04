import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { PageLoader } from './Spinner';
import type { Role } from '../lib/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: Role[];
}

/**
 * A CONVENIENCE guard, not a security boundary.
 *
 * Everything this component does can be bypassed by editing JavaScript in the
 * browser, so it must never be the only thing preventing access. The real
 * enforcement is `authenticate` + `authorize(...)` on the server, and every
 * protected route here has a matching server-side guard. This exists purely so
 * users are not shown a page that will immediately fail.
 */
export const ProtectedRoute = ({ children, roles }: ProtectedRouteProps): JSX.Element => {
  const { user, initialising } = useAuthStore();
  const location = useLocation();

  // Wait for the silent refresh to settle, otherwise an authenticated user is
  // redirected to login on every hard refresh.
  if (initialising) return <PageLoader label="Restoring your session" />;

  if (!user) {
    // `state.from` lets the login page send the user back where they intended,
    // which matters most for "Add to cart -> log in -> continue checkout".
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

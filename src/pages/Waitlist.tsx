import { Navigate } from 'react-router-dom';

/**
 * The user waitlist has been removed. Any legacy link to /waitlist
 * now sends the user straight into the app.
 */
export default function Waitlist() {
  return <Navigate to="/" replace />;
}

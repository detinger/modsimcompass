import { Link } from '../../app/router';

export default function NotFound() {
  return (
    <div className="page">
      <div className="page-head">
        <h1>Page not found</h1>
        <p className="lede">This address does not match a page in ModSimCompass.</p>
      </div>
      <Link to="/" className="btn primary">Go to Home</Link>
    </div>
  );
}

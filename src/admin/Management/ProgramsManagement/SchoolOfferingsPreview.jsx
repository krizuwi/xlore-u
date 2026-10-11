const PREVIEW_COUNT = 2;

export function SchoolOfferingsPreview({ schools = [] }) {
  if (!schools.length) return <span className="am-school-offerings-empty">Not assigned</span>;
  const remaining = schools.slice(PREVIEW_COUNT);
  return <div className="am-school-offerings-preview">
    <ul>{schools.slice(0, PREVIEW_COUNT).map(school => <li key={school.id}>{school.name}</li>)}</ul>
    {remaining.length > 0 && <details className="am-school-offerings-more">
      <summary><span className="am-see-more">See more ({remaining.length})</span><span className="am-see-less">See less</span></summary>
      <ul>{remaining.map(school => <li key={school.id}>{school.name}</li>)}</ul>
    </details>}
  </div>;
}

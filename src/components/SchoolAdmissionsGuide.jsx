import { Link } from "react-router-dom";
import { CampusSources } from "../pages/CollegeGuidesPage.jsx";
import { campusGuidance, sourceReviewDate } from "../lib/college-guides.js";

export function SchoolAdmissionsGuide({ school }) {
  const campus = campusGuidance[school.id];
  const checkedAt = Date.parse(school.catalogLastCheckedAt);
  return <section className="content-card guide-section school-admissions-guide">
    <h2>Plan your application</h2>
    {campus ? <>
      <h3>Programs to explore</h3><p>{campus.program}. {campus.compare}</p>
      <h3>Admissions</h3><p>{campus.admissions}</p>
      <h3>Financial aid</h3><p>{campus.aid}</p>
      <CampusSources sources={campus.sources} />
      <p><small>Official source pages reviewed {sourceReviewDate}.</small></p>
    </> : <p>Confirm the exact campus and program, the deadline for your applicant category, and the documents you need to submit. Ask admissions whether you need an exam, interview, or portfolio for your degree.</p>}
    <p>Request the current first-term fee assessment and check which charges and supplies it covers. <Link to="/guides/college-cost-checklist">Use the college budget checklist.</Link></p>
    {Number.isFinite(checkedAt) && <p><small>Directory record last checked {new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: "Asia/Manila" }).format(checkedAt)}.</small></p>}
  </section>;
}

import { ArrowRight } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { campusGuidance, guideSummaries, sourceReviewDate } from "../lib/college-guides.js";
import { NotFoundPage } from "./NotFoundPage.jsx";
import "./CollegeGuidesPage.css";

export function GuideLinks({ guides = guideSummaries }) {
  return <div className="guide-grid">{guides.map(guide => (
    <Link className="content-card guide-tile" to={`/guides/${guide.slug}`} key={guide.slug}>
      <span className="section-kicker">{guide.category}</span>
      <h3>{guide.title}</h3>
      <p>{guide.description}</p>
      <span className="guide-link">Read guide <ArrowRight size={16} /></span>
    </Link>
  ))}</div>;
}

export function CampusSources({ sources }) {
  return <ul>{sources.map(([label, href]) => <li key={href}><a href={href}>{label}</a></li>)}</ul>;
}

function CampusComparison() {
  return <>
    <section className="content-card guide-section">
      <h2>Build your shortlist</h2>
      <ol>
        <li><strong>Confirm the degree and campus.</strong> Choose one or two programs that interest you, then check which campuses offer them for your intended intake.</li>
        <li><strong>Compare what you’ll study.</strong> Look at the subjects and practical training. A nursing applicant might ask where clinical placements take place, while an accountancy applicant might ask about internship options.</li>
        <li><strong>Check admissions and financial aid.</strong> Write down the requirements and deadlines for your applicant category. Track application, enrollment, and scholarship deadlines separately.</li>
        <li><strong>Estimate the cost and commute.</strong> Request the current fee assessment, include transport and supplies, and check the door-to-door route at class time.</li>
        <li><strong>Decide what you can confirm.</strong> Drop campuses that lack your degree. Keep schools with unanswered questions on a separate list until you can verify the details.</li>
      </ol>
      <Link className="text-btn" to="/programs">Find degree programs <ArrowRight size={16} /></Link>
    </section>
    <section className="content-card guide-section">
      <h2>Worked example for a computing applicant</h2>
      <p>A Grade 12 student from Taguig enjoys coding, plans to commute daily, and needs to stay within a budget. They compare the subjects, admissions steps, and aid options at these three campuses. Use the same steps with schools that offer your intended degree.</p>
    </section>
    {Object.entries(campusGuidance).map(([id, campus]) => <section className="content-card guide-section" key={id}>
      <span className="section-kicker">{campus.city}</span>
      <h2>{campus.name}</h2>
      <p><strong>Degrees to compare.</strong> {campus.program}.</p>
      <p>{campus.compare}</p>
      <h3>Admissions</h3><p>{campus.admissions}</p>
      <h3>Financial aid</h3><p>{campus.aid}</p>
      <CampusSources sources={campus.sources} />
      <Link className="text-btn" to={`/schools/${id}`}>View school profile <ArrowRight size={16} /></Link>
    </section>)}
    <section className="content-card guide-section">
      <h2>Decide what makes the shortlist</h2>
      <p>If two degrees appeal equally, keep both until you have estimated fees, door-to-door travel time, and the timetable. A shorter route with fewer transfers can matter more than straight-line distance. If one campus lacks a program you want, take it off the shortlist even if the commute looks convenient.</p>
      <p>Official source pages reviewed {sourceReviewDate}. Confirm current requirements and fees with each campus.</p>
    </section>
  </>;
}

const budgetRows = [
  ["Tuition and school charges", "Ask for the official term assessment for your program and year level.", "₱12,000"],
  ["Transportation", "₱80 round trip × 72 campus days.", "₱5,760"],
  ["Meals", "₱100 per campus day × 72 days.", "₱7,200"],
  ["Supplies and equipment", "Include printing, uniforms, lab supplies, and device costs as needed.", "₱3,000"],
  ["Emergency allowance", "Set aside funds for extra campus days, repairs, or fare changes.", "₱2,000"]
];

function CollegeBudget() {
  return <>
    <section className="content-card guide-section">
      <h2>Estimate a semester</h2>
      <p>Use the number of days you expect to be on campus. For this hypothetical student, four campus days a week over 18 weeks adds up to 72 days. The sample amounts are planning figures in Philippine pesos.</p>
      <div className="guide-table-wrap"><table className="guide-table">
        <caption>Sample semester budget</caption>
        <thead><tr><th scope="col">Expense</th><th scope="col">How to estimate it</th><th scope="col">Sample</th></tr></thead>
        <tbody>{budgetRows.map(([expense, how, amount]) => <tr key={expense}><th scope="row">{expense}</th><td>{how}</td><td>{amount}</td></tr>)}</tbody>
        <tfoot><tr><th scope="row" colSpan={2}>Sample total before aid</th><td>₱29,960</td></tr></tfoot>
      </table></div>
      <p>If a confirmed ₱5,000 award applies to this term, the sample balance is ₱24,960. Ask when the award is credited and what amount is due at enrollment.</p>
    </section>
    <section className="content-card guide-section">
      <h2>Questions to ask the school</h2>
      <ul>
        <li>What is the full first-term assessment for my degree, including lab fees and other charges?</li>
        <li>Which costs are paid before classes start? Are there installment dates or extra fees?</li>
        <li>Which supplies, uniforms, devices, or software will I need in my first year?</li>
        <li>What expenses can a scholarship cover and what are the conditions for renewing it?</li>
        <li>How many days a week will I need to travel, and are labs or internships on another campus?</li>
      </ul>
      <p>Keep an unknown fee marked as pending and compare two commute scenarios before deciding what you can afford.</p>
    </section>
  </>;
}

function AssessmentGuide() {
  return <>
    <section className="content-card guide-section">
      <h2>How Xlore U uses your answers</h2>
      <p>The core questions give equal-weight votes to four broad interest profiles. Follow-up choices help narrow the field and record the kind of work setting you want to explore. These choices help you look through the catalog from a starting point that reflects your answers.</p>
      <p>You can browse every school and degree in the public directories before creating an account. Use the assessment when you want a suggested direction and a result you can save.</p>
    </section>
    <section className="content-card guide-section">
      <h2>Worked example</h2>
      <ol>
        <li><strong>Read the direction.</strong> A student whose answers lean Analytical / Technical chooses software development and receives Technology &amp; Computing as their suggested cluster.</li>
        <li><strong>Compare the degrees.</strong> They review Computer Science, Information Technology, and Information Systems to see how the required subjects and projects differ.</li>
        <li><strong>Check practical fit.</strong> They narrow the list to campuses they can reach, request a current fee breakdown, and check application requirements before deciding where to apply.</li>
      </ol>
      <p>The result reflects the answers given at the time. Confirm admissions eligibility, costs, and current program availability with the school.</p>
      <Link className="text-btn" to="/programs">Explore degree programs <ArrowRight size={16} /></Link>
    </section>
  </>;
}

const guideContent = {
  "compare-colleges": CampusComparison,
  "college-cost-checklist": CollegeBudget,
  "read-your-assessment": AssessmentGuide
};

export function CollegeGuidesPage() {
  const { slug } = useParams();
  const guide = guideSummaries.find(item => item.slug === slug);
  if (slug && !guide) return <NotFoundPage />;
  const Article = guide && guideContent[guide.slug];
  return <section className="page-shell container guide-page">
    <div className="page-heading"><div>
      {guide && <Link className="back-link" to="/guides">← All college guides</Link>}
      <span className="section-kicker">{guide?.category ?? "Planning resources"}</span>
      <h1>{guide?.title ?? "College planning guides"}</h1>
      <p>{guide?.description ?? "Practical resources for senior high school students comparing colleges, programs, and budgets in Metro Manila."}</p>
    </div></div>
    {Article && <article className="guide-article"><Article /></article>}
    <section aria-label={guide ? "Related guides" : "Available guides"}>
      {guide && <h2>Keep planning</h2>}
      <GuideLinks guides={guideSummaries.filter(item => item !== guide)} />
    </section>
  </section>;
}

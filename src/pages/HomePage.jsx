import { ArrowRight, BarChart3, BookOpenCheck, MapPinned, Search, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SchoolCard } from "../components/SchoolCard.jsx";
import { SchoolLogo } from "../components/SchoolLogo.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";
import { useLiveRefresh } from "../context/EngagementContext.jsx";
import { HomepageAd } from '../components/HomepageAd.jsx';
import { GuideLinks } from './CollegeGuidesPage.jsx';
import { usePublicPageData } from '../context/PublicPageData.js';

export function HomePage() {
  const initial = usePublicPageData();
  const [schools, setSchools] = useState(initial?.schools ?? []);
  const [sampleSchool, setSampleSchool] = useState({
    id: "40000000-0000-4000-8000-000000000009",
    name: "STI College Global City",
    logoUrl: "https://thumb.wikimedia.org/wikipedia/en/thumb/1/1f/Systems_Technology_Institute.png/250px-Systems_Technology_Institute.png"
  });
  const [search, setSearch] = useState("");
  const { user } = useAuth();
  const navigate = useNavigate();
  useLiveRefresh(async signal => {
    const [result, sample] = await Promise.all([api("/schools?limit=3&sort=rating", { signal }), api("/schools/40000000-0000-4000-8000-000000000009", { signal })]);
    if (!signal.aborted) { setSchools(result.data); setSampleSchool(sample); }
  });

  useEffect(() => {
    api("/schools?limit=3&sort=rating").then((result) => setSchools(result.data)).catch(() => {});
    api("/schools/40000000-0000-4000-8000-000000000009").then(setSampleSchool).catch(() => {});
  }, []);

  const submitSearch = (event) => {
    event.preventDefault();
    navigate(`/schools${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ""}`);
  };

  const startAssessment = () => {
    if (user) {
      navigate("/assessment");
      return;
    }
    navigate("/login", {
      state: {
        from: "/assessment",
        message: "Sign in or create an account to start your personalized assessment."
      }
    });
  };

  return (
    <>
      <section className="hero">
        <div className="hero-glow hero-glow-one" /><div className="hero-glow hero-glow-two" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow"><span className="eyebrow-dot" /> Built for Metro Manila students</span>
            <h1>Find the college path <span>that fits you.</span></h1>
            <p className="hero-description">Explore colleges and degree programs in Metro Manila, compare tuition and scholarships, and get recommendations shaped by your interests, strengths, and goals—all in one clear place.</p>
            <div className="hero-cta-row">
              <button className="primary-btn large" onClick={startAssessment}><Sparkles size={19} /> Start your assessment</button>
              <Link className="secondary-btn large" to="/schools">Browse schools <ArrowRight size={18} /></Link>
            </div>
          </div>
          <div className="hero-panel-wrap" aria-hidden="true">
            <div className="hero-panel">
              <div className="panel-header"><div><span className="mini-label">Sample result</span><h2>Technology &amp; Computing</h2></div></div>
              <div className="featured-school"><SchoolLogo school={sampleSchool} /><span><strong>{sampleSchool.name}</strong><span>Bonifacio Global City, Taguig</span></span></div>
              <div className="recommendation-stats"><div><span>PROGRAM</span><strong>BS IT</strong></div><div><span>SETTING</span><strong>Urban</strong></div><div><span>FOCUS</span><strong>Technology</strong></div></div>
            </div>
          </div>
        </div>
      </section>

      <section className="search-section">
        <div className="container search-card">
          <div><span className="section-kicker">Start exploring</span><h2>Search schools and programs</h2><p>Try a school name, city, course, or field of study.</p></div>
          <form className="search-box" onSubmit={submitSearch}>
            <Search className="search-icon" size={21} />
            <input type="search" maxLength={200} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="e.g. PUP, BSIT Manila, nursing..." aria-label="Search schools and programs" />
            <button type="submit" className="search-submit" aria-label="Search directory">Search</button>
          </form>
        </div>
      </section>

      <section className="feature-section">
        <div className="container">
          <div className="section-heading"><div><span className="section-kicker">Everything in one place</span><h2>Make a confident, informed college choice.</h2></div><p>Xlore U replaces scattered searching with structured information and recommendations you can understand.</p></div>
          <div className="feature-grid">
            {[
              [Sparkles, 'Personalized assessment', 'Connect your interests and strengths to relevant program categories.', '/assessment', true],
              [BookOpenCheck, 'Program exploration', 'Review descriptions, requirements, career paths, and schools offering each program.', '/programs'],
              [BarChart3, 'School comparison', 'Compare tuition, accreditation, programs, location, and scholarships side by side.', '/comparison'],
              [MapPinned, 'Interactive institution map', 'Search schools and view their pinned locations directly on Google Maps.', '/map']
            ].map(([Icon, title, copy, path, primary]) => (
              <article className={`feature-card ${primary ? 'feature-primary' : ''}`} key={title}>
                <div className={`feature-icon ${primary ? '' : 'muted'}`}><Icon /></div><h3>{title}</h3><p>{copy}</p>
                <button className={primary ? 'feature-link' : 'text-btn feature-text-link'} onClick={() => primary ? startAssessment() : navigate(path)}>Explore <ArrowRight size={14} /></button>
              </article>
            ))}
          </div>
        </div>
      </section>

      {schools.length > 0 && (
        <section className="recommendation-section">
          <div className="container">
            <div className="section-heading recommendation-heading"><div><span className="section-kicker">Explore institutions</span><h2>Start with these Metro Manila schools.</h2></div><button className="text-btn" onClick={() => navigate('/schools')}>View all schools <ArrowRight size={14} /></button></div>
            <div className="school-grid">{schools.map((school) => <SchoolCard school={school} key={school.id} />)}</div>
          </div>
        </section>
      )}

      <section className="recommendation-section">
        <div className="container">
          <div className="section-heading"><div><span className="section-kicker">College planning guides</span><h2>Know what to check before you apply.</h2></div><Link className="text-btn" to="/guides">All guides <ArrowRight size={14} /></Link></div>
          <GuideLinks />
        </div>
      </section>
      <HomepageAd />
      <section className="assessment-cta"><div className="container"><div className="assessment-cta-card"><div><span className="section-kicker light">Your next step</span><h2>Discover your strongest direction.</h2><p>Complete a short assessment and receive ranked program and school matches you can revisit anytime.</p></div><button className="white-btn" onClick={startAssessment}><Sparkles size={18} /> Start assessment</button></div></div></section>
    </>
  );
}

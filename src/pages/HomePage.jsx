import { ArrowRight, BarChart3, BookOpenCheck, Compass, MapPinned, Search, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SchoolCard } from "../components/SchoolCard.jsx";
import { api } from "../lib/api.js";

export function HomePage() {
  const [schools, setSchools] = useState([]);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api("/schools?limit=3&sort=rating").then((result) => setSchools(result.data)).catch(() => {});
  }, []);

  const submitSearch = (event) => {
    event.preventDefault();
    navigate(`/schools${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ""}`);
  };

  return (
    <>
      <section className="hero">
        <div className="hero-glow hero-glow-one" /><div className="hero-glow hero-glow-two" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow"><span className="eyebrow-dot" /> Built for Metro Manila students</span>
            <h1>Find the college path <span>that fits you.</span></h1>
            <p className="hero-description">Explore programs, compare institutions, and get recommendations shaped by your interests, strengths, and goals—all in one clear place.</p>
            <div className="hero-cta-row">
              <button className="primary-btn large" onClick={() => navigate("/assessment")}><Sparkles size={19} /> Start your assessment</button>
              <button className="secondary-btn large" onClick={() => navigate("/schools")}>Browse schools <ArrowRight size={18} /></button>
            </div>
            <div className="hero-proof">
              <div className="proof-avatars"><div>IT</div><div>BA</div><div>NU</div></div>
              <span><strong>One profile, clearer choices</strong><span>Programs, tuition, location, and fit together.</span></span>
            </div>
          </div>
          <div className="hero-panel-wrap" aria-hidden="true">
            <div className="float-card float-card-top"><div className="float-icon"><Compass size={16} /></div><span><strong>Personalized path</strong><small>Based on your answers</small></span></div>
            <div className="hero-panel">
              <div className="panel-header"><div><span className="mini-label">Sample match</span><h2>Your top recommendation</h2></div><span className="match-score">94%</span></div>
              <div className="featured-school"><div className="featured-logo">MU</div><span><strong>Mapúa University</strong><span>Intramuros, Manila</span></span></div>
              <div className="recommendation-stats"><div><span>PROGRAM</span><strong>BS IT</strong></div><div><span>SETTING</span><strong>Urban</strong></div><div><span>FOCUS</span><strong>Technology</strong></div></div>
              <div className="fit-bars">
                {[['Interest fit', '96%', 96], ['Program fit', '92%', 92], ['Location fit', '88%', 88]].map(([label, value, width]) => <div key={label}><div className="bar-label"><span>{label}</span><strong>{value}</strong></div><div className="bar"><span style={{ width: `${width}%` }} /></div></div>)}
              </div>
            </div>
            <div className="float-card float-card-bottom"><div className="mini-avatar">✓</div><span><strong>Results ready</strong><small>Explainable recommendations</small></span></div>
          </div>
        </div>
      </section>

      <section className="search-section">
        <div className="container search-card">
          <div><span className="section-kicker">Start exploring</span><h2>Search schools and programs</h2><p>Try a school name, city, course, or field of study.</p></div>
          <form className="search-box" onSubmit={submitSearch}>
            <Search className="search-icon" size={21} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="e.g. Computer Science, Manila, nursing..." aria-label="Search schools" />
            <button className="search-submit">Search directory</button>
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
                <button className={primary ? 'feature-link' : 'text-btn feature-text-link'} onClick={() => navigate(path)}>Explore <ArrowRight size={14} /></button>
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

      <section className="assessment-cta"><div className="container"><div className="assessment-cta-card"><div><span className="section-kicker light">Your next step</span><h2>Discover your strongest direction.</h2><p>Complete a short assessment and receive ranked program and school matches you can revisit anytime.</p></div><button className="white-btn" onClick={() => navigate('/assessment')}><Sparkles size={18} /> Start assessment</button></div></div></section>
    </>
  );
}

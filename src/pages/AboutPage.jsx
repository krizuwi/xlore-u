import { BookOpen, Compass, MapPinned, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import './SupportPages.css';

const team = ['Neo Aragon V. De Villena', 'Gian Albert T. Orbase', 'Mark Justine Tibor', 'Criszouie Guile P. Tolentino'];

export function AboutPage() {
  return <article className="page-shell support-page container">
    <header className="support-heading"><span className="section-kicker">About us</span>
      <h1>Your college path, made clearer.</h1>
      <p>Xlore U helps senior high school students in Metro Manila explore schools and programs, understand their options, and make more informed college decisions. Because here at Xlore U, your future is our top priority!</p>
    </header>
    <figure className="about-team-photo"><img src="/about/xlore-u-team.png" alt="The Xlore U project team presenting their school-matching capstone project" width="2048" height="1536" fetchPriority="high" /><figcaption>The student team behind Xlore U · STI College Global City</figcaption></figure>
    <section className="support-card about-story"><span className="section-kicker">Why we built it</span><h2>One place to explore your next step</h2>
      <p>Choosing a college can mean searching many websites for programs, tuition estimates, requirements, and locations. We built Xlore U to bring these details together and help students compare options that fit their interests and circumstances.</p>
      <p>Xlore U is a Bachelor of Science in Information Technology capstone project developed by students of STI College Global City. It supports exploration—not school admissions—and leaves the final choice with the student.</p>
    </section>
    <section aria-labelledby="about-features"><h2 id="about-features">How Xlore U helps</h2><div className="about-features">
      {[[Compass, 'Discover your options', 'Use the assessment to explore programs connected to your interests.'], [BookOpen, 'Compare and save', 'Review school details and program offerings, compare options, and save your favorites.'], [MapPinned, 'Explore locations', 'Find institutions on the map and review approximate distances.'], [MessageCircle, 'Connect with schools', 'Read posts from activated institutions and join conversations through comments and replies.']].map(([Icon, title, text]) => <section className="support-card" key={title}><Icon size={25} aria-hidden="true" /><h3>{title}</h3><p>{text}</p></section>)}
    </div></section>
    <section className="support-card"><span className="section-kicker">Meet the team</span><h2>Built by students, for students</h2><ul className="about-team-names">{team.map(name => <li key={name}>{name}</li>)}</ul></section>
    <aside className="support-card support-note"><h2>A guide, not a guarantee</h2><p>Recommendations are starting points, not guarantees of admission or career success. Tuition estimates, scholarships, requirements, and program availability can change. Always confirm important details directly with the institution or a guidance counselor.</p><div className="support-actions"><Link className="primary-btn" to="/schools">Explore schools</Link><Link className="secondary-btn" to="/contact">Contact Admin</Link></div></aside>
  </article>;
}

import { ArrowRight, ChevronLeft, ChevronRight, MapPin, Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { buildDashboardSlides, DASHBOARD_SLIDE_MS, RANKING_SOURCE } from "../lib/dashboard-slides.js";
import { schoolMediaUrl } from "../lib/school-media.js";
import { SchoolLogo } from "./SchoolLogo.jsx";

export function DashboardSchoolSlideshow({ showcase, latestAssessment }) {
  const slides = buildDashboardSlides(showcase, latestAssessment);
  const [activeId, setActiveId] = useState(null);
  const [paused, setPaused] = useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  const [hidden, setHidden] = useState(document.hidden);
  const [focused, setFocused] = useState(false);
  const [failedPhotos, setFailedPhotos] = useState([]);
  const index = Math.max(0, slides.findIndex(slide => slide.id === activeId));
  const slide = slides[index];
  const photo = slide.school?.campusPhotos?.find(item => item.url && !failedPhotos.includes(item.url));
  const slideIds = slides.map(item => item.id).join(",");
  const rotationPaused = paused || focused;

  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);
  useEffect(() => {
    if (rotationPaused || hidden) return;
    const ids = slideIds.split(",");
    if (ids.length < 2) return;
    const timer = setInterval(() => setActiveId(current => ids[(Math.max(0, ids.indexOf(current)) + 1) % ids.length]), DASHBOARD_SLIDE_MS);
    return () => clearInterval(timer);
  }, [slideIds, rotationPaused, hidden]);

  function move(direction) { setActiveId(slides[(index + direction + slides.length) % slides.length].id); }
  function togglePlayback() {
    if (rotationPaused) { setPaused(false); setFocused(false); }
    else setPaused(true);
  }
  return <section className="dashboard-showcase" role="region" aria-roledescription="carousel" aria-label="School highlights"
    onFocusCapture={event => { if (!event.target.closest('[data-slideshow-playback]')) setFocused(true); }}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    {photo && <img key={photo.url} className="dashboard-showcase-photo" src={schoolMediaUrl(photo.url)} alt="" referrerPolicy="no-referrer"
      onError={() => setFailedPhotos(current => [...new Set([...current, photo.url])])} />}
    <div className="dashboard-showcase-shade" />
    <div className="dashboard-showcase-content" aria-live={rotationPaused ? "polite" : "off"} aria-atomic="true">
      <span className="dashboard-showcase-label">{slide.label}</span>
      {slide.school && slide.kind !== "assessment" && <div className="dashboard-showcase-campus"><SchoolLogo school={slide.school} /><span><MapPin size={15} /> {slide.school.city}</span></div>}
      <h2>{slide.title}</h2>
      <p>{slide.description}</p>
      {slide.kind === "ranked" && <small className="dashboard-ranking-note">Institution-level ranking, not a separate Diliman or Metro Manila league table. <a href={RANKING_SOURCE} target="_blank" rel="noreferrer">GMA News · QS Asia 2026</a></small>}
      <div className="dashboard-showcase-actions"><Link className="primary-btn compact" to={slide.to}>{slide.action} <ArrowRight size={16} /></Link>
        {slide.kind === "recommended" && <Link className="dashboard-results-link" to={`/assessment/${latestAssessment.assessmentId}/results`}>View my results <ArrowRight size={14} /></Link>}
      </div>
    </div>
    <div className="dashboard-showcase-footer">
      <div className="dashboard-showcase-credit">{photo ? <><span>{slide.kind === "assessment" && `${slide.school.name} · `}{photo.caption || "Campus facilities"}</span><small>{photo.credit && `${photo.credit} · `}{photo.sourceUrl && <a href={photo.sourceUrl} target="_blank" rel="noreferrer">Photo source</a>}{photo.license && <> · {photo.licenseUrl ? <a href={photo.licenseUrl} target="_blank" rel="noreferrer">{photo.license}</a> : photo.license}</>}</small></> : <span>Campus photos coming soon</span>}
        {slide.kind !== "assessment" && slide.school?.logoCredit?.sourceUrl && <small><a href={slide.school.logoCredit.sourceUrl} target="_blank" rel="noreferrer">Logo: {slide.school.logoCredit.credit || slide.school.name}{slide.school.logoCredit.license && ` · ${slide.school.logoCredit.license}`}</a></small>}
      </div>
      {slides.length > 1 && <div className="school-slideshow-controls"><button type="button" aria-label="Previous school highlight" onClick={() => move(-1)}><ChevronLeft size={18} /></button><span>{index + 1} / {slides.length}</span><button type="button" aria-label="Next school highlight" onClick={() => move(1)}><ChevronRight size={18} /></button><button type="button" data-slideshow-playback aria-label={rotationPaused ? "Play school highlights" : "Pause school highlights"} onClick={togglePlayback}>{rotationPaused ? <Play size={16} /> : <Pause size={16} />}</button></div>}
    </div>
  </section>;
}

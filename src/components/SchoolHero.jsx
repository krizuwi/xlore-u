import { ChevronLeft, ChevronRight, ExternalLink, MapPin, Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { SchoolLogo } from "./SchoolLogo.jsx";
import { schoolMediaUrl } from "../lib/school-media.js";

export function SchoolHero({ school, mapUrl }) {
  const photos = school.campusPhotos ?? [];
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState([]);
  const [paused, setPaused] = useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  const [hidden, setHidden] = useState(document.hidden);
  const [hovered, setHovered] = useState(false);
  const available = photos.map((_, i) => i).filter(i => !failed.includes(i));
  const availableKey = available.join(",");
  const active = available.includes(index) ? index : available[0];
  const photo = photos[active];

  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);
  useEffect(() => {
    const choices = availableKey ? availableKey.split(",").map(Number) : [];
    if (choices.length < 2 || paused || hidden || hovered) return;
    const timer = setInterval(() => setIndex(current => choices[(choices.indexOf(current) + 1) % choices.length]), 5000);
    return () => clearInterval(timer);
  }, [availableKey, paused, hidden, hovered]);

  function move(direction) { setIndex(available[(available.indexOf(active) + direction + available.length) % available.length]); }
  return <div className={`detail-hero school-photo-hero ${photo ? "has-campus-photo" : ""}`} role="region" aria-roledescription="carousel" aria-label={`${school.name} campus photos`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setHovered(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setHovered(false); }}>
    <div className="school-hero-images" aria-hidden="true">
      {photos.map((item, i) => !failed.includes(i) && <img key={item.url} src={schoolMediaUrl(item.url)} alt="" className={i === active ? "active" : ""} loading={i === 0 ? "eager" : "lazy"} referrerPolicy="no-referrer" onError={() => setFailed(current => current.includes(i) ? current : [...current, i])} />)}
    </div>
    <div className="school-hero-shade" />
    <div className="school-hero-content">
      <div className="school-hero-heading"><SchoolLogo school={school} className="school-hero-logo" /><span className="section-kicker">{school.schoolType} institution</span></div>
      <h1>{school.name}</h1>
      <p className="detail-address"><MapPin size={17} /> {school.address}, {school.city}</p>
      {school.description && <p className="detail-description">{school.description}</p>}
      <div className="detail-hero-actions"><a className="primary-btn" href={mapUrl} target="_blank" rel="noreferrer"><MapPin size={17} /> View on map <ExternalLink size={14} /></a>{school.officialWebsiteUrl && <a className="secondary-btn" href={school.officialWebsiteUrl} target="_blank" rel="noreferrer">Official website <ExternalLink size={14} /></a>}</div>
    </div>
    <div className="school-hero-footer">
      <div className="school-photo-caption">{photo ? <><span>{photo.caption || "Campus facilities"}</span><small>{photo.credit && `${photo.credit} · `}{photo.sourceUrl && <a href={photo.sourceUrl} target="_blank" rel="noreferrer">Photo source</a>}{photo.license && <> · {photo.licenseUrl ? <a href={photo.licenseUrl} target="_blank" rel="noreferrer">{photo.license}</a> : photo.license}</>}<span className="sr-only">Displayed as a cropped campus banner.</span></small></> : <span>Campus photos coming soon</span>}</div>
      {available.length > 1 && <div className="school-slideshow-controls"><button type="button" aria-label="Previous campus photo" onClick={() => move(-1)}><ChevronLeft size={18} /></button><span aria-live={paused ? "polite" : "off"}>{available.indexOf(active) + 1} / {available.length}</span><button type="button" aria-label="Next campus photo" onClick={() => move(1)}><ChevronRight size={18} /></button><button type="button" aria-label={paused ? "Play campus slideshow" : "Pause campus slideshow"} onClick={() => setPaused(current => !current)}>{paused ? <Play size={16} /> : <Pause size={16} />}</button></div>}
    </div>
    {school.logoCredit?.sourceUrl && <a className="school-logo-credit" href={school.logoCredit.sourceUrl} target="_blank" rel="noreferrer">Logo: {school.logoCredit.credit || school.name}{school.logoCredit.license && ` · ${school.logoCredit.license}`}</a>}
  </div>;
}

import { useState } from "react";
import { schoolMediaUrl } from "../lib/school-media.js";

function LogoImage({ school, className }) {
  const [failed, setFailed] = useState(false);
  const initials = school.name.split(/\s+/).filter(word => !["of", "the"].includes(word.toLowerCase())).slice(0, 3).map(word => word[0]).join("");
  return <span className={`school-logo ${className}`}>
    {school.logoUrl && !failed
      ? <img src={schoolMediaUrl(school.logoUrl)} alt={`${school.name} logo`} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      : <span aria-label={school.name}>{initials}</span>}
  </span>;
}

export function SchoolLogo({ school, className = "" }) {
  return <LogoImage key={`${school.id}:${school.logoUrl}`} school={school} className={className} />;
}

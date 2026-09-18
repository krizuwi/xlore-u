import { ExternalLink, MapPin, School, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorMessage, LoadingState } from "../components/Feedback.jsx";
import { api } from "../lib/api.js";

export function MapPage() {
  const [search, setSearch] = useState("");
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams({ limit: "50", sort: "name" });
        if (search.trim()) query.set("search", search.trim());
        const response = await api(`/schools?${query}`);
        if (cancelled) return;
        setSchools(response.data);
        setSelectedSchool((current) => response.data.find((school) => school.id === current?.id) ?? response.data[0] ?? null);
      } catch (requestError) {
        if (!cancelled) setError(requestError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [search]);

  const mapUrls = useMemo(() => {
    if (!selectedSchool) return null;
    const coordinates = `${selectedSchool.latitude},${selectedSchool.longitude}`;
    const fullAddress = `${selectedSchool.name}, ${selectedSchool.address}, ${selectedSchool.city}`;
    return {
      embed: `https://www.google.com/maps?q=${encodeURIComponent(coordinates)}&z=16&output=embed`,
      external: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
    };
  }, [selectedSchool]);

  return (
    <section className="page-shell map-page">
      <div className="container">
        <div className="page-heading">
          <div>
            <span className="section-kicker">Institution map</span>
            <h1>Find schools on the map.</h1>
            <p>Search the Xlore U directory and view each institution’s pinned location using Google Maps.</p>
          </div>
          <div className="map-count"><MapPin size={16} /><strong>{schools.length}</strong> locations shown</div>
        </div>

        <ErrorMessage message={error} />
        <div className="map-search-box">
          <Search size={20} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by institution, city, or program..." aria-label="Search institutions on the map" />
          {search && <button onClick={() => setSearch("")}>Clear</button>}
        </div>

        <div className="map-layout">
          <aside className="map-results-panel">
            <div className="map-results-heading"><strong>Search results</strong><span>{schools.length} schools</span></div>
            {loading ? <LoadingState label="Finding institutions..." /> : schools.length ? (
              <div className="map-results-list">
                {schools.map((school) => (
                  <button className={`map-result ${selectedSchool?.id === school.id ? "selected" : ""}`} onClick={() => setSelectedSchool(school)} key={school.id}>
                    <span className="map-result-pin"><MapPin size={17} /></span>
                    <span><strong>{school.name}</strong><small>{school.address}, {school.city}</small><em>{school.schoolType} · {school.programs.length} programs</em></span>
                  </button>
                ))}
              </div>
            ) : <div className="map-no-results"><Search /><strong>No institutions found</strong><span>Try another school, city, or program.</span></div>}
          </aside>

          <div className="map-canvas-card">
            {selectedSchool && mapUrls ? (
              <>
                <div className="map-selected-bar">
                  <div>
                    <span className="map-selected-logo">
                      <img
                        key={selectedSchool.id}
                        src={`/school-logos/${selectedSchool.id}.png`}
                        alt={`${selectedSchool.name} logo`}
                        onError={(event) => {
                          if (event.currentTarget.dataset.fallback) return;
                          event.currentTarget.dataset.fallback = "true";
                          event.currentTarget.src = "/school-logos/placeholder.svg";
                        }}
                      />
                    </span>
                    <span><small>Selected institution</small><strong>{selectedSchool.name}</strong><em>{selectedSchool.address}, {selectedSchool.city}</em></span>
                  </div>
                  <div className="map-selected-actions">
                    <Link to={`/schools/${selectedSchool.id}`}><School size={14} /> View School</Link>
                    <a href={mapUrls.external} target="_blank" rel="noreferrer">Google Maps <ExternalLink size={14} /></a>
                  </div>
                </div>
                <iframe
                  key={selectedSchool.id}
                  title={`${selectedSchool.name} location on Google Maps`}
                  src={mapUrls.embed}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </>
            ) : <div className="map-placeholder"><MapPin /><h2>Select an institution</h2><p>Choose a result to display its pinned Google Maps location.</p></div>}
          </div>
        </div>
      </div>
    </section>
  );
}

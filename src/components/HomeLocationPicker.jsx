import { useEffect, useRef, useState } from 'react';
import { LocateFixed, MapPin, Trash2 } from 'lucide-react';
import { validHomePoint } from '../lib/home-location.js';
import 'leaflet/dist/leaflet.css';

function HomePinMap({ value, onChange, disabled }) {
  const container = useRef(null), mapRef = useRef(null), markerRef = useRef(null);
  const latest = useRef({ value, onChange, disabled });
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  useEffect(() => { latest.current = { value, onChange, disabled }; }, [value, onChange, disabled]);

  useEffect(() => {
    let disposed = false;
    import('leaflet').then(L => {
      if (disposed) return;
      const point = validHomePoint(latest.current.value);
      const map = L.map(container.current, { scrollWheelZoom: false }).setView(
        point ? [point.latitude, point.longitude] : [14.5995, 120.9842], point ? 16 : 11);
      mapRef.current = map;
      // Browser-managed caching and attribution; no geocoder, prefetch or proxy.
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, referrerPolicy: 'strict-origin-when-cross-origin',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
      }).on('tileerror', () => { if (!disposed) setError('Map images could not load. You can still enter coordinates below.'); }).addTo(map);
      const icon = L.divIcon({ className: 'home-pin-icon', html: '<span aria-hidden="true">●</span>', iconSize: [30, 30], iconAnchor: [15, 15] });
      const place = current => {
        const coords = validHomePoint(current);
        if (!coords) { if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; } return; }
        const position = [coords.latitude, coords.longitude];
        if (!markerRef.current) {
          markerRef.current = L.marker(position, { icon, draggable: !latest.current.disabled,
            title: 'Selected home pin — drag to adjust', alt: 'Selected home location' }).addTo(map);
          markerRef.current.on('dragend', () => {
            if (latest.current.disabled) return;
            const next = markerRef.current.getLatLng().wrap();
            latest.current.onChange({ latitude: next.lat, longitude: next.lng, confirmed: false });
          });
          map.setView(position, 16);
        } else markerRef.current.setLatLng(position);
        if (!map.getBounds().contains(position)) map.panTo(position);
        if (latest.current.disabled) markerRef.current.dragging.disable(); else markerRef.current.dragging.enable();
      };
      map.on('click', event => {
        if (!latest.current.disabled) latest.current.onChange({ latitude: event.latlng.lat, longitude: event.latlng.wrap().lng, confirmed: false });
      });
      mapRef.current.placeHomePin = place;
      place(latest.current.value);
      setReady(true);
    }).catch(() => { if (!disposed) setError('The map could not load. You can still enter coordinates below.'); });
    return () => { disposed = true; mapRef.current?.remove(); mapRef.current = null; markerRef.current = null; };
  }, []);

  useEffect(() => { if (ready) mapRef.current?.placeHomePin(value); }, [value, disabled, ready]);

  return <>
    <div className="home-location-map" ref={container} role="region" aria-label="Choose your home pin on the map" />
    {error && <p role="status" className="home-location-help">{error}</p>}
    <button className="secondary-btn" type="button" disabled={!ready || disabled} onClick={() => {
      const point = mapRef.current.getCenter();
      onChange({ latitude: point.lat, longitude: point.wrap().lng, confirmed: false });
    }}>Use map center as home pin</button>
  </>;
}

export function HomeLocationPicker({ value, onChange, disabled, address }) {
  const [mapOpen, setMapOpen] = useState(false), [locating, setLocating] = useState(false), [error, setError] = useState('');
  const active = useRef(true);
  const requestState = useRef({ address, value, disabled });
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { requestState.current = { address, value, disabled }; }, [address, value, disabled]);
  const point = validHomePoint(value);
  const locate = () => {
    setError('');
    if (!navigator.geolocation) { setError('Location access is unavailable. Place a pin on the map or enter coordinates.'); return; }
    const requestedAddress = address;
    const requestedValue = value;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(position => {
      if (!active.current) return;
      setLocating(false);
      if (requestState.current.address !== requestedAddress || requestState.current.disabled
          || requestState.current.value !== requestedValue) return;
      onChange({ latitude: position.coords.latitude, longitude: position.coords.longitude, confirmed: false });
      setError(`Device accuracy: about ${Math.round(position.coords.accuracy)} m. Adjust the pin if needed and confirm only if this is your home.`);
    }, () => {
      if (!active.current) return;
      setLocating(false);
      setError('Your device location was unavailable or permission was denied. You can still choose a pin manually.');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };

  return <section className="content-card profile-card home-location-card">
    <div className="profile-card-heading"><span className="profile-card-icon"><MapPin size={21} /></span>
      <div><h2>Home location <small>(optional)</small></h2><p>Confirm a pin for {address || 'your home address'}. School distances use this point, not a city center. These are straight-line estimates, not travel distances.</p></div>
    </div>
    <p className="home-location-help">Your pin is private to your account and is saved only when you choose Save changes. Changing your address clears the old pin. No continuous location tracking.</p>
    <div className="home-location-actions">
      <button className="secondary-btn" type="button" disabled={disabled} onClick={() => setMapOpen(open => !open)}>{mapOpen ? 'Hide map' : 'Choose home pin on map'}</button>
      <button className="secondary-btn" type="button" disabled={disabled || locating} onClick={locate}><LocateFixed size={16} />{locating ? 'Finding location…' : 'I’m at home — use device location'}</button>
      {value && <button className="text-btn" type="button" disabled={disabled} onClick={() => { onChange(null); setError(''); }}><Trash2 size={15} /> Remove pin</button>}
    </div>
    {mapOpen && <>
      <p className="home-location-help">Pan and zoom to your home, then click to place the pin or drag it to adjust. Keyboard users can move the map with arrow keys and choose its center. Loading the map shares the viewed map area with OpenStreetMap; your typed address is not sent.</p>
      <HomePinMap value={value} onChange={onChange} disabled={disabled} />
    </>}
    <details className="home-location-coordinates"><summary>Enter or review coordinates</summary>
      <div className="home-coordinate-fields">
        <label><span>Home latitude</span><input name="homeLatitude" type="number" min="-90" max="90" step="any" value={value?.latitude ?? ''} disabled={disabled} onChange={event => onChange({ latitude: event.target.value, longitude: value?.longitude ?? '', confirmed: false })} /></label>
        <label><span>Home longitude</span><input name="homeLongitude" type="number" min="-180" max="180" step="any" value={value?.longitude ?? ''} disabled={disabled} onChange={event => onChange({ latitude: value?.latitude ?? '', longitude: event.target.value, confirmed: false })} /></label>
      </div>
    </details>
    <label className="home-location-confirm"><input name="homeLocationConfirmed" type="checkbox" checked={value?.confirmed === true} disabled={disabled || !point} required={Boolean(value)} onChange={event => onChange({ ...value, confirmed: event.target.checked })} /><span>I confirm that this pin is my home location.</span></label>
    <p className="home-location-help" role="status">{point ? `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)} · ${value.confirmed ? 'Confirmed — save changes to keep this pin.' : 'Please check and confirm the pin before saving.'}` : 'No home pin selected. Existing city-center estimates remain labeled as city estimates.'}</p>
    {error && <p className="home-location-help" role="status">{error}</p>}
  </section>;
}

import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from "lucide-react";
import { useState } from "react";
import { SchoolLogo } from "../../components/SchoolLogo.jsx";
import { api } from "../../lib/api.js";
import { schoolMediaUrl } from "../../lib/school-media.js";

const emptyPhoto = () => ({ url: "", caption: "", credit: "", sourceUrl: "", license: "", licenseUrl: "" });
export function SchoolMediaFields({ media, onChange, school, onBusyChange }) {
  const [uploadError, setUploadError] = useState("");
  async function upload(event, target) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) { setUploadError("Choose a PNG, JPEG or WebP image up to 5 MB."); return; }
    onBusyChange(true); setUploadError("");
    try {
      const result = await api(`/admin/schools/${school.id}/media/assets`, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      if (target === "logo") onChange({ ...media, logoUrl: result.url, logoCredit: {} });
      else onChange({ ...media, campusPhotos: [...media.campusPhotos, { ...emptyPhoto(), url: result.url }] });
    } catch (error) { setUploadError(error.message); } finally { onBusyChange(false); }
  }
  function updatePhoto(index, field, value) { onChange({ ...media, campusPhotos: media.campusPhotos.map((photo, i) => i === index ? { ...photo, [field]: value } : photo) }); }
  function move(index, direction) {
    const photos = [...media.campusPhotos];
    [photos[index], photos[index + direction]] = [photos[index + direction], photos[index]];
    onChange({ ...media, campusPhotos: photos });
  }
  return <section className="am-school-media">
    <h3>School logo & campus photos</h3>
    <p className="am-preview-note">Upload PNG, JPEG or WebP images up to 5 MB, or paste direct HTTPS image links. Use images you own or have permission to display. Uploaded images are public school-directory assets. Up to 10 photos rotate every 5 seconds; their order below is the slideshow order. Click Save university to apply changes. Scraping will not overwrite them.</p>
    <div className="am-media-logo-row"><SchoolLogo school={{ id: school?.id ?? "new", name: school?.name || "School", logoUrl: media.logoUrl }} /><label className="am-field">Logo image URL<input type="text" maxLength={2000} placeholder="https://example.edu/logo.png" value={media.logoUrl ?? ""} onChange={event => onChange({ ...media, logoUrl: event.target.value })} /></label></div>
    {school?.id && <label className="am-button am-button-secondary am-image-upload">Upload logo<input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Upload school logo" onChange={event => upload(event, "logo")} /></label>}
    <div className="am-form-grid"><label className="am-field">Logo credit / owner<input maxLength={200} value={media.logoCredit.credit ?? ""} onChange={event => onChange({ ...media, logoCredit: { ...media.logoCredit, credit: event.target.value } })} /></label><label className="am-field">Logo source page<input type="url" maxLength={2000} value={media.logoCredit.sourceUrl ?? ""} onChange={event => onChange({ ...media, logoCredit: { ...media.logoCredit, sourceUrl: event.target.value } })} /></label></div>
    <div className="am-form-grid"><label className="am-field">Logo license<input maxLength={100} value={media.logoCredit.license ?? ""} onChange={event => onChange({ ...media, logoCredit: { ...media.logoCredit, license: event.target.value } })} /></label><label className="am-field">Logo license URL<input type="url" maxLength={2000} value={media.logoCredit.licenseUrl ?? ""} onChange={event => onChange({ ...media, logoCredit: { ...media.logoCredit, licenseUrl: event.target.value } })} /></label></div>
    {media.campusPhotos.map((photo, index) => <div className="am-campus-photo-editor" key={index}>
      <div className="am-photo-editor-heading"><strong>Campus photo {index + 1}</strong><div><button type="button" className="am-button am-button-secondary" disabled={index === 0} aria-label={`Move photo ${index + 1} earlier`} onClick={() => move(index, -1)}><ArrowUp size={14} /></button><button type="button" className="am-button am-button-secondary" disabled={index === media.campusPhotos.length - 1} aria-label={`Move photo ${index + 1} later`} onClick={() => move(index, 1)}><ArrowDown size={14} /></button><button type="button" className="am-button am-button-danger" aria-label={`Remove photo ${index + 1}`} onClick={() => onChange({ ...media, campusPhotos: media.campusPhotos.filter((_, i) => i !== index) })}><Trash2 size={14} /></button></div></div>
      {photo.url && <div key={photo.url} className="am-campus-photo-preview"><img src={schoolMediaUrl(photo.url)} alt={photo.caption || `Photo ${index + 1} preview`} loading="lazy" referrerPolicy="no-referrer" onError={event => { event.currentTarget.hidden = true; event.currentTarget.nextElementSibling.hidden = false; }} /><span hidden>Image could not load. Check the image link.</span></div>}
      <label className="am-field">Photo image URL<input required type="text" maxLength={2000} value={photo.url} onChange={event => updatePhoto(index, "url", event.target.value)} /></label>
      <div className="am-form-grid"><label className="am-field">Facility / caption<input maxLength={200} value={photo.caption} onChange={event => updatePhoto(index, "caption", event.target.value)} /></label><label className="am-field">Photographer / credit<input maxLength={200} value={photo.credit} onChange={event => updatePhoto(index, "credit", event.target.value)} /></label></div>
      <label className="am-field">Photo source page<input type="url" maxLength={2000} value={photo.sourceUrl} onChange={event => updatePhoto(index, "sourceUrl", event.target.value)} /></label>
      <div className="am-form-grid"><label className="am-field">License / permission<input maxLength={100} placeholder="CC BY-SA 4.0 or permission from school" value={photo.license} onChange={event => updatePhoto(index, "license", event.target.value)} /></label><label className="am-field">License URL<input type="url" maxLength={2000} value={photo.licenseUrl} onChange={event => updatePhoto(index, "licenseUrl", event.target.value)} /></label></div>
    </div>)}
    <div className="am-campus-photo-actions">
      <button type="button" className="am-button am-button-secondary" disabled={media.campusPhotos.length >= 10} onClick={() => onChange({ ...media, campusPhotos: [...media.campusPhotos, emptyPhoto()] })}><ImagePlus size={16} /> Add campus photo</button>
      {school?.id && media.campusPhotos.length < 10 && <label className="am-button am-button-secondary am-image-upload">Upload campus photo<input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Upload campus photo" onChange={event => upload(event, "photo")} /></label>}
    </div>
    {!school?.id && <p className="am-preview-note">Save the new university first to enable file uploads.</p>}
    {uploadError && <p role="alert" className="am-media-upload-error">{uploadError}</p>}
    {!media.campusPhotos.length && <p className="am-preview-note">No photos added. A neutral banner will display until photos are provided.</p>}
  </section>;
}

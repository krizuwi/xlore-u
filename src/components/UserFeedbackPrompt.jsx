import { UnsavedForm } from "./UnsavedForm.jsx";
import { useUnsavedChanges } from "../context/UnsavedChangesContext.jsx";
import { useFeedbackExperienceTracker } from "../context/FeedbackExperienceContext.jsx";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { CheckCircle2, MessageSquare, Star, X } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";
import { feedbackDismissKey, feedbackExit, feedbackPage, feedbackLabels, shouldPromptFeedback } from "../lib/user-feedback.js";
import { ErrorMessage } from "./Feedback.jsx";
import "./UserFeedbackPrompt.css";

function readDismissed(key) {
  try { return sessionStorage.getItem(key) === "1"; } catch { return false; }
}
function dismiss(key) {
  try { sessionStorage.setItem(key, "1"); } catch { /* Feedback still works without browser storage. */ }
}

function FeedbackDialog({ prompt, onClose }) {
  const { requestDiscard } = useUnsavedChanges();
  const ref = useRef(null);
  const [rating, setRating] = useState(0), [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [releaseId, setReleaseId] = useState(prompt.releaseId), [submitted, setSubmitted] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  async function submit(event) {
    event.preventDefault();
    if (busy || !rating) return;
    setBusy(true); setError("");
    try {
      const result = await api("/feedback", { method: "POST", body: JSON.stringify({
        section: prompt.section, schoolId: prompt.schoolId, rating, comment, releaseId
      }) });
      setAlreadySubmitted(result.alreadySubmitted); setSubmitted(true);
    } catch (err) {
      if (err.status === 409) {
        try {
          const status = await api("/feedback/status");
          setReleaseId(status.releaseId);
          if (status.submittedSections.includes(prompt.section)) { setAlreadySubmitted(true); setSubmitted(true); }
          else setError("The site was updated. Your draft is kept—select Send feedback again for the new version.");
        } catch { setError(err.message); }
      } else setError(err.message || "Feedback could not be sent. Please try again.");
    } finally { setBusy(false); }
  }
  const close = () => {
    if (!busy) requestDiscard(() => {
      dismiss(feedbackDismissKey(prompt.userId, releaseId, prompt.section)); onClose();
    }, ref.current);
  };
  return <dialog ref={ref} className="user-feedback-dialog" aria-labelledby="user-feedback-title" aria-describedby="user-feedback-description"
    onCancel={event => { event.preventDefault(); close(); }}>
    <button className="feedback-close" type="button" aria-label="Close feedback" disabled={busy} onClick={close}><X size={20} /></button>
    <span className="feedback-dialog-icon">{submitted ? <CheckCircle2 size={27} /> : <MessageSquare size={27} />}</span>
    {submitted ? <>
      <h2 id="user-feedback-title">{alreadySubmitted ? "Feedback already received" : "Thank you for your feedback!"}</h2>
      <p id="user-feedback-description">{alreadySubmitted ? "Your original rating and comment were kept." : "The admin team can now review your rating and comment."} You can rate this section again after an update.</p>
      <button className="primary-btn" type="button" autoFocus onClick={close}>Continue exploring</button>
    </> : <>
      <span className="section-kicker">{feedbackLabels[prompt.section]} feedback</span>
      <h2 id="user-feedback-title">How was your experience?</h2>
      <p id="user-feedback-description">Help us improve this section. Choose 1–5 stars, with 5 being the highest. Your feedback is visible only to admins.</p>
      <UnsavedForm onSubmit={submit}>
        <fieldset disabled={busy} className="feedback-fieldset" aria-busy={busy}>
          <div className="feedback-stars" role="radiogroup" aria-label="Star rating">
            {[1, 2, 3, 4, 5].map(stars => <label key={stars} className={`feedback-star${rating >= stars ? " is-selected" : ""}`}>
              <input type="radio" name="feedback-rating" value={stars} checked={rating === stars} onChange={() => setRating(stars)} aria-label={`${stars} ${stars === 1 ? "star" : "stars"}`} required />
              <Star size={34} aria-hidden="true" />
            </label>)}
          </div>
          <p className="feedback-rating-caption" aria-live="polite">{rating ? `${rating} out of 5 stars` : "Choose your rating"}</p>
          <label className="feedback-comment-label" htmlFor="user-feedback-comment">Your comment <span>(optional)</span></label>
          <textarea id="user-feedback-comment" value={comment} onChange={event => setComment(event.target.value)} maxLength={1000} rows={4} placeholder="What worked well, or what can we improve?" />
          <span className="feedback-comment-count">{comment.length}/1,000</span>
          <ErrorMessage message={error} />
          <div className="feedback-dialog-actions">
            <button className="secondary-btn" type="button" onClick={close}>Not now</button>
            <button className="primary-btn" type="submit" disabled={!rating || busy}>{busy ? "Sending…" : "Send feedback"}</button>
          </div>
        </fieldset>
      </UnsavedForm>
      <p className="feedback-cycle-note">One feedback per section for this update. A new deployment lets you give feedback again.</p>
    </>}
  </dialog>;
}

// Observe completed SPA navigation instead of blocking it. This works for the
// browser Back button, page Back links, menu links, and programmatic navigation.
export function UserFeedbackPrompt() {
  const tracker = useFeedbackExperienceTracker();
  const { user } = useAuth(), { pathname } = useLocation();
  const previous = useRef(null), [prompt, setPrompt] = useState(null);
  const userId = user?.role !== "admin" ? user?.id : null;
  useEffect(() => {
    const last = previous.current;
    previous.current = { pathname, userId };
    const finished = last && last.pathname !== pathname
      ? tracker?.consume(last.userId, last.pathname) : false;
    if (!userId || last?.userId !== userId) { setPrompt(null); return; }
    if (finished && feedbackPage(last.pathname)?.section === feedbackPage(pathname)?.section)
      tracker.complete(userId, pathname);
    if (prompt || /^\/(?:admin|login|register)(?:\/|$)/.test(pathname)) return;
    const exit = feedbackExit(last.pathname, pathname);
    if (!exit || !finished) return;
    const controller = new AbortController();
    api("/feedback/status", { signal: controller.signal }).then(status => {
      const key = feedbackDismissKey(userId, status.releaseId, exit.section);
      if (!controller.signal.aborted && shouldPromptFeedback(status, exit.section, readDismissed(key)))
        setPrompt({ ...exit, userId, releaseId: status.releaseId });
    }).catch(() => { /* A feedback outage must never stop normal navigation. */ });
    return () => controller.abort();
  }, [pathname, userId, prompt, tracker]);
  if (!prompt || userId !== prompt.userId) return null;
  return <FeedbackDialog key={`${prompt.userId}:${prompt.releaseId}:${prompt.section}`} prompt={prompt} onClose={() => setPrompt(null)} />;
}

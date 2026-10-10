import { UnsavedForm } from "../../components/UnsavedForm.jsx";
import { useState } from "react";
import { Eye, Plus, Trash2 } from "lucide-react";
import { adminWrite, useAdminResource } from "../lib/adminApi.js";
import { ArchiveDialog, Notice } from "../Management/LiveCatalogShared.jsx";
import { Badge, Dialog, Empty, PageFooter, PageHeading, RowActions, SearchField, matches } from "../Management/shared.jsx";
import "../Management/management.css";

const tags = ["technology", "analytical", "science", "health", "business", "creative", "communication", "social"];
const newOption = () => ({ id: crypto.randomUUID(), label: "", scores: { technology: 3 } });

function QuestionEditor({ item, onClose, onSaved }) {
  const [options, setOptions] = useState(item?.options ?? [newOption(), newOption()]);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  function change(index, update) { setOptions(current => current.map((o, i) => i === index ? { ...o, ...update } : o)); }
  async function save(event) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setError("");
    try { const result = await adminWrite(item ? `/questions/${item.id}` : "/questions", item ? "PUT" : "POST", { ...values, options }); onSaved(result.message); onClose(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <Dialog title={item ? "Edit assessment question" : "Add assessment question"} onClose={() => { if (!busy) onClose(); }} wide><UnsavedForm onSubmit={save}><fieldset className="am-dialog-body am-live-fieldset" disabled={busy}>
    <label className="am-field">Question *<textarea name="prompt" required maxLength={350} defaultValue={item?.prompt ?? ""} rows={3} autoFocus /></label><label className="am-field">Status<select name="status" defaultValue={item?.status === "Active" ? "Active" : "Draft"}><option>Draft</option><option>Active</option></select></label>
    <p className="am-description">Active questions appear in the student assessment. Each answer's interest weights determine its contribution to recommendations; use 0–5 points per interest.</p>
    {options.map((option, index) => <section className="am-card am-dialog-body" key={option.id}><label className="am-field">Answer {index + 1}<input required maxLength={180} value={option.label} onChange={e => change(index, { label: e.target.value })} /></label><details><summary>Interest weights</summary><div className="am-weight-grid">{tags.map(tag => <label className="am-field" key={tag}>{tag}<input aria-label={`Answer ${index + 1} ${tag} points`} type="number" min="0" max="5" step="1" required value={option.scores[tag] ?? 0} onChange={e => change(index, { scores: { ...option.scores, [tag]: Number(e.target.value) } })} /></label>)}</div></details><button type="button" className="am-button am-button-secondary" disabled={options.length <= 2} onClick={() => setOptions(current => current.filter(o => o.id !== option.id))}><Trash2 size={14} />Remove answer</button></section>)}
    <button type="button" className="am-button am-button-secondary" disabled={options.length >= 6} onClick={() => setOptions(current => [...current, newOption()])}><Plus size={14} />Add answer</button><Notice error>{error}</Notice>
    </fieldset><div className="am-dialog-actions"><button type="button" data-discard className="am-button am-button-secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="am-button" disabled={busy}>{busy ? "Saving…" : "Save question"}</button></div></UnsavedForm></Dialog>;
}

function Preview({ questions, onClose }) {
  const [step, setStep] = useState(0), [choice, setChoice] = useState("");
  const question = questions[step];
  return <Dialog title="Assessment preview" onClose={onClose}><div className="am-dialog-body"><p>Question {step + 1} of {questions.length}. Preview answers are not saved.</p><h3>{question.prompt}</h3>{question.options.map(o => <label className="am-field" key={o.id}><span><input type="radio" name="preview-answer" checked={choice === o.id} onChange={() => setChoice(o.id)} /> {o.label}</span></label>)}</div><div className="am-dialog-actions"><button className="am-button am-button-secondary" disabled={!step} onClick={() => { setStep(value => value - 1); setChoice(""); }}>Back</button><button className="am-button" disabled={!choice} onClick={() => { if (step === questions.length - 1) onClose(); else { setStep(value => value + 1); setChoice(""); } }}>{step === questions.length - 1 ? "Finish preview" : "Next"}</button></div></Dialog>;
}

export function AssessmentManagement({ searchQuery = "" }) {
  const resource = useAdminResource("/questions");
  const questions = resource.data?.data ?? [];
  const [query, setQuery] = useState(""), [status, setStatus] = useState(""), [page, setPage] = useState(1), [modal, setModal] = useState(null), [notice, setNotice] = useState("");
  const filtered = questions.filter(q => [query, searchQuery].every(value =>
    matches([q.prompt, q.options.map(o => o.label), q.status], value)
  ) && (!status || status === q.status));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 6)));
  const active = questions.filter(q => q.status === "Active");
  function saved(message) { setNotice(message); resource.refresh(); }
  return <section className="am-page"><PageHeading title="Assessment Management" section="Assessment" description="Manage the questions and answer weights used by the student assessment." action="Add Question" onAction={() => setModal({ mode: "edit" })} dataLabel="Live question bank" />
    <Notice>{notice}</Notice><Notice error>{resource.error}</Notice>
    <div className="am-card"><div className="am-card-toolbar"><SearchField value={query} onChange={v => { setQuery(v); setPage(1); }} placeholder="Search assessment questions..." /><select aria-label="Question status" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option><option>Active</option><option>Draft</option><option>Archived</option></select><button className="am-button am-button-secondary" disabled={!active.length} onClick={() => setModal({ mode: "preview", questions: active })}><Eye size={14} />Preview assessment</button><button className="am-button am-button-secondary" disabled={resource.loading} onClick={resource.refresh}>Refresh</button></div>
      {resource.loading && <p className="am-loading">Loading questions…</p>}
      <div className="am-table-scroll"><table className="am-table"><thead><tr><th>Question</th><th>Answers</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.slice((currentPage - 1) * 6, currentPage * 6).map(q => <tr key={q.id}><td>{q.prompt}</td><td>{q.options.length}</td><td><Badge>{q.status}</Badge></td><td><RowActions name={q.prompt} onEdit={() => setModal({ mode: "edit", item: q })} onView={() => setModal({ mode: "preview", questions: [q] })} deleteLabel="Archive" onDelete={q.status !== "Archived" ? () => setModal({ mode: "archive", item: q }) : undefined} /></td></tr>)}</tbody></table></div>{!resource.loading && !filtered.length && <Empty />}<PageFooter count={filtered.length} page={currentPage} pageSize={6} setPage={setPage} />
    </div>
    {modal?.mode === "edit" && <QuestionEditor item={modal.item} onClose={() => setModal(null)} onSaved={saved} />}
    {modal?.mode === "preview" && <Preview questions={modal.questions} onClose={() => setModal(null)} />}
    {modal?.mode === "archive" && <ArchiveDialog name={modal.item.prompt} path={`/questions/${modal.item.id}`} onClose={() => setModal(null)} onSaved={saved} />}
  </section>;
}

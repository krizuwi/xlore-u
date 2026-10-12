import { UnsavedForm } from "../../components/UnsavedForm.jsx";
import { useState } from "react";
import { ArrowDown, ArrowUp, Eye, Plus, Trash2 } from "lucide-react";
import { adminWrite, useAdminResource } from "../lib/adminApi.js";
import { ArchiveDialog, Notice } from "../Management/LiveCatalogShared.jsx";
import { Badge, Dialog, Empty, PageFooter, PageHeading, RowActions, SearchField, matches } from "../Management/shared.jsx";
import "../Management/management.css";
import { AnswerMappingField, AssessmentMappingFields, mappingSummary } from './AssessmentMappingFields.jsx';
import { AssessmentSettingsEditor } from './AssessmentSettingsEditor.jsx';
import { useUnsavedChanges } from '../../context/UnsavedChangesContext.jsx';

const newOption = macro => ({ id: crypto.randomUUID(), label: '', macro, prioritize: false });

function QuestionEditor({ item, settings, version, onClose, onSaved }) {
  const [options, setOptions] = useState(item?.options ?? ['A', 'B', 'C', 'D'].map(newOption));
  const [routing, setRouting] = useState(item?.routing ?? { role: 'macro-vote', ...(settings ? { sectionId: settings.sections[0].id } : {}) });
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  function change(index, update) { setOptions(current => current.map((o, i) => i === index ? { ...o, ...update } : o)); }
  async function save(event) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setError("");
    const mappedOptions = options.map(({ id, label, macro, prioritize }) => ({ id, label,
      ...(routing.role === 'macro-vote' ? { macro } : ['tuition', 'distance'].includes(routing.constraintKey) ? { prioritize: prioritize === true } : {}) }));
    try { const result = await adminWrite(item ? `/questions/${item.id}` : "/questions", item ? "PUT" : "POST", { ...values, questionBankVersion: version, routing, options: mappedOptions }); onSaved(result.message); onClose(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <Dialog title={item ? "Edit assessment question" : "Add assessment question"} onClose={() => { if (!busy) onClose(); }} wide><UnsavedForm onSubmit={save}><fieldset className="am-dialog-body am-live-fieldset" disabled={busy}>
    <label className="am-field">Question *<textarea name="prompt" required maxLength={350} defaultValue={item?.prompt ?? ""} rows={3} autoFocus /></label><label className="am-field">Status<select name="status" defaultValue={item?.status === "Active" ? "Active" : "Draft"}><option>Draft</option><option>Active</option></select></label>
    <AssessmentMappingFields routing={routing} sections={settings?.sections} onChange={next => { setRouting(next); setOptions(current => current.map((option, index) => ({ ...option, ...(next.role === 'macro-vote' && !option.macro ? { macro: ['A', 'B', 'C', 'D'][index] } : {}), prioritize: option.prioritize === true }))); }} />
    <p className="am-description">These are the live assessment settings. Core questions have four answers, mapped once each to A/B/C/D; the selected answer casts one vote. Practical questions have no career points. Active edits affect new attempts, never saved results. Keep validated wording unchanged unless its revisions have been reviewed.</p>
    {options.map((option, index) => <section className="am-card am-dialog-body" key={option.id}>
      <label className="am-field">Answer {index + 1}<input required maxLength={180} value={option.label} onChange={e => change(index, { label: e.target.value })} /></label>
      <AnswerMappingField option={option} index={index} routing={routing} profileNames={settings?.profiles} onChange={update => change(index, update)} />
      {routing.role === 'constraint' && <button type="button" className="am-button am-button-secondary" disabled={options.length <= 2} onClick={() => setOptions(current => current.filter(o => o.id !== option.id))}><Trash2 size={14} />Remove answer</button>}
    </section>)}
    {routing.role === 'constraint' && <button type="button" className="am-button am-button-secondary" disabled={options.length >= 6} onClick={() => setOptions(current => [...current, newOption()])}><Plus size={14} />Add answer</button>}<Notice error>{error}</Notice>
    </fieldset><div className="am-dialog-actions"><button type="button" data-discard className="am-button am-button-secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="am-button" disabled={busy}>{busy ? "Saving…" : "Save question"}</button></div></UnsavedForm></Dialog>;
}

function Preview({ questions, version, simulate, onClose }) {
  const [step, setStep] = useState(0), [answers, setAnswers] = useState({}), [plan, setPlan] = useState(null);
  const [selection, setSelection] = useState({ profile: '', field: '', vehicle: '' }), [roadmap, setRoadmap] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const question = questions[step];
  async function calculate(final = false) {
    setBusy(true); setError('');
    try {
      const data = await adminWrite('/questions/preview-routing', 'POST', { questionBankVersion: version,
        answers: questions.map(q => ({ questionId: q.id, optionId: answers[q.id] })), ...(final ? { routingSelection: selection } : {}) });
      setPlan(data.plan);
      if (final) setRoadmap(data.routing);
      else setSelection({ profile: data.plan.primaryProfile ?? '', field: '', vehicle: '' });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <Dialog title="Assessment preview" onClose={onClose}><div className="am-dialog-body">
    <p>{simulate ? 'Uses the current live mapping and the same algorithm as the student assessment.' : 'Question wording preview only.'} No assessment attempt or result is saved.</p>
    <Notice error>{error}</Notice>
    {!plan ? <><p>Question {step + 1} of {questions.length}</p><h3>{question.prompt}</h3>{question.options.map(o => <label className="am-field" key={o.id}><span><input type="radio" name="preview-answer" disabled={busy} checked={answers[question.id] === o.id} onChange={() => setAnswers(current => ({ ...current, [question.id]: o.id }))} /> {o.label}</span></label>)}</>
      : <><h3>Macro-profile votes</h3><p>{Object.entries(plan.votes).map(([key, value]) => `${plan.profiles[key]}: ${value}`).join(' · ')}</p>
        {roadmap ? <><h3>{roadmap.umbrellaCluster}</h3><p>Macro-profile: {roadmap.macroProfile.name}</p><p>Selected field: {roadmap.fieldLabel}</p>{roadmap.careerVehicle && <p>Career-launch preference: {roadmap.careerVehicle.label}</p>}<p>The student roadmap uses this field to find programs and their school offerings. Preview does not create recommendations or change user history.</p></>
          : <><label className="am-field">Leading macro-profile<select value={selection.profile} disabled={busy || Boolean(plan.primaryProfile)} onChange={event => setSelection({ profile: event.target.value, field: '' })}><option value="" disabled>Choose a tied profile</option>{plan.leadingProfiles.map(key => <option key={key} value={key}>{plan.profiles[key]}</option>)}</select></label>
            <label className="am-field">Targeted field<select value={selection.field} disabled={busy || !selection.profile} onChange={event => setSelection(current => ({ ...current, field: event.target.value }))}><option value="" disabled>Choose a field</option>{(plan.branches[selection.profile] ?? []).map(field => <option key={field.id} value={field.id}>{field.label}</option>)}</select></label>
            {plan.careerVehicle?.enabled && <label className="am-field">Career-launch preference<select value={selection.vehicle ?? ''} disabled={busy} onChange={event => setSelection(current => ({ ...current, vehicle: event.target.value }))}><option value="" disabled>Choose a career-launch answer</option>{plan.careerVehicle.options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>}</>}
      </>}
    </div><div className="am-dialog-actions">
      <button type="button" className="am-button am-button-secondary" disabled={busy || (!plan && !step)} onClick={() => { if (plan) { setPlan(null); setRoadmap(null); } else setStep(value => value - 1); }}>Back</button>
      {roadmap ? <button className="am-button" onClick={onClose}>Close preview</button> : <button className="am-button" disabled={busy || (plan ? !selection.field || plan.careerVehicle?.enabled && !selection.vehicle : !answers[question.id])} onClick={() => {
        if (plan) calculate(true); else if (step < questions.length - 1) setStep(value => value + 1); else if (simulate) calculate(); else onClose();
      }}>{busy ? 'Calculating…' : plan ? 'Preview roadmap' : step === questions.length - 1 ? simulate ? 'Preview live routing' : 'Finish preview' : 'Next'}</button>}
    </div></Dialog>;
}

export function AssessmentManagement({ searchQuery = "" }) {
  const { requestDiscard } = useUnsavedChanges();
  const resource = useAdminResource("/questions");
  const questions = resource.data?.data ?? [];
  const [query, setQuery] = useState(""), [status, setStatus] = useState(""), [page, setPage] = useState(1), [modal, setModal] = useState(null), [notice, setNotice] = useState("");
  const [tab, setTab] = useState('questions'), [orderBusy, setOrderBusy] = useState(false);
  const filtered = questions.filter(q => [query, searchQuery].every(value =>
    matches([q.prompt, q.options.map(o => o.label), q.status], value)
  ) && (!status || status === q.status));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 6)));
  const active = questions.filter(q => q.status === "Active");
  function saved(message) { setNotice(message); resource.refresh(); }
  function canMove(question, delta) {
    const other = questions[questions.findIndex(q => q.id === question.id) + delta];
    return Boolean(other && (!resource.data?.settings || other.routing?.sectionId === question.routing?.sectionId));
  }
  async function moveQuestion(id, delta) {
    const ids = questions.map(q => q.id), index = ids.indexOf(id), other = index + delta;
    if (other < 0 || other >= ids.length || !canMove(questions[index], delta)) return;
    [ids[index], ids[other]] = [ids[other], ids[index]]; setOrderBusy(true);
    try { const result = await adminWrite('/questions/order', 'PUT', { questionIds: ids, version: resource.data.version }); saved(result.message); }
    catch (err) { setNotice(err.message); } finally { setOrderBusy(false); }
  }
  return <section className="am-page"><PageHeading title="Assessment Management" section="Assessment" description="Manage the live questions, one-vote macro-profile mapping and unscored practical preferences." action="Add Question" onAction={() => setModal({ mode: "edit" })} dataLabel="Live question bank" />
    <Notice>{notice}</Notice><Notice error>{resource.error}</Notice>
    <div className="am-card-toolbar"><button type="button" className={`am-button ${tab !== 'questions' ? 'am-button-secondary' : ''}`} onClick={() => requestDiscard(() => setTab('questions'))}>Core questions</button><button type="button" className={`am-button ${tab !== 'settings' ? 'am-button-secondary' : ''}`} onClick={() => requestDiscard(() => setTab('settings'))}>Routing &amp; results settings</button></div>
    {tab === 'settings' && <AssessmentSettingsEditor onSaved={saved} />}
    {tab === 'questions' && <>
    {resource.data?.routingAudit && <Notice error={!resource.data.routingAudit.available}>{resource.data.routingAudit.available
      ? `${resource.data.routingAudit.coreVoteCount} active core questions each cast one A/B/C/D vote; ${resource.data.routingAudit.constraintCount} practical questions are unscored. Settings below are read by the student assessment, not a separate fixed key. This is a rule-based method; scoring changes still need expert review.`
      : resource.data.routingAudit.message}</Notice>}
    <div className="am-card"><div className="am-card-toolbar"><SearchField value={query} onChange={v => { setQuery(v); setPage(1); }} placeholder="Search assessment questions..." /><select aria-label="Question status" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option><option>Active</option><option>Draft</option><option>Archived</option></select><button className="am-button am-button-secondary" disabled={!active.length || !resource.data?.routingAudit?.available} onClick={() => setModal({ mode: "preview", questions: active, simulate: true })}><Eye size={14} />Preview assessment</button><button className="am-button am-button-secondary" disabled={resource.loading} onClick={resource.refresh}>Refresh</button></div>
      {resource.loading && <p className="am-loading">Loading questions…</p>}
      {resource.data?.settings && <p className="am-description">Move arrows reorder questions within their section. Use Edit to change a question’s section; use Routing &amp; results settings to reorder whole sections.</p>}
      <div className="am-table-scroll"><table className="am-table"><thead><tr><th>Question</th><th>Answers</th><th>Live mapping</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.slice((currentPage - 1) * 6, currentPage * 6).map(q => <tr key={q.id}><td>{q.prompt}</td><td>{q.options.length}</td><td>{mappingSummary(q)}</td><td><Badge>{q.status}</Badge></td><td><div className="am-row-actions"><button aria-label={`Move up ${q.prompt}`} disabled={orderBusy || !canMove(q, -1)} onClick={() => moveQuestion(q.id, -1)}><ArrowUp size={14} /></button><button aria-label={`Move down ${q.prompt}`} disabled={orderBusy || !canMove(q, 1)} onClick={() => moveQuestion(q.id, 1)}><ArrowDown size={14} /></button></div><RowActions name={q.prompt} onEdit={() => setModal({ mode: "edit", item: q })} onView={() => setModal({ mode: "preview", questions: [q] })} deleteLabel="Archive" onDelete={q.status !== "Archived" ? () => setModal({ mode: "archive", item: q }) : undefined} /></td></tr>)}</tbody></table></div>{!resource.loading && !filtered.length && <Empty />}<PageFooter count={filtered.length} page={currentPage} pageSize={6} setPage={setPage} />
    </div>
    </>}
    {modal?.mode === "edit" && <QuestionEditor item={modal.item} settings={resource.data?.settings} version={resource.data?.version} onClose={() => setModal(null)} onSaved={saved} />}
    {modal?.mode === "preview" && <Preview questions={modal.questions} version={resource.data.version} simulate={modal.simulate} onClose={() => setModal(null)} />}
    {modal?.mode === "archive" && <ArchiveDialog name={modal.item.prompt} path={`/questions/${modal.item.id}`} onClose={() => setModal(null)} onSaved={saved} />}
  </section>;
}

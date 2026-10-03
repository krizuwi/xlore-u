import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ClipboardCheck, Eye, ListChecks, Plus, RefreshCw, Trash2 } from "lucide-react";
import { api } from "../../lib/api.js";
import { Badge, ConfirmDelete, Dialog, Empty, PageFooter, PageHeading, RowActions, SearchField, matches, usePreviewData } from "../Management/shared.jsx";
import { WorkspaceNotice } from "./WorkspaceShared.jsx";
import "../Management/management.css";

const questionSeed = [
  { id: "demo-q1", prompt: "Which kind of project would you most enjoy working on?", status: "Active", options: ["Building a website or an app", "Planning a small business", "Creating a film or a story", "Designing a sustainable building"] },
  { id: "demo-q2", prompt: "How do you prefer to solve a new problem?", status: "Active", options: ["Analyze the facts and test ideas", "Talk it through with a team", "Sketch different possibilities", "Build something and improve it"] },
  { id: "demo-q3", prompt: "Which school activity interests you most?", status: "Active", options: ["Science and technology club", "Student leadership", "Writing and performing arts", "Community volunteering"] },
  { id: "demo-q4", prompt: "What would you like to learn more about?", status: "Draft", options: ["Technology and innovation", "Business and finance", "People and society", "Health and the environment"] },
];

function QuestionEditor({ item, onSave, onClose }) {
  const [options, setOptions] = useState(item?.options || ["", "", "", ""]);
  const [error, setError] = useState("");
  function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const cleanOptions = options.map((value) => value.trim());
    if (!values.prompt.trim() || cleanOptions.some((value) => !value)) return setError("Enter a question and complete every answer option.");
    if (new Set(cleanOptions.map((value) => value.toLowerCase())).size !== cleanOptions.length) return setError("Each answer option must be different.");
    onSave({ id: item?.id || crypto.randomUUID(), prompt: values.prompt.trim(), status: values.status, options: cleanOptions });
  }
  return <Dialog title={item ? "Edit Question" : "Add Question"} onClose={onClose} wide><form onSubmit={submit}><div className="am-dialog-body"><p className="ax-dialog-note">Edit the local question bank. These changes do not publish to the student assessment.</p><label className="am-field">Question <span>*</span><textarea name="prompt" required maxLength={350} rows={3} defaultValue={item?.prompt} placeholder="What would you like to ask?" autoFocus /></label><label className="am-field">Status<select name="status" defaultValue={item?.status || "Draft"}><option>Draft</option><option>Active</option></select></label><div className="ax-options-heading"><strong>Answer options</strong><span>{options.length} of 6</span></div>{options.map((option, index) => <div className="ax-option-editor" key={index}><span>{String.fromCharCode(65 + index)}</span><input aria-label={`Answer option ${index + 1}`} required maxLength={180} value={option} onChange={(event) => setOptions((current) => current.map((value, position) => position === index ? event.target.value : value))} placeholder={`Option ${index + 1}`} /><button type="button" className="am-icon-button" aria-label={`Remove option ${index + 1}`} disabled={options.length <= 2} onClick={() => setOptions((current) => current.filter((_, position) => position !== index))}><Trash2 size={15} /></button></div>)}<button type="button" className="ax-text-button" disabled={options.length >= 6} onClick={() => setOptions((current) => [...current, ""])}><Plus size={14} />Add option</button>{error && <WorkspaceNotice error>{error}</WorkspaceNotice>}</div><div className="am-dialog-actions"><button type="button" className="am-button am-button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="am-button">Save question</button></div></form></Dialog>;
}

function AssessmentPreview({ questions, onClose }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const done = step === questions.length;
  const question = questions[step];
  return <Dialog title="Assessment Preview" onClose={onClose} wide><div className="am-dialog-body ax-assessment-preview"><span className="am-demo">Local preview · No student submission</span>{done ? <><div className="ax-complete-icon"><Check size={28} /></div><h3>Preview complete</h3><p>You answered all {questions.length} active questions. This preview does not calculate or save student recommendations.</p><ol className="ax-answer-summary">{questions.map((item) => <li key={item.id}><strong>{item.prompt}</strong><span>{item.options[answers[item.id]]}</span></li>)}</ol></> : <><div className="ax-progress-label"><span>Question {step + 1} of {questions.length}</span><span>{Math.round(step / questions.length * 100)}% complete</span></div><progress max={questions.length} value={step} aria-label="Assessment preview progress" /><fieldset className="ax-preview-question"><legend>{question.prompt}</legend>{question.options.map((option, index) => <label key={`${question.id}-${index}`} className={answers[question.id] === index ? "is-selected" : undefined}><input type="radio" name={question.id} checked={answers[question.id] === index} onChange={() => setAnswers((current) => ({ ...current, [question.id]: index }))} /><span>{option}</span></label>)}</fieldset></>}</div><div className="am-dialog-actions">{done ? <><button className="am-button am-button-secondary" onClick={() => { setStep(0); setAnswers({}); }}>Restart preview</button><button className="am-button" onClick={onClose}>Done</button></> : <><button className="am-button am-button-secondary" disabled={step === 0} onClick={() => setStep((current) => current - 1)}><ArrowLeft size={14} />Back</button><button className="am-button" disabled={answers[question.id] === undefined} onClick={() => setStep((current) => current + 1)}>{step === questions.length - 1 ? "Finish preview" : "Next question"}<ArrowRight size={14} /></button></>}</div></Dialog>;
}

export function AssessmentManagement({ searchQuery = "" }) {
  const [questions, setQuestions] = usePreviewData("assessment-question-bank-v1", questionSeed);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState("");
  const [live, setLive] = useState({ loading: true, questions: [], error: "" });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timer = window.setTimeout(() => controller.abort(), 12000);
    api("/assessments/questions", { signal: controller.signal }).then((data) => {
      if (!Array.isArray(data?.data) || data.data.some((item) => !item.id || typeof item.prompt !== "string" || !Array.isArray(item.options) || item.options.length < 2 || item.options.some((option) => typeof option.label !== "string"))) throw new Error("Invalid question bank response.");
      if (active) setLive({ loading: false, error: "", questions: data.data.map((item) => ({ id: `live-${item.id}`, prompt: item.prompt, options: item.options.map((option) => option.label), status: "Active" })) });
    }).catch(() => { if (active) setLive({ loading: false, error: "The live question bank is unavailable. You can continue editing the local preview.", questions: [] }); }).finally(() => window.clearTimeout(timer));
    return () => { active = false; controller.abort(); window.clearTimeout(timer); };
  }, [revision]);
  const filtered = questions.filter((item) => [query, searchQuery].every((value) => matches(`${item.prompt} ${item.options.join(" ")}`, value)) && (status === "All statuses" || item.status === status));
  const activeQuestions = questions.filter((item) => item.status === "Active");
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 6)));
  function importQuestions() {
    const existingIds = new Set(questions.map((item) => item.id));
    const additions = live.questions.filter((item) => !existingIds.has(item.id));
    setQuestions((current) => [...current, ...additions]);
    setNotice(additions.length ? `Copied ${additions.length} live questions into the local preview.` : "All live questions are already in the local preview.");
  }
  return <section className="am-page ax-page"><PageHeading title="Assessment Management" section="Assessment" description="Review questions and preview the student assessment experience." action="Add Question" onAction={() => setModal({ type: "edit" })} dataLabel="Local question bank" />
    <div className="ax-stat-grid"><div><span className="ax-stat-icon"><ClipboardCheck size={21} /></span><div><small>Total questions</small><strong>{questions.length}</strong></div></div><div><span className="ax-stat-icon is-green"><Check size={21} /></span><div><small>Active in preview</small><strong>{activeQuestions.length}</strong></div></div><div><span className="ax-stat-icon is-purple"><ListChecks size={21} /></span><div><small>Draft questions</small><strong>{questions.length - activeQuestions.length}</strong></div></div></div>
    {notice && <WorkspaceNotice onClose={() => setNotice("")}>{notice}</WorkspaceNotice>}
    <div className="ax-assessment-tools"><div><h2>Question bank</h2><p>Active questions are included in the local preview.</p></div><button className="am-button am-button-secondary" disabled={!activeQuestions.length} onClick={() => setModal({ type: "preview", questions: activeQuestions })}><Eye size={15} />Preview assessment</button></div>
    <div className="am-card"><div className="am-card-toolbar"><SearchField value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Search questions or answers..." /><select className="ax-select" aria-label="Filter question status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option>All statuses</option><option>Active</option><option>Draft</option></select></div><div className="am-table-scroll"><table className="am-table ax-question-table"><thead><tr><th scope="col">Question</th><th scope="col">Answers</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead><tbody>{filtered.slice((currentPage - 1) * 6, currentPage * 6).map((item) => <tr key={item.id}><td><strong>{item.prompt}</strong><small>Single choice</small></td><td>{item.options.length} options</td><td><Badge>{item.status}</Badge></td><td><RowActions name={item.prompt} onEdit={() => setModal({ type: "edit", item })} onView={() => setModal({ type: "preview", questions: [item] })} onDelete={() => setModal({ type: "delete", item })} /></td></tr>)}</tbody></table></div>{!filtered.length && <Empty />}<PageFooter count={filtered.length} page={currentPage} pageSize={6} setPage={setPage} /></div>
    <div className="ax-source-panel"><div><h3>Student question bank</h3><p>{live.loading ? "Checking the live assessment…" : live.error || `${live.questions.length} questions available. Import a copy to review locally; existing drafts are kept.`}</p></div><div className="ax-button-row"><button type="button" className="am-icon-button" aria-label="Refresh student question bank" disabled={live.loading} onClick={() => { setLive((current) => ({ ...current, loading: true })); setRevision((value) => value + 1); }}><RefreshCw size={16} /></button><button className="am-button am-button-secondary" disabled={live.loading || !live.questions.length} onClick={importQuestions}>Import live questions</button></div></div>
    {modal?.type === "edit" && <QuestionEditor item={modal.item} onClose={() => setModal(null)} onSave={(item) => { setQuestions((current) => modal.item ? current.map((question) => question.id === item.id ? item : question) : [...current, item]); setNotice("Question saved to the local preview."); setModal(null); }} />}
    {modal?.type === "preview" && <AssessmentPreview questions={modal.questions} onClose={() => setModal(null)} />}
    {modal?.type === "delete" && <ConfirmDelete name={modal.item.prompt} onClose={() => setModal(null)} onDelete={() => { setQuestions((current) => current.filter((item) => item.id !== modal.item.id)); setNotice("Question removed from the local preview."); setModal(null); }} />}
  </section>;
}

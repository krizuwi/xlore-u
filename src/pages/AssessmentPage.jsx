import { ArrowLeft, ArrowRight, Check, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ErrorMessage, LoadingState } from "../components/Feedback.jsx";
import { SchoolCard } from "../components/SchoolCard.jsx";
import { api } from "../lib/api.js";

export function AssessmentPage() {
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api("/assessments/questions").then((data) => setQuestions(data.data)).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false));
  }, []);

  const choose = (optionId) => setAnswers((current) => ({ ...current, [questions[index].id]: optionId }));
  const submit = async () => {
    setSubmitting(true); setError("");
    try {
      const data = await api("/assessments", {
        method: "POST",
        body: JSON.stringify({ answers: questions.map((question) => ({ questionId: question.id, optionId: answers[question.id] })) })
      });
      setResult(data); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (requestError) { setError(requestError.message); }
    finally { setSubmitting(false); }
  };

  const restart = () => { setAnswers({}); setIndex(0); setResult(null); setError(""); };
  if (loading) return <section className="assessment-page page-shell"><div className="narrow-container container"><LoadingState label="Preparing your assessment..." /></div></section>;

  if (result) return (
    <section className="assessment-page page-shell">
      <div className="container">
        <div className="assessment-result result-wide"><div className="result-icon"><Check /></div><span className="section-kicker">Assessment complete</span><h1>{result.profile.primaryDirection}</h1><p>Your answers point most strongly toward this direction. These results are guidance for exploration, not a formal career decision.</p>
          <div className="result-grid">{Object.entries(result.profile.scores).sort((a,b) => b[1]-a[1]).slice(0,3).map(([tag, score]) => <div key={tag}><span>{tag}</span><strong>{score} points</strong></div>)}</div>
          <div className="result-actions"><button className="secondary-btn" onClick={restart}><RotateCcw size={16} /> Retake</button><button className="primary-btn" onClick={() => navigate('/dashboard')}>Open dashboard <ArrowRight size={16} /></button></div>
        </div>
        <div className="results-section"><div className="section-heading"><div><span className="section-kicker">Top programs</span><h2>Your ranked academic matches.</h2></div></div><div className="match-program-grid">{result.recommendedPrograms.map((program) => <article key={program.id}><span className="match-score">{program.matchScore}%</span><span className="tag">{program.category}</span><h3>{program.name}</h3><p>{program.degreeLevel} degree</p></article>)}</div></div>
        <div className="results-section"><div className="section-heading"><div><span className="section-kicker">Recommended institutions</span><h2>Schools offering your strongest matches.</h2></div></div><div className="school-grid">{result.recommendedSchools.map((school) => <SchoolCard school={school} key={school.id} />)}</div></div>
      </div>
    </section>
  );

  const question = questions[index];
  const progress = ((index + 1) / questions.length) * 100;
  return (
    <section className="assessment-page page-shell">
      <div className="narrow-container container">
        <div className="assessment-top"><span className="section-kicker">Profile assessment</span><h1>Let’s find your direction.</h1><p>Choose the answer that feels most like you. There are no right or wrong choices.</p></div>
        <div className="progress-meta"><span>Question <strong>{index + 1}</strong> of {questions.length}</span><span>{Math.round(progress)}% complete</span></div><div className="assessment-progress"><span style={{ width: `${progress}%` }} /></div>
        <ErrorMessage message={error} />
        <div className="question-card"><span className="question-number">QUESTION {String(index + 1).padStart(2, "0")}</span><h2>{question.prompt}</h2><div className="answer-grid">{question.options.map((option) => <button className={`answer-card ${answers[question.id] === option.id ? "selected" : ""}`} onClick={() => choose(option.id)} key={option.id}><span className="answer-radio">{answers[question.id] === option.id ? <Check size={14} /> : String.fromCharCode(65 + question.options.indexOf(option))}</span>{option.label}</button>)}</div>
          <div className="assessment-nav"><button className="secondary-btn" disabled={index === 0} onClick={() => setIndex((value) => value - 1)}><ArrowLeft size={16} /> Previous</button>{index < questions.length - 1 ? <button className="primary-btn" disabled={!answers[question.id]} onClick={() => setIndex((value) => value + 1)}>Next <ArrowRight size={16} /></button> : <button className="primary-btn" disabled={!answers[question.id] || submitting} onClick={submit}><Sparkles size={16} /> {submitting ? "Creating matches..." : "See my results"}</button>}</div>
        </div>
      </div>
    </section>
  );
}

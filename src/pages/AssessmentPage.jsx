import { ArrowLeft, ArrowRight, Check, MapPin, RotateCcw, Scale, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ErrorMessage, LoadingState } from "../components/Feedback.jsx";
import { SchoolCard } from "../components/SchoolCard.jsx";
import { api } from "../lib/api.js";

function parseObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function AssessmentResults({ result, onRetake, onDashboard, onOpenComparison }) {
  const profile = result?.profile ?? {};
  const scoreEntries = Object.entries(parseObject(profile.scores))
    .sort((left, right) => Number(right[1]) - Number(left[1]))
    .slice(0, 3);
  const programs = Array.isArray(result?.recommendedPrograms) ? result.recommendedPrograms : [];
  const schools = Array.isArray(result?.recommendedSchools) ? result.recommendedSchools : [];
  const [compareBusy, setCompareBusy] = useState(false);
  const [compareError, setCompareError] = useState("");

  const compareRecommendedSchools = async () => {
    setCompareBusy(true);
    setCompareError("");
    try {
      await api("/comparison/schools", {
        method: "PUT",
        body: JSON.stringify({ schoolIds: schools.slice(0, 3).map((school) => school.id) })
      });
      onOpenComparison();
    } catch (requestError) {
      setCompareError(requestError.message);
    } finally {
      setCompareBusy(false);
    }
  };

  return (
    <section className="assessment-page page-shell">
      <div className="container">
        <div className="assessment-result result-wide">
          <div className="result-icon"><Check /></div>
          <span className="section-kicker">Assessment complete</span>
          <h1>{profile.primaryDirection || "Your results are ready"}</h1>
          <p>Your answers suggest this direction for further exploration. Use the school comparison to review practical factors before making a decision.</p>
          {scoreEntries.length > 0 && (
            <div className="result-grid">
              {scoreEntries.map(([tag, score]) => <div key={tag}><span>{tag}</span><strong>{score} points</strong></div>)}
            </div>
          )}
          <div className="result-actions">
            <button className="secondary-btn" type="button" onClick={onRetake}><RotateCcw size={16} /> Retake assessment</button>
            <button className="secondary-btn" type="button" onClick={compareRecommendedSchools} disabled={compareBusy || schools.length === 0}><Scale size={16} /> {compareBusy ? "Preparing comparison…" : "Compare recommended schools"}</button>
            <button className="primary-btn" type="button" onClick={onDashboard}>Open dashboard <ArrowRight size={16} /></button>
          </div>
          <ErrorMessage message={compareError} />
        </div>

        <div className="results-section">
          <div className="section-heading"><div><span className="section-kicker">Programs to explore</span><h2>Programs connected to your interests.</h2></div></div>
          {programs.length > 0 ? (
            <div className="match-program-grid">
              {programs.map((program) => (
                <article key={program.id}>
                  <span className="tag">{program.category}</span>
                  <h3>{program.name}</h3>
                  <p>{program.degreeLevel} degree</p>
                </article>
              ))}
            </div>
          ) : <div className="empty-inline assessment-result-empty">No matching programs are available yet. Add program data, then retake the assessment.</div>}
        </div>

        <div className="results-section">
          <div className="section-heading"><div><span className="section-kicker">Schools to consider</span><h2>Compare schools offering related programs.</h2></div></div>
          {result.locationBasis ? (
            <p className="results-location-note"><MapPin size={15} /> Ordered by approximate distance from the center of {result.locationBasis.area}, inferred privately from your saved address.</p>
          ) : (
            <p className="results-location-note"><MapPin size={15} /> Add a recognizable Metro Manila city to your <Link to="/profile">profile address</Link> to order these schools by approximate distance.</p>
          )}
          {schools.length > 0 ? (
            <div className="school-grid">{schools.map((school) => <SchoolCard school={school} key={school.id} />)}</div>
          ) : <div className="empty-inline assessment-result-empty">No institutions currently offer the matched programs in the catalog.</div>}
        </div>
      </div>
    </section>
  );
}

export function AssessmentPage() {
  const { id: assessmentId } = useParams();
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    const request = assessmentId
      ? api(`/assessments/${assessmentId}/results`).then((data) => {
          if (active) setResult(data);
        })
      : api("/assessments/questions").then((data) => {
          if (active) setQuestions(Array.isArray(data.data) ? data.data : []);
        });

    request
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [assessmentId]);

  const choose = (optionId) => setAnswers((current) => ({ ...current, [questions[index].id]: optionId }));
  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const data = await api("/assessments", {
        method: "POST",
        body: JSON.stringify({ answers: questions.map((question) => ({ questionId: question.id, optionId: answers[question.id] })) })
      });
      setResult(data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const restart = () => {
    if (assessmentId) {
      navigate("/assessment");
      return;
    }
    setAnswers({});
    setIndex(0);
    setResult(null);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) return <section className="assessment-page page-shell"><div className="narrow-container container"><LoadingState label={assessmentId ? "Loading your results..." : "Preparing your assessment..."} /></div></section>;

  if (result) return <AssessmentResults result={result} onRetake={restart} onDashboard={() => navigate("/dashboard")} onOpenComparison={() => navigate("/comparison")} />;

  if (error || questions.length === 0) return (
    <section className="assessment-page page-shell">
      <div className="narrow-container container assessment-load-error">
        <ErrorMessage message={error || "The assessment questions are not available right now."} />
        <button className="secondary-btn" type="button" onClick={() => navigate(assessmentId ? "/dashboard" : "/")}>Go back</button>
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
        <div className="question-card"><span className="question-number">QUESTION {String(index + 1).padStart(2, "0")}</span><h2>{question.prompt}</h2><div className="answer-grid">{question.options.map((option) => <button className={`answer-card ${answers[question.id] === option.id ? "selected" : ""}`} type="button" onClick={() => choose(option.id)} key={option.id}><span className="answer-radio">{answers[question.id] === option.id ? <Check size={14} /> : String.fromCharCode(65 + question.options.indexOf(option))}</span>{option.label}</button>)}</div>
          <div className="assessment-nav"><button className="secondary-btn" type="button" disabled={index === 0} onClick={() => setIndex((value) => value - 1)}><ArrowLeft size={16} /> Previous</button>{index < questions.length - 1 ? <button className="primary-btn" type="button" disabled={!answers[question.id]} onClick={() => setIndex((value) => value + 1)}>Next <ArrowRight size={16} /></button> : <button className="primary-btn" type="button" disabled={!answers[question.id] || submitting} onClick={submit}><Sparkles size={16} /> {submitting ? "Creating matches..." : "See my results"}</button>}</div>
        </div>
      </div>
    </section>
  );
}

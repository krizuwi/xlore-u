import { ArrowLeft, ArrowRight, Check, MapPin, Scale, SlidersHorizontal, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useUnsavedProgress } from "../context/UnsavedChangesContext.jsx";
import { ErrorMessage, LoadingState } from "../components/Feedback.jsx";
import { SchoolCard } from "../components/SchoolCard.jsx";
import { api } from "../lib/api.js";
import { filterAssessmentSchools } from "../lib/assessmentSchoolFilters.js";
import { useFeedbackCompletion } from "../context/FeedbackExperienceContext.jsx";
import { AssessmentRoutingStep } from "../components/AssessmentRoutingStep.jsx";

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

function AssessmentResults({ result, onDashboard, onOpenComparison }) {
  useFeedbackCompletion(Boolean(result));
  const profile = result?.profile ?? {};
  const routing = profile.metrics?.routing;
  const normalizedScores = profile.metrics?.normalizedScores;
  const scoreEntries = Object.entries(parseObject(normalizedScores ?? profile.scores))
    .filter(([, score]) => Number.isFinite(Number(score)) && (routing || Number(score) > 0))
    .sort((left, right) => Number(right[1]) - Number(left[1]))
    .slice(0, routing ? 4 : 3);
  const programs = Array.isArray(result?.recommendedPrograms) ? result.recommendedPrograms : [];
  const schools = Array.isArray(result?.recommendedSchools) ? result.recommendedSchools : [];
  const [filters, setFilters] = useState({ maxTuition: "", maxDistance: "", schoolType: "", sort: "original" });
  const [compareBusy, setCompareBusy] = useState(false);
  const [compareError, setCompareError] = useState("");
  const [showAllPrograms, setShowAllPrograms] = useState(false);
  const shownPrograms = routing && !showAllPrograms ? programs.slice(0, 8) : programs;
  const visibleSchools = useMemo(() => filterAssessmentSchools(schools, filters), [schools, filters]);
  const updateFilter = (event) => setFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  const resetFilters = () => setFilters({ maxTuition: "", maxDistance: "", schoolType: "", sort: "original" });

  const compareRecommendedSchools = async () => {
    setCompareBusy(true);
    setCompareError("");
    try {
      await api("/comparison/schools", {
        method: "PUT",
        body: JSON.stringify({ schoolIds: visibleSchools.slice(0, 3).map((school) => school.id) })
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
          <span className="section-kicker">{routing ? 'Section 3 · Your roadmap' : 'Assessment complete'}</span>
          <h1>{profile.primaryDirection || "Your results are ready"}</h1>
          <p>Your answers suggest this direction for further exploration. Use the school comparison to review practical factors before making a decision.</p>
          {scoreEntries.length > 0 && (
            <div className={`result-grid ${routing ? 'macro-grid' : ''}`}>
              {scoreEntries.map(([tag, score]) => <div key={tag}><span>{routing ? ({ A: 'Analytical', B: 'Creative', C: 'People-Oriented', D: 'Practical' })[tag] : tag}</span><strong>{routing ? `${score} core votes` : normalizedScores ? `${Math.round(Number(score) * 100)}% alignment` : `${score} points`}</strong></div>)}
            </div>
          )}
          {routing && <p><strong>Macro-profile: {routing.macroProfile.name}</strong><br />Selected field: {routing.fieldLabel}<br />Umbrella cluster: {routing.umbrellaCluster}</p>}
          <p>{routing ? 'This roadmap uses equal-vote preferences and an unscored field choice.' : normalizedScores ? "These scores describe relative interest alignment, not aptitude, admission eligibility, or your probability of success." : "This is a previously saved result from the earlier scoring system. Its scoring key has not been validated; discuss the recommendations with a guidance counselor."}</p>
          <div className="result-actions">
            <button className="primary-btn" type="button" onClick={onDashboard}>Open dashboard <ArrowRight size={16} /></button>
          </div>
        </div>

        <div className="results-section">
          <div className="section-heading"><div><span className="section-kicker">Programs to explore</span><h2>Programs connected to your interests.</h2></div></div>
          {programs.length > 0 ? (
            <><div className="match-program-grid">
              {shownPrograms.map((program) => (
                <article key={program.id}>
                  <span className="tag">{program.category}</span>
                  <h3>{program.name}</h3>
                  <p>{program.degreeLevel} degree</p>
                  {program.matchDetails?.status === "scored" && <p>{program.matchScore}% interest alignment · {program.matchDetails.contributions.map(item => item.tag).join(", ")}</p>}
                  {program.matchDetails?.status === 'routed' && <p>Connected to your selected field · {program.matchDetails.umbrellaCluster}</p>}
                </article>
              ))}
            </div>{routing && programs.length > 8 && <button className="secondary-btn results-program-toggle" type="button" onClick={() => setShowAllPrograms(value => !value)}>{showAllPrograms ? 'Show fewer programs' : `View all ${programs.length} related programs`}</button>}</>
          ) : <div className="empty-inline assessment-result-empty">No matching programs are available yet. You can still explore the program directory.</div>}
        </div>

        <div className="results-section">
          <div className="section-heading"><div><span className="section-kicker">Schools to consider</span><h2>Compare schools offering related programs.</h2></div></div>
          {routing && <div className="assessment-school-filters"><h3>Your school-matching constraints</h3>
            <p>Maximum tuition: {routing.limits.maxTuition === null ? 'No hard limit' : `₱${Number(routing.limits.maxTuition).toLocaleString()} per semester`}. Maximum distance: {routing.limits.maxDistance === null ? 'No hard limit' : `${routing.limits.maxDistance} km`}.</p>
            <p>Travel-time preference: {routing.constraintAnswers[18].label}.</p>
            <p>{result.schoolMatchSummary?.notice}</p>
            <p>{result.schoolMatchSummary?.eligibleSchools ?? schools.length} schools meet the known limits. {result.schoolMatchSummary?.excludedSchools ?? 0} were excluded for exceeding a limit or lacking the required information.</p>
          </div>}
          {result.locationBasis ? (
            <p className="results-location-note"><MapPin size={15} /> Distances are approximate straight-line distances from the center of {result.locationBasis.area}, not road or commute distances.</p>
          ) : (
            <p className="results-location-note"><MapPin size={15} /> Add a recognizable Metro Manila city to your <Link to="/profile">profile address</Link> to see approximate distances. {routing ? 'Default ordering follows your practical preferences.' : 'Default ordering prioritizes interest alignment.'}</p>
          )}
          {schools.length > 0 ? (
            <>
              <div className="assessment-school-filters">
                <div className="assessment-filter-heading"><div><SlidersHorizontal size={17} /><strong>Choose what matters to you</strong></div><span>Fees shown are estimates per semester for related programs.</span></div>
                <div className="assessment-filter-fields">
                  <label htmlFor="result-max-tuition">Maximum estimated tuition
                    <select id="result-max-tuition" name="maxTuition" value={filters.maxTuition} onChange={updateFilter}>
                      <option value="">Any amount</option>
                      <option value="30000">Up to ₱30,000 / semester</option>
                      <option value="50000">Up to ₱50,000 / semester</option>
                      <option value="70000">Up to ₱70,000 / semester</option>
                      <option value="100000">Up to ₱100,000 / semester</option>
                      <option value="150000">Up to ₱150,000 / semester</option>
                    </select>
                  </label>
                  {result.locationBasis && <label htmlFor="result-max-distance">Maximum straight-line distance
                    <select id="result-max-distance" name="maxDistance" value={filters.maxDistance} onChange={updateFilter}>
                      <option value="">Any distance</option>
                      <option value="5">Within 5 km</option>
                      <option value="10">Within 10 km</option>
                      <option value="20">Within 20 km</option>
                      <option value="30">Within 30 km</option>
                    </select>
                  </label>}
                  <label htmlFor="result-school-type">School type
                    <select id="result-school-type" name="schoolType" value={filters.schoolType} onChange={updateFilter}>
                      <option value="">Public and private</option>
                      <option value="Public">Public</option>
                      <option value="Private">Private</option>
                    </select>
                  </label>
                  <label htmlFor="result-sort">Order by
                    <select id="result-sort" name="sort" value={filters.sort} onChange={updateFilter}>
                      <option value="original">{routing ? 'Your practical preferences first' : 'Interest alignment first'}</option>
                      {result.locationBasis && <option value="nearest">Nearest first</option>}
                      <option value="tuition_low">Lowest estimated tuition</option>
                      <option value="tuition_high">Highest estimated tuition</option>
                      <option value="name">School name A–Z</option>
                    </select>
                  </label>
                </div>
                <div className="assessment-filter-actions">
                  <span aria-live="polite">Showing {visibleSchools.length} of {schools.length} schools</span>
                  <button className="text-btn" type="button" onClick={resetFilters}>Clear filters</button>
                  <button className="secondary-btn" type="button" onClick={compareRecommendedSchools} disabled={compareBusy || visibleSchools.length === 0}><Scale size={16} /> {compareBusy ? "Preparing comparison…" : visibleSchools.length === 0 ? "Compare shown schools" : `Compare first ${Math.min(visibleSchools.length, 3)} shown`}</button>
                </div>
                <p className="assessment-filter-note">A tuition or distance limit hides schools without a listed value. Tuition figures are estimates; confirm current fees with each school.</p>
              </div>
              <ErrorMessage message={compareError} />
              {visibleSchools.length > 0
                ? <div className="school-grid">{visibleSchools.map((school) => <SchoolCard school={school} showMinimumTuition key={school.id} />)}</div>
                : <div className="empty-inline assessment-result-empty">No schools match these filters. Try a higher tuition or distance limit, or clear the filters.</div>}
            </>
          ) : <div className="empty-inline assessment-result-empty">{routing ? 'No schools can be confirmed within these limits in the current catalog. Missing fees or coordinates are not treated as affordable or nearby.' : 'No institutions currently offer the matched programs in the catalog.'} <Link to="/schools">Explore the school directory</Link>.</div>}
        </div>
      </div>
    </section>
  );
}

export function AssessmentPage() {
  const { id: assessmentId } = useParams();
  const [questions, setQuestions] = useState([]);
  const [questionBankVersion, setQuestionBankVersion] = useState("");
  const [workflow, setWorkflow] = useState(null);
  const [routingPlan, setRoutingPlan] = useState(null);
  const [routingSelection, setRoutingSelection] = useState({ profile: '', field: '' });
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const markProgressSaved = useUnsavedProgress(result || !Object.keys(answers).length ? "" : JSON.stringify({ answers, routingSelection }), !result && !assessmentId);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    let redirecting = false;
    setLoading(true);
    setError("");

    const request = assessmentId
      ? api(`/assessments/${assessmentId}/results`).then((data) => {
          if (active) setResult(data);
        })
      : api("/assessments").then((history) => {
          const previous = history.data?.[0];
          if (previous) {
            if (active) {
              redirecting = true;
              navigate(`/assessment/${previous.id}/results`, { replace: true });
            }
            return null;
          }
          return api("/assessments/questions").then((data) => {
            if (data.availability?.available === false) throw new Error(data.availability.message);
            if (active) {
              setQuestions(Array.isArray(data.data) ? data.data : []);
              setQuestionBankVersion(data.version ?? "");
              setWorkflow(data.workflow ?? null);
            }
          });
        });

    request
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active && !redirecting) setLoading(false);
      });

    return () => { active = false; };
  }, [assessmentId, navigate]);

  const choose = (optionId) => setAnswers((current) => ({ ...current, [questions[index].id]: optionId }));
  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const data = await api("/assessments", {
        method: "POST",
        body: JSON.stringify({ questionBankVersion, answers: questions.map((question) => ({ questionId: question.id, optionId: answers[question.id] })),
          ...(workflow ? { workflowVersion: workflow.version, routingSelection } : {}) })
      });
      markProgressSaved();
      setResult(data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (requestError) {
      if (requestError.status === 409) {
        try {
          const history = await api("/assessments");
          if (history.data?.[0]) {
            markProgressSaved();
            navigate(`/assessment/${history.data[0].id}/results`, { replace: true });
            return;
          }
        } catch { /* Keep the original conflict message below. */ }
      }
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const continueToRouting = async () => {
    setSubmitting(true); setError('');
    try {
      const plan = await api('/assessments/routing', { method: 'POST', body: JSON.stringify({ questionBankVersion,
        answers: questions.map(question => ({ questionId: question.id, optionId: answers[question.id] })) }) });
      setRoutingPlan(plan); setRoutingSelection({ profile: plan.primaryProfile ?? '', field: '' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (requestError) { setError(requestError.message); }
    finally { setSubmitting(false); }
  };

  if (loading) return <section className="assessment-page page-shell"><div className="narrow-container container"><LoadingState label={assessmentId ? "Loading your results..." : "Preparing your assessment..."} /></div></section>;

  if (result) return <AssessmentResults result={result} onDashboard={() => navigate("/dashboard")} onOpenComparison={() => navigate("/comparison")} />;

  if (questions.length === 0) return (
    <section className="assessment-page page-shell">
      <div className="narrow-container container assessment-load-error">
        <ErrorMessage message={error || "The assessment questions are not available right now."} />
        <button className="secondary-btn" type="button" onClick={() => navigate(assessmentId ? "/dashboard" : "/")}>Go back</button>
      </div>
    </section>
  );

  if (routingPlan) return <AssessmentRoutingStep plan={routingPlan} selection={routingSelection}
    onSelection={setRoutingSelection} busy={submitting} error={error} onComplete={submit}
    onBack={() => { setRoutingPlan(null); setError(''); setIndex(questions.length - 1); }} />;

  const question = questions[index];
  const progress = ((index + 1) / questions.length) * 100;
  return (
    <section className="assessment-page page-shell">
      <div className="narrow-container container">
        <div className="assessment-top"><span className="section-kicker">{workflow ? 'Section 1 · Core questionnaire' : 'Profile assessment'}</span><h1>Let’s find your direction.</h1><p>Choose the answer that feels most like you. There are no right or wrong choices. {workflow && 'After the original questions, one or two unscored follow-ups will narrow your field. '}Each account can complete the assessment only once. You can revisit your results anytime.</p></div>
        <div className="progress-meta"><span>Question <strong>{index + 1}</strong> of {questions.length}</span><span>{Math.round(progress)}% complete</span></div><div className="assessment-progress"><span style={{ width: `${progress}%` }} /></div>
        <ErrorMessage message={error} />
        <div className="question-card"><span className="question-number">QUESTION {String(index + 1).padStart(2, "0")}</span><h2>{question.prompt}</h2><div className="answer-grid">{question.options.map((option) => <button className={`answer-card ${answers[question.id] === option.id ? "selected" : ""}`} type="button" disabled={submitting} onClick={() => choose(option.id)} key={option.id}><span className="answer-radio">{answers[question.id] === option.id ? <Check size={14} /> : String.fromCharCode(65 + question.options.indexOf(option))}</span>{option.label}</button>)}</div>
          <div className="assessment-nav"><button className="secondary-btn" type="button" disabled={index === 0 || submitting} onClick={() => setIndex((value) => value - 1)}><ArrowLeft size={16} /> Previous</button>{index < questions.length - 1 ? <button className="primary-btn" type="button" disabled={!answers[question.id]} onClick={() => setIndex((value) => value + 1)}>Next <ArrowRight size={16} /></button> : <button className="primary-btn" type="button" disabled={!answers[question.id] || submitting} onClick={workflow ? continueToRouting : submit}><Sparkles size={16} /> {submitting ? "Preparing..." : workflow ? 'Continue to targeted follow-up' : "See my results"}</button>}</div>
        </div>
      </div>
    </section>
  );
}

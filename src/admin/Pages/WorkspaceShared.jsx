import { BookOpen, CheckCircle2, CircleAlert, Database, GitCompareArrows, University, X } from "lucide-react";
import { Empty } from "../Management/shared.jsx";
import { comparisonRows } from "./workspaceData.js";
import "./AdminWorkspacePages.css";

export function RecordIcon({ kind, size = 20 }) {
  const Icon = kind === "Universities" ? University : kind === "Programs" ? BookOpen : GitCompareArrows;
  return <span className={`ax-record-icon ax-kind-${kind.toLowerCase()}`}><Icon size={size} aria-hidden="true" /></span>;
}

export function WorkspaceNotice({ children, onClose, error = false }) {
  return <div className={`ax-notice${error ? " is-error" : ""}`} role={error ? "alert" : "status"}>{error ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />}<span>{children}</span>{onClose && <button type="button" onClick={onClose} aria-label="Dismiss message"><X size={15} /></button>}</div>;
}

export function CatalogStatus({ loading, errors, onRefresh }) {
  return <div className="ax-catalog-status" role="status"><Database size={14} /><span>{loading ? "Loading your catalog…" : errors.length ? errors.join(" ") : "Catalog records loaded. Saved copies and comparisons stay in this browser."}</span>{onRefresh && <button type="button" disabled={loading} onClick={onRefresh}>Refresh</button>}</div>;
}

export function ComparisonTable({ records, differencesOnly = false, query = "" }) {
  const rows = comparisonRows(records, differencesOnly, query);
  if (records.length < 2) return <Empty title="Choose at least two records" subtitle="Select up to three universities or programs to compare their details." />;
  return rows.length ? <div className="ax-comparison-scroll"><table className="ax-comparison-table"><caption className="ad-sr-only">Side-by-side comparison of {records.map((record) => record.name).join(", ")}</caption><thead><tr><th scope="col">Details</th>{records.map((record) => <th scope="col" key={record.id}>{record.name}<small>{record.source}</small></th>)}</tr></thead><tbody>{rows.map(({ field, values }) => <tr key={field} className={new Set(values).size > 1 ? "ax-different" : undefined}><th scope="row">{field}</th>{values.map((value, index) => <td key={records[index].id}>{value}</td>)}</tr>)}</tbody></table></div> : <Empty title={query ? "No matching comparison details" : "No differences to show"} subtitle={query ? "Try another search to find a field or value." : "Turn off ‘Only differences’ to see all details."} />;
}

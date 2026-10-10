import { useEffect, useState } from "react";
import { programSeed, universitySeed } from "../Management/shared.jsx";
import { FetchCollectionData, FetchNormalizedPrograms } from "../Request/dashboardApiRequest.jsx";
import { keywordMatches } from "../../lib/keyword-search.js";

export const demoCatalog = [
  ...universitySeed.map((item) => ({ id: `university-demo-${item.id}`, kind: "Universities", name: item.name, source: "Demo", details: { Type: item.type, Location: item.location, Programs: item.programs, Status: item.status, Website: item.website } })),
  ...programSeed.map((item) => ({ id: `program-demo-${item.id}`, kind: "Programs", name: item.name, source: "Demo", details: { University: item.university, Category: item.category, Degree: item.degree, Duration: item.duration, "Tuition fee": item.tuition, Subjects: item.subjects, Status: item.status } })),
];

export const savedSeed = [demoCatalog[0], demoCatalog[2], demoCatalog[8]].map((record, index) => ({
  id: `saved-demo-${index}`, name: record.name, kind: record.kind, source: record.source,
  savedAt: "2026-09-28T08:00:00Z", notes: "Sample record for catalog review.", record,
}));

export function useAdminCatalog() {
  const [state, setState] = useState({ records: demoCatalog, loading: true, errors: [] });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    Promise.allSettled([
      FetchCollectionData({ signal: controller.signal, allPages: true }),
      FetchNormalizedPrograms({ signal: controller.signal }),
    ]).then(([universities, programs]) => {
      if (!active) return;
      const errors = [];
      const schoolRecords = universities.status === "fulfilled" ? universities.value.universities.map((item, index) => ({
        id: `university-live-${item.id ?? item.schoolId ?? index}`, kind: "Universities", name: item.name || "Unnamed university", source: "Live catalog",
        details: { Type: item.schoolType || "Not provided", Location: item.city || item.address || "Not provided", Programs: Array.isArray(item.programs) ? item.programs.length : "Not provided", Website: item.officialWebsiteUrl || "Not provided" },
      })) : demoCatalog.filter((item) => item.kind === "Universities");
      const programRecords = programs.status === "fulfilled" ? programs.value.map((item, index) => ({
        id: `program-live-${index}-${item.programName}`, kind: "Programs", name: item.programName || "Unnamed program", source: "Live catalog",
        details: { University: item.university || "Not provided", Category: item.category || "Not provided", Duration: item.duration || "Not provided", Status: item.status || "Not provided" },
      })) : demoCatalog.filter((item) => item.kind === "Programs");
      if (universities.status === "rejected") errors.push("Universities could not be loaded; sample universities are available.");
      if (programs.status === "rejected") errors.push("Programs could not be loaded; sample programs are available.");
      setState({ records: [...schoolRecords, ...programRecords], loading: false, errors });
    }).finally(() => window.clearTimeout(timeout));
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [revision]);
  return { ...state, refresh: () => { setState((current) => ({ ...current, loading: true })); setRevision((current) => current + 1); } };
}

export function recordMatches(record, query) {
  return keywordMatches([record.name, record.kind, record.source, record.details], query);
}

export function comparisonRows(records, differencesOnly = false, query = "") {
  const fields = [...new Set(records.flatMap((record) => Object.keys(record.details)))];
  return fields.map((field) => ({ field, values: records.map((record) => String(record.details[field] ?? "Not provided")) }))
    .filter(({ field, values }) => (!differencesOnly || new Set(values).size > 1) && keywordMatches([field, values], query));
}

export function downloadRecords(records, filename) {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), records }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

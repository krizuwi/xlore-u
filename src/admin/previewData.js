// Isolated preview fixtures until the admin monitoring and scraper APIs exist.
export const collectionData = {
  "7": [
    { label: "Mon", records: 124 },
    { label: "Tue", records: 218 },
    { label: "Wed", records: 192 },
    { label: "Thu", records: 326 },
    { label: "Fri", records: 284 },
    { label: "Sat", records: 398 },
    { label: "Sun", records: 342 }
  ],
  "30": [
    { label: "Day 1", records: 82 },
    { label: "Day 4", records: 156 },
    { label: "Day 7", records: 138 },
    { label: "Day 10", records: 254 },
    { label: "Day 13", records: 238 },
    { label: "Day 16", records: 362 },
    { label: "Day 19", records: 394 },
    { label: "Day 22", records: 312 },
    { label: "Day 25", records: 328 },
    { label: "Day 28", records: 356 },
    { label: "Day 30", records: 342 }
  ]
};

export const universities = [
  { name: "University of the Philippines", initials: "UP", color: "wine", records: 186 },
  { name: "De La Salle University", initials: "DLS", color: "green", records: 124 },
  { name: "Ateneo de Manila University", initials: "AD", color: "blue", records: 98 },
  { name: "University of Santo Tomas", initials: "UST", color: "gold", records: 142 },
  { name: "STI College Global City", initials: "STI", color: "blue", records: 36 }
];

export const initialJobs = [
  { id: "JOB-0248", university: universities[0], status: "Completed", records: 186, started: "Today, 10:42 AM", duration: "2m 34s", type: "Full collection" },
  { id: "JOB-0247", university: universities[1], status: "Completed", records: 124, started: "Today, 10:15 AM", duration: "1m 48s", type: "Program updates" },
  { id: "JOB-0246", university: universities[2], status: "Completed", records: 98, started: "Today, 9:50 AM", duration: "1m 12s", type: "Full collection" },
  { id: "JOB-0245", university: universities[3], status: "Failed", records: 0, started: "Today, 9:30 AM", duration: "30s", type: "Full collection", error: "The source website did not respond within 30 seconds. Review the source URL before retrying." },
  { id: "JOB-0244", university: universities[4], status: "Completed", records: 36, started: "Today, 9:12 AM", duration: "48s", type: "Program updates" },
  { id: "JOB-0243", university: universities[1], status: "Completed", records: 22, started: "Yesterday, 4:20 PM", duration: "56s", type: "Program updates" }
];

export const qualityAlerts = [
  { id: "missing-tuition", title: "Missing tuition information", description: "12 programs need tuition details", severity: "warning", label: "Missing data", university: "Across 4 universities", detail: "These sample program records do not include a tuition range. Check each institution's official fees page and verify the academic year before updating the catalog." },
  { id: "stale-records", title: "Outdated university records", description: "3 universities haven't been updated", severity: "info", label: "Needs refresh", university: "Last verified over 30 days ago", detail: "These sample university records have not been verified in the last 30 days. Run a fresh collection and review changes against the official university website." },
  { id: "duplicate-programs", title: "Potential duplicate programs", description: "2 program pairs need a review", severity: "warning", label: "Review needed", university: "Across 2 universities", detail: "These sample program pairs have similar names. Compare the campus, qualification, and specialization before deciding whether they represent the same offering." }
];

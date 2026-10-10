import { pool } from "../db/pool.js";
import { orderSchoolsByAddress } from "./proximity.js";

const schoolFields = `s.school_id AS id, s.school_name AS name, s.city_district AS city,
  s.school_type AS "schoolType", s.latitude, s.longitude, s.google_rating AS "googleRating",
  s.logo_url AS "logoUrl", s.logo_credit AS "logoCredit", s.campus_photos AS "campusPhotos"`;
const activeSchool = `EXISTS (SELECT 1 FROM available_schools a
  WHERE a.school_id = s.school_id AND a.is_active_available = TRUE)`;
export const FEATURED_UP_DILIMAN_ID = "40000000-0000-4000-8000-000000000001";

export async function getDashboardShowcase(user, latestAssessment) {
  const [[recentSchools], [discoverySchools], [featuredSchools], [recommendedSchools]] = await Promise.all([
    pool.execute(
      `SELECT ${schoolFields}, usv.last_visited_at AS "lastVisitedAt"
       FROM user_school_visits usv JOIN schools s ON s.school_id = usv.school_id
       WHERE usv.user_id = ? AND ${activeSchool}
       ORDER BY usv.last_visited_at DESC, s.school_name LIMIT 2`, [user.user_id]
    ),
    pool.execute(
      `SELECT ${schoolFields} FROM schools s
       WHERE ${activeSchool} AND jsonb_array_length(COALESCE(s.campus_photos, '[]'::jsonb)) > 0
       ORDER BY md5(s.school_id::text || ? || CURRENT_DATE::text) LIMIT 3`, [user.user_id]
    ),
    pool.execute(
      `SELECT ${schoolFields} FROM schools s WHERE s.school_id = ? AND ${activeSchool}`,
      [FEATURED_UP_DILIMAN_ID]
    ),
    latestAssessment ? pool.execute(
      `SELECT ${schoolFields}, MAX(rp.match_score) AS "matchScore"
       FROM recommended_programs rp JOIN career_profiles cp ON cp.profile_id = rp.profile_id
       JOIN school_programs sp ON sp.program_id = rp.program_id
       JOIN schools s ON s.school_id = sp.school_id
       JOIN programs p ON p.program_id = rp.program_id
       WHERE cp.assessment_id = ? AND cp.user_id = ? AND p.is_active = TRUE AND ${activeSchool}
       GROUP BY s.school_id ORDER BY "matchScore" DESC, s.google_rating DESC`,
      [latestAssessment.assessmentId, user.user_id]
    ) : Promise.resolve([[]])
  ]);
  return {
    recentSchools,
    // A user-specific daily shuffle stays stable across the dashboard's 15-second refresh.
    discoverySchools,
    featuredSchool: featuredSchools[0] ?? null,
    // Use the same location ordering as the assessment results, rather than inventing a new match.
    recommendedSchools: orderSchoolsByAddress(recommendedSchools, user.address, 2).schools
  };
}

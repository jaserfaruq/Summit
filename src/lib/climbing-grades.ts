/**
 * Climbing Grade Conversion Matrix
 *
 * Single source of truth for all climbing grade conversions.
 * Edit STYLE_OFFSETS to adjust conversion rules.
 *
 * Baseline: Outdoor Lead (offset 0).
 * Offsets represent how many letter-grade steps EASIER a style is
 * compared to outdoor lead. Higher offset = easier style.
 */

export const YDS_GRADES = [
  "5.0", "5.1", "5.2", "5.3", "5.4", "5.5", "5.6",
  "5.7", "5.8",
  "5.9", "5.10a", "5.10b", "5.10c", "5.10d",
  "5.11a", "5.11b", "5.11c", "5.11d",
  "5.12a", "5.12b", "5.12c", "5.12d",
  "5.13a",
] as const;

export type YDSGrade = (typeof YDS_GRADES)[number];

export type ClimbingStyle =
  | "indoor_toprope"
  | "indoor_lead"
  | "outdoor_toprope"
  | "outdoor_lead";

/**
 * EDITABLE CONVERSION TABLE
 *
 * Each value = how many letter-grade steps easier this style is
 * compared to outdoor lead.
 *
 * Current rules:
 * - Outdoor lead is the baseline (0)
 * - Outdoor top-rope is 3 letter grades easier than outdoor lead
 * - Indoor lead is 4 letter grades easier than outdoor lead
 * - Indoor top-rope is 6 letter grades easier than outdoor lead
 */
export const STYLE_OFFSETS: Record<ClimbingStyle, number> = {
  outdoor_lead: 0,
  outdoor_toprope: 3,
  indoor_lead: 4,
  indoor_toprope: 6,
};

export const STYLE_LABELS: Record<ClimbingStyle, string> = {
  outdoor_lead: "Outdoor Lead",
  outdoor_toprope: "Outdoor Top-Rope",
  indoor_lead: "Indoor Lead",
  indoor_toprope: "Indoor Top-Rope",
};

/** Map old range-based dropdown values to a representative individual grade */
export const GRADE_RANGE_MAP: Record<string, YDSGrade> = {
  "5.0-5.6": "5.6",
  "5.7-5.8": "5.8",
  "5.9-5.10a": "5.10a",
  "5.10b-5.10d": "5.10c",
  "5.11+": "5.11b",
  "5.12+": "5.12b",
};

/** Get the index of a grade in YDS_GRADES, or -1 if not found */
function gradeIndex(grade: string): number {
  return YDS_GRADES.indexOf(grade as YDSGrade);
}

/** Convert any grade + style to the equivalent outdoor lead grade */
export function toOutdoorLead(grade: string, style: ClimbingStyle): string | null {
  // Try direct lookup first, then range map
  let idx = gradeIndex(grade);
  if (idx === -1) {
    const mapped = GRADE_RANGE_MAP[grade];
    if (mapped) idx = gradeIndex(mapped);
  }
  if (idx === -1) return null;

  const offset = STYLE_OFFSETS[style];
  const targetIdx = idx - offset;
  if (targetIdx < 0 || targetIdx >= YDS_GRADES.length) return null;
  return YDS_GRADES[targetIdx];
}

/** Convert an outdoor lead grade to any other style */
export function fromOutdoorLead(grade: string, targetStyle: ClimbingStyle): string | null {
  let idx = gradeIndex(grade);
  if (idx === -1) {
    const mapped = GRADE_RANGE_MAP[grade];
    if (mapped) idx = gradeIndex(mapped);
  }
  if (idx === -1) return null;

  const offset = STYLE_OFFSETS[targetStyle];
  const targetIdx = idx + offset;
  if (targetIdx < 0 || targetIdx >= YDS_GRADES.length) return null;
  return YDS_GRADES[targetIdx];
}

/** Get equivalent grades in all styles for a given grade + style */
export function getAllEquivalents(
  grade: string,
  style: ClimbingStyle
): Record<ClimbingStyle, string | null> {
  const outdoorLead = toOutdoorLead(grade, style);
  if (!outdoorLead) {
    return {
      outdoor_lead: null,
      outdoor_toprope: null,
      indoor_lead: null,
      indoor_toprope: null,
    };
  }

  return {
    outdoor_lead: outdoorLead,
    outdoor_toprope: fromOutdoorLead(outdoorLead, "outdoor_toprope"),
    indoor_lead: fromOutdoorLead(outdoorLead, "indoor_lead"),
    indoor_toprope: fromOutdoorLead(outdoorLead, "indoor_toprope"),
  };
}

/** Check if a grade value is a real climbing grade (not "none" or "class_3_4") */
export function isClimbingGrade(grade: string): boolean {
  return grade !== "none" && grade !== "class_3_4";
}

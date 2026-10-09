export type ExamKind = "regular" | "milestone";

export interface ExamDefinition {
  kind: ExamKind;
  stageName: string | null;
  juzNumber: number | null;
  section: string | null;
  label: string;
}

export interface ExamProgressRecord {
  exam_status?: string | null;
  exam_kind?: string | null;
  manual_start?: boolean | null;
  attempt_number?: number | null;
  stage_name?: string | null;
  tamhidi_stage?: string | null;
  juz_number?: number | null;
  tilawah_section?: string | null;
  hifd_section?: string | null;
  grade?: string | null;
}

const hizbSequence = [60, 59, 58, 57].map((number) => ({
  section: `الحزب ${number}`,
  juzNumber: null,
  label: `اختبار الحزب ${number}`,
}));

const juzSequence = Array.from({ length: 28 }, (_, index) => {
  const number = index + 1;
  return {
    section: `الجزء ${number}`,
    juzNumber: number,
    label: `اختبار الجزء ${number}`,
  };
});

const regularQuranSequence = [...hizbSequence, ...juzSequence];
const quranMilestones = [
  { name: "أول خمسة أجزاء", regularUpTo: 9, juzNumbers: [1, 2, 3, 4, 5] },
  { name: "أول عشرة أجزاء", regularUpTo: 14, juzNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  { name: "أول عشرين جزءًا", regularUpTo: 24, juzNumbers: Array.from({ length: 20 }, (_, index) => index + 1) },
  { name: "كامل القرآن", regularUpTo: regularQuranSequence.length, juzNumbers: Array.from({ length: 30 }, (_, index) => index + 1) },
];

const tamhidiStages = [
  "المرحلة الأولى والثانية",
  "المرحلة الثالثة",
  "المرحلة الرابعة",
  "مرحلة كامل",
];

const ordinalNames = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر"];
const extendedOrdinalNames = [
  "الحادي عشر", "الثاني عشر", "الثالث عشر", "الرابع عشر", "الخامس عشر", "السادس عشر", "السابع عشر", "الثامن عشر", "التاسع عشر", "العشرون",
  "الحادي والعشرون", "الثاني والعشرون", "الثالث والعشرون", "الرابع والعشرون", "الخامس والعشرون", "السادس والعشرون", "السابع والعشرون", "الثامن والعشرون", "التاسع والعشرون", "الثلاثون",
];

const passed = (record: ExamProgressRecord) =>
  record.exam_status !== "queued" &&
  record.exam_status !== "in_progress" &&
  ["شرف", "تفوق", "ممتاز", "جيد جداً", "جيد", "مقبول"].includes(record.grade || "");

const sectionOf = (record: ExamProgressRecord, level: string) =>
  level === "حافظ" ? record.hifd_section : level === "تلاوة" ? record.tilawah_section : record.hifd_section || record.tilawah_section;

const hasSuccessfulRegular = (
  records: ExamProgressRecord[],
  level: string,
  section: string,
  juzNumber: number | null,
) => records.some((record) => {
  if (!passed(record) || record.exam_kind === "milestone" || (record.attempt_number || 0) >= 100) return false;
  return juzNumber !== null
    ? record.juz_number === juzNumber || sectionOf(record, level) === section
    : sectionOf(record, level) === section;
});

const hasSuccessfulMilestone = (
  records: ExamProgressRecord[],
  level: string,
  stageName: string,
  juzNumber: number,
) => records.some((record) => {
  if (!passed(record) || record.exam_kind !== "milestone" || record.stage_name !== stageName) return false;
  return sectionOf(record, level) === `الجزء ${juzNumber}` || record.juz_number === juzNumber;
});

const createMilestoneExam = (stageName: string, juzNumber: number): ExamDefinition => {
  const ordinal = ordinalNames[juzNumber - 1] || extendedOrdinalNames[juzNumber - 11] || String(juzNumber);
  return {
    kind: "milestone",
    stageName,
    juzNumber,
    section: `الجزء ${juzNumber}`,
    label: `اختبار الجزء ${ordinal} – مرحلة`,
  };
};

export const getNextExam = (level: string, records: ExamProgressRecord[]): ExamDefinition | null => {
  if (level === "تمهيدي") {
    const manualStart = records.find((record) => record.manual_start && record.tamhidi_stage)?.tamhidi_stage;
    const startIndex = manualStart ? tamhidiStages.indexOf(manualStart) : 0;
    const stageName = tamhidiStages.slice(Math.max(startIndex, 0)).find((stage) => !records.some(
      (record) => passed(record) && record.tamhidi_stage === stage,
    ));
    return stageName
      ? { kind: "milestone", stageName, juzNumber: null, section: null, label: stageName }
      : null;
  }

  if (level !== "حافظ" && level !== "تلاوة") return null;

  const manualStart = records.find((record) => record.manual_start);
  const startIndex = manualStart
    ? regularQuranSequence.findIndex((exam) =>
      exam.juzNumber !== null
        ? exam.juzNumber === manualStart.juz_number
        : exam.section === sectionOf(manualStart, level),
    )
    : 0;
  const firstSequenceIndex = Math.max(startIndex, 0);

  for (const milestone of quranMilestones) {
    if (firstSequenceIndex >= milestone.regularUpTo) continue;

    const regularPrerequisitesPassed = regularQuranSequence
      .slice(0, milestone.regularUpTo)
      .every((exam, index) => index < firstSequenceIndex || hasSuccessfulRegular(records, level, exam.section, exam.juzNumber));

    if (!regularPrerequisitesPassed) continue;

    const incompleteJuz = milestone.juzNumbers.find(
      (number) => !hasSuccessfulMilestone(records, level, milestone.name, number),
    );
    if (incompleteJuz) return createMilestoneExam(milestone.name, incompleteJuz);
  }

  const nextRegularExam = regularQuranSequence.slice(firstSequenceIndex).find(
    (exam) => !hasSuccessfulRegular(records, level, exam.section, exam.juzNumber),
  );

  return nextRegularExam
    ? { kind: "regular", stageName: null, ...nextRegularExam }
    : null;
};

export const getExamDisplayName = (exam: ExamProgressRecord, level: string) => {
  if (exam.exam_kind === "milestone" && exam.stage_name && exam.juz_number) {
    return createMilestoneExam(exam.stage_name, exam.juz_number).label;
  }
  if (exam.tamhidi_stage) return exam.tamhidi_stage;
  return sectionOf(exam, level) || (exam.juz_number ? `الجزء ${exam.juz_number}` : "غير محدد");
};
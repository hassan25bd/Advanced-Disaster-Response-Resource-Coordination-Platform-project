const URGENCY_WEIGHT: Record<string, number> = {
  LOW: 10,
  MEDIUM: 25,
  HIGH: 45,
  CRITICAL: 70,
};

function affectedPeopleWeight(people: number) {
  return Math.min(30, Math.round(Math.log10(Math.max(people, 1)) * 8));
}

function ageWeight(createdAt: Date, now: Date) {
  const ageInSixHourPeriods = Math.floor((now.getTime() - createdAt.getTime()) / (6 * 60 * 60 * 1000));
  return Math.min(30, Math.max(0, ageInSixHourPeriods));
}

export function getLocationRiskScore(history: { newValue: string | null }[] = []) {
  const score = Number(history[0]?.newValue);
  return Number.isInteger(score) && score >= 0 && score <= 5 ? score : 0;
}

export function calculateIncidentPriority(input: {
  severity: string;
  affectedPopulation: number;
  locationRiskScore: number;
  createdAt: Date;
}, now = new Date()) {
  return (URGENCY_WEIGHT[input.severity] || URGENCY_WEIGHT.MEDIUM) +
    affectedPeopleWeight(input.affectedPopulation) +
    input.locationRiskScore * 10 +
    ageWeight(input.createdAt, now);
}

export function calculateRequestPriority(input: {
  priority: string;
  affectedPeople: number;
  locationRiskScore: number;
  createdAt: Date;
}, now = new Date()) {
  return (URGENCY_WEIGHT[input.priority] || URGENCY_WEIGHT.MEDIUM) +
    affectedPeopleWeight(input.affectedPeople) +
    input.locationRiskScore * 10 +
    ageWeight(input.createdAt, now);
}

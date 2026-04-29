export const getScoreDelta = (payload) => {
  if (!payload || typeof payload !== 'object') return null;

  const candidates = [
    payload.score_delta,
    payload.points_awarded,
    payload.user_score_delta,
    payload.scoreChange,
  ];

  const numeric = candidates.find((value) => Number.isFinite(Number(value)));
  return numeric !== undefined ? Number(numeric) : null;
};

export const withScoreMessage = (baseMessage, payload) => {
  const delta = getScoreDelta(payload);
  if (delta === null || delta === 0) return baseMessage;
  const sign = delta > 0 ? '+' : '';
  return `${baseMessage} (${sign}${delta} pts)`;
};

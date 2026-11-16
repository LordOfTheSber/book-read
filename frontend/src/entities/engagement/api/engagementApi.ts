import { httpClient } from '@/shared/api/httpClient';
import { Achievement, ReadingGoal, Streak, YearInReview } from '@/shared/types/library';

export interface GoalPayload {
  targetItems?: number;
  targetPages?: number;
  targetMinutes?: number;
}

export const fetchGoal = async (year?: number) => {
  const { data } = await httpClient.get<ReadingGoal>('/engagement/goals/current', { params: { year } });
  return data;
};

export const fetchGoals = async () => {
  const { data } = await httpClient.get<ReadingGoal[]>('/engagement/goals');
  return data;
};

export const saveGoal = async (year: number, payload: GoalPayload) => {
  const { data } = await httpClient.put<ReadingGoal>(`/engagement/goals/${year}`, payload);
  return data;
};

export const deleteGoal = async (year: number) => {
  await httpClient.delete(`/engagement/goals/${year}`);
};

export const fetchStreak = async () => {
  const { data } = await httpClient.get<Streak>('/engagement/streak');
  return data;
};

/** Заодно выдаёт заслуженное: проверка по требованию дешевле ночного обхода всех пользователей. */
export const fetchAchievements = async () => {
  const { data } = await httpClient.get<Achievement[]>('/engagement/achievements');
  return data;
};

export const fetchYearInReview = async (year?: number) => {
  const { data } = await httpClient.get<YearInReview>('/engagement/year-in-review', { params: { year } });
  return data;
};

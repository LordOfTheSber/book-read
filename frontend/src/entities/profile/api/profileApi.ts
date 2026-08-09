import { httpClient } from '@/shared/api/httpClient';
import { Activity, ProfileSummary, PublicProfile } from '@/shared/types/library';

export interface ProfilePayload {
  displayName?: string;
  bio?: string;
  publicProfile: boolean;
}

export const fetchMyProfile = async () => {
  const { data } = await httpClient.get<PublicProfile>('/profiles/me');
  return data;
};

export const updateMyProfile = async (payload: ProfilePayload) => {
  const { data } = await httpClient.put<PublicProfile>('/profiles/me', payload);
  return data;
};

export const fetchProfile = async (username: string) => {
  const { data } = await httpClient.get<PublicProfile>(`/profiles/${encodeURIComponent(username)}`);
  return data;
};

export const fetchProfileActivity = async (username: string, limit?: number) => {
  const { data } = await httpClient.get<Activity[]>(`/profiles/${encodeURIComponent(username)}/activity`, {
    params: { limit }
  });
  return data;
};

export const fetchFollowers = async (username: string) => {
  const { data } = await httpClient.get<ProfileSummary[]>(`/profiles/${encodeURIComponent(username)}/followers`);
  return data;
};

export const fetchFollowing = async (username: string) => {
  const { data } = await httpClient.get<ProfileSummary[]>(`/profiles/${encodeURIComponent(username)}/following`);
  return data;
};

export const followUser = async (username: string) => {
  const { data } = await httpClient.post<PublicProfile>(`/profiles/${encodeURIComponent(username)}/follow`);
  return data;
};

export const unfollowUser = async (username: string) => {
  const { data } = await httpClient.delete<PublicProfile>(`/profiles/${encodeURIComponent(username)}/follow`);
  return data;
};

/** Только открытые профили: на закрытый всё равно не подписаться. */
export const searchProfiles = async (query: string) => {
  const { data } = await httpClient.get<ProfileSummary[]>('/profiles/search', { params: { query } });
  return data;
};

export const fetchFeed = async (limit?: number) => {
  const { data } = await httpClient.get<Activity[]>('/profiles/me/feed', { params: { limit } });
  return data;
};

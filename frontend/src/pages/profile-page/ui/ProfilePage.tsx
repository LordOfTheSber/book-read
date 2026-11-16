import React, { useEffect, useState } from 'react';
import { App, Form, Tabs } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { fetchMyProfile, updateMyProfile } from '@/entities/profile';
import { fetchAchievements } from '@/entities/engagement';
import { loadBookAnalytics } from '@/entities/analytics';
import { Achievement, PublicProfile } from '@/shared/types/library';
import { useRequestError } from '@/shared/lib/errors';
import { PageHeader } from '@/shared/ui/PageHeader';
import { ProfileHeader } from './ProfileHeader';
import { ShowcaseTab } from './ShowcaseTab';
import { NumbersTab } from './NumbersTab';
import { PublicTab, type ProfileFormValues } from './PublicTab';
import { AccountTab } from './AccountTab';

const tabKeys = ['showcase', 'numbers', 'public', 'account'] as const;
type TabKey = (typeof tabKeys)[number];

/**
 * Профиль: общая шапка и четыре вкладки вместо одной ленты из восьми карточек.
 *
 * До этого настройки были перемешаны со статистикой: «Оформление» занимало треть ширины ради
 * одного переключателя, удаление аккаунта стояло последним абзацем того же свитка, а понять,
 * что увидят другие, можно было только уйдя на свою публичную страницу и вернувшись.
 *
 * Первым экраном стоит витрина — то, что меняется день ото дня; сводка, публичная страница и
 * учётная запись разведены по своим вкладкам. Адрес помнит вкладку: на неё дают ссылку.
 */
export const ProfilePage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { message } = App.useApp();
  const showRequestError = useRequestError();
  const [searchParams, setSearchParams] = useSearchParams();

  const [profileForm] = Form.useForm<ProfileFormValues>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [saving, setSaving] = useState(false);

  const user = useAppSelector((state) => state.auth.user);
  const analytics = useAppSelector((state) => state.analytics.data);
  const analyticsLoading = useAppSelector((state) => state.analytics.loading);
  const analyticsError = useAppSelector((state) => state.analytics.error);

  const requested = searchParams.get('tab');
  const tab: TabKey = tabKeys.includes(requested as TabKey) ? (requested as TabKey) : 'showcase';

  useEffect(() => {
    if (user?.id) {
      dispatch(loadBookAnalytics(user.id));
    }
  }, [dispatch, user?.id]);

  // Достижения и настройки публичности приходят с сервера: считать их на клиенте значило бы
  // завести вторую систему достижений, расходящуюся с той, что попадает в ленту.
  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchMyProfile(), fetchAchievements()])
      .then(([loaded, unlocked]) => {
        if (cancelled) return;
        setProfile(loaded);
        setAchievements(unlocked);
        profileForm.setFieldsValue({
          displayName: loaded.displayName,
          bio: loaded.bio,
          publicProfile: loaded.publicProfile
        });
      })
      .catch((error) => {
        if (!cancelled) showRequestError(error, 'Не удалось загрузить профиль');
      });
    return () => {
      cancelled = true;
    };
  }, [profileForm, showRequestError]);

  const saveProfile = async (values: ProfileFormValues) => {
    setSaving(true);
    try {
      setProfile(await updateMyProfile(values));
      message.success('Профиль сохранён');
    } catch (error) {
      showRequestError(error, 'Не удалось сохранить профиль');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Профиль"
        hideTitleOnMobile
        subtitle="Что вы читаете, что видят другие и чем управляется учётная запись"
      />

      <ProfileHeader profile={profile} />

      <Tabs
        activeKey={tab}
        onChange={(key) => setSearchParams(key === 'showcase' ? {} : { tab: key })}
        items={[
          {
            key: 'showcase',
            label: 'Витрина',
            children: <ShowcaseTab analytics={analytics} loading={analyticsLoading} />
          },
          {
            key: 'numbers',
            label: 'Числа',
            children: (
              <NumbersTab
                analytics={analytics}
                loading={analyticsLoading}
                error={analyticsError}
                achievements={achievements}
              />
            )
          },
          {
            key: 'public',
            label: 'Публичная страница',
            children: <PublicTab form={profileForm} profile={profile} saving={saving} onSave={saveProfile} />
          },
          { key: 'account', label: 'Аккаунт', children: <AccountTab /> }
        ]}
      />
    </div>
  );
};

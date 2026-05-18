/** 與 Notion「Gender」Select 選項一致 */
export const USER_GENDER_OPTIONS = ["男生", "女生", "不分"] as const;

export type UserGender = (typeof USER_GENDER_OPTIONS)[number];

export function isUserGender(value: string): value is UserGender {
  return (USER_GENDER_OPTIONS as readonly string[]).includes(value);
}

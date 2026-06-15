import { PronunciationType } from 'src/generated/prisma/enums';

export class UserDto {
  nickname: string;
  wordLevel: number;
  dailyWordCount: number;
  pronType: PronunciationType;
  isWechatUser: boolean;
  isGoogleUser: boolean;
  createdAt: Date;
}

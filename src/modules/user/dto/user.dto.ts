import { PronunciationType } from 'src/generated/prisma/enums';

export class UserDto {
  nickname: string;
  wordLevel: number;
  dailyWordCount: number;
  pronType: PronunciationType;
  createdAt: Date;
}

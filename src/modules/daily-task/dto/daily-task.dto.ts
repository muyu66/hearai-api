import { QuestionMode } from 'src/generated/prisma/enums';

export class TodayWordDto {
  id: bigint;
  questionMode: QuestionMode;
  question: string;
  ukPronunciation: string | null;
  usPronunciation: string | null;
  answers: string[];
  correctAnswerIndex: number;
}

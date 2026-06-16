import { QuestionMode } from 'src/generated/prisma/enums';

export class TodayWordDto {
  id: string;
  taskId: string;
  questionMode: QuestionMode;
  question: string;
  ukPronunciation: string | null;
  usPronunciation: string | null;
  answers: string[];
  correctAnswerIndex: number;
}

/**
 * 下一次生成单词任务的时间 (最低时间)
 */
export class NextTaskTimeDto {
  hours: number;
  tomorrow: boolean;
}

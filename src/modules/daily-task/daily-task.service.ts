import { Injectable, Logger } from '@nestjs/common';
import { differenceInHours, format } from 'date-fns';
import { randomInt, shuffle } from 'es-toolkit';
import { DailyTask, Word } from 'src/generated/prisma/client';
import { QuestionMode } from 'src/generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { NextTaskTimeDto, TodayWordDto } from './dto/daily-task.dto';
import { ReportDailyTaskWordDto } from './dto/report-daily-task-word.dto';

type WordOptionData = {
  translation?: string | null;
  usPhonetic?: string | null;
};

const QUESTION_CONFIG = {
  [QuestionMode.WORD_TO_TRAN]: {
    question: (wordModel: Word) => wordModel.word,
    answer: (wordModel: Word) => wordModel.translation,
    confused: (wordModel: Word) => wordModel.confusedTranslations as string[],
    getter: (map: Map<string, WordOptionData>, key: string) =>
      map.get(key)?.translation,
  },

  [QuestionMode.WORD_TO_SOUND]: {
    question: (wordModel: Word) => wordModel.word,
    answer: (wordModel: Word) => wordModel.usPhonetic,
    confused: (wordModel: Word) => wordModel.confusedUsPhonetics as string[],
    getter: (map: Map<string, WordOptionData>, key: string) =>
      map.get(key)?.usPhonetic,
  },

  [QuestionMode.SOUND_TO_TRAN]: {
    question: (wordModel: Word) => wordModel.usPhonetic,
    answer: (wordModel: Word) => wordModel.translation,
    confused: (wordModel: Word) => wordModel.confusedTranslations as string[],
    getter: (map: Map<string, WordOptionData>, key: string) =>
      map.get(key)?.translation,
  },

  [QuestionMode.TRAN_TO_WORD]: {
    question: (wordModel: Word) => wordModel.translation,
    answer: (wordModel: Word) => wordModel.word,
    confused: (wordModel: Word) => wordModel.confusedWords as string[],
    getter: (_map: Map<string, WordOptionData>, key: string) => key,
  },
} as const;

@Injectable()
export class DailyTaskService {
  private readonly logger = new Logger(DailyTaskService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建今日的整套任务
   * @param userId
   * @param today
   * @returns
   */
  private async createTodayWords(
    userId: bigint,
    today: string,
    dailyWordCount: number,
  ): Promise<DailyTask> {
    return this.prisma.$transaction(async (tx) => {
      const dailyTask = await tx.dailyTask.create({
        data: {
          userId,
          taskCount: dailyWordCount,
          isFinished: false,
          finishedAt: null,
          createdDate: today,
        },
      });
      const words = await tx.word.findMany({
        where: {
          deletedAt: null,
        },
        select: {
          id: true,
        },
        take: dailyWordCount,
        skip: 0,
      });
      await tx.dailyTaskWord.createMany({
        data: words.map((word) => {
          return {
            dailyTaskId: dailyTask.id,
            userId,
            wordId: word.id,
            // 学习模式 给出 WORD_TO_TRAN
            questionMode: QuestionMode.WORD_TO_TRAN,
            isFinished: false,
            finishedAt: null,
            createdDate: today,
            failedCount: 0,
            thinkingTime: 0,
          };
        }),
      });
      return dailyTask;
    });
  }

  /**
   * 创建或获取Task
   * @param userId
   * @param now
   * @param today
   * @returns
   */
  private async findOrCreateTask(
    userId: bigint,
    now: Date,
    today: string,
    dailyWordCount: number,
  ) {
    // 获取用户最新的任务
    const latestTask = await this.prisma.dailyTask.findFirst({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    if (latestTask) {
      const sameDay = today === latestTask.createdDate;
      const within6Hours = differenceInHours(now, latestTask.updatedAt) < 6;

      // sameDay 同一天：意味着已经创建过了，仍然沿用之前的任务
      // within6Hours 跨天但不足 6 小时：仍然沿用之前的任务
      if (sameDay || within6Hours) {
        return latestTask;
      }
    }
    // 创建新的task
    return await this.createTodayWords(userId, today, dailyWordCount);
  }

  /**
   * 获取下一次推送单词的时间
   * @param userId
   * @returns
   */
  async getNextTaskTime(userId: bigint): Promise<NextTaskTimeDto> {
    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');

    // 获取用户最新的任务
    const latestTask = await this.prisma.dailyTask.findFirst({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    if (latestTask) {
      const sameDay = today === latestTask.createdDate;
      const diffHours = differenceInHours(now, latestTask.updatedAt);
      const within6Hours = diffHours < 6;

      // 针对短时间跨天的特殊处理
      if (!sameDay && within6Hours) {
        return {
          tomorrow: false,
          hours: diffHours,
        };
      } else {
        return {
          tomorrow: true,
          hours: 0,
        };
      }
    }
    return {
      tomorrow: true,
      hours: 0,
    };
  }

  private buildOptions(
    confusedWords: string[],
    correctAnswer: string,
    getter: (word: string) => string | null | undefined,
  ) {
    const wrongAnswers = shuffle([
      ...new Set(
        confusedWords
          .map(getter)
          .filter((item): item is string => !!item && item !== correctAnswer),
      ),
    ]).slice(0, 2);

    const answers = [...wrongAnswers];

    const correctAnswerIndex = randomInt(0, answers.length + 1);

    answers.splice(correctAnswerIndex, 0, correctAnswer);

    return {
      answers,
      correctAnswerIndex,
    };
  }

  /**
   * 获取今天的单词
   * @param userId
   * @returns
   */
  async getTodayWords(userId: bigint): Promise<TodayWordDto[]> {
    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');

    const user = await this.prisma.user.findUniqueOrThrow({
      where: {
        id: userId,
      },
    });

    const dailyTask = await this.findOrCreateTask(
      userId,
      now,
      today,
      user.dailyWordCount,
    );

    // 已完成今天的任务
    if (dailyTask.isFinished) {
      return [];
    }

    const dailyTaskWords = await this.prisma.dailyTaskWord.findMany({
      where: {
        dailyTaskId: dailyTask.id,
        deletedAt: null,
        isFinished: false,
      },
      include: {
        word: true,
      },
    });

    // 批量获取全部易混淆单词
    const confusedAllWords = [
      ...new Set(
        dailyTaskWords.flatMap((item) => [
          ...((item.word.confusedWords as string[]) ?? []),
          ...((item.word.confusedTranslations as string[]) ?? []),
          ...((item.word.confusedUsPhonetics as string[]) ?? []),
        ]),
      ),
    ];
    // 获取全部易混淆单词模型
    const confusedAllWordModels = await this.prisma.word.findMany({
      where: {
        word: {
          in: confusedAllWords,
        },
      },
      take: 10,
      select: {
        word: true,
        translation: true,
        usPhonetic: true,
      },
    });
    // 缓存
    const confusedWordMap = new Map<string, WordOptionData>();
    for (const item of confusedAllWordModels) {
      if (!item.word) continue;
      confusedWordMap.set(item.word, {
        translation: item.translation,
        usPhonetic: item.usPhonetic,
      });
    }

    // 转换格式
    const res: TodayWordDto[] = [];
    for (const dailyTaskWord of dailyTaskWords) {
      const config = QUESTION_CONFIG[dailyTaskWord.questionMode];

      if (!config) {
        this.logger.error(
          `Invalid question mode: ${dailyTaskWord.questionMode}`,
        );
        continue;
      }

      const wordModel = dailyTaskWord.word;

      const { answers, correctAnswerIndex } = this.buildOptions(
        config.confused(wordModel),
        config.answer(wordModel),
        (key) => config.getter(confusedWordMap, key),
      );

      res.push({
        id: dailyTaskWord.id.toString(),
        taskId: dailyTaskWord.dailyTaskId.toString(),
        questionMode: dailyTaskWord.questionMode,
        question: config.question(wordModel),
        ukPronunciation: wordModel.ukPronunciation,
        usPronunciation: wordModel.usPronunciation,
        answers,
        correctAnswerIndex,
      });
    }
    return res;
  }

  /**
   * 汇报背单词情况
   * @param dto
   * @param userId
   * @returns
   */
  async report(
    taskId: bigint,
    dto: ReportDailyTaskWordDto,
    userId: bigint,
  ): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      // 更新用户每日单词任务
      await tx.dailyTaskWord.update({
        where: {
          id: BigInt(dto.taskWordId),
          dailyTaskId: taskId,
          userId,
          deletedAt: null,
          isFinished: false,
        },
        data: {
          isFinished: true,
          finishedAt: new Date(),
          failedCount: dto.failedCount,
          thinkingTime: dto.thinkingTime,
          master: dto.master,
        },
      });

      const unfinishedCount = await tx.dailyTaskWord.count({
        where: {
          dailyTaskId: taskId,
          userId,
          deletedAt: null,
          isFinished: false,
        },
      });
      // 已经没有未结束的，则更新 dailyTask 表
      if (unfinishedCount === 0) {
        await tx.dailyTask.update({
          where: {
            id: taskId,
            userId,
            deletedAt: null,
            isFinished: false,
          },
          data: {
            isFinished: true,
            finishedAt: new Date(),
          },
        });
      }
    });
  }
}

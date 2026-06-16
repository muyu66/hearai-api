import { Injectable, Logger } from '@nestjs/common';
import { differenceInHours, format } from 'date-fns';
import { DailyTask } from 'src/generated/prisma/client';
import { QuestionMode } from 'src/generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { TodayWordDto } from './dto/daily-task.dto';
import { ReportDailyTaskWordDto } from './dto/report-daily-task-word.dto';

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
  ): Promise<DailyTask> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({
        where: {
          id: userId,
        },
        select: {
          dailyWordCount: true,
        },
      });
      const dailyTask = await tx.dailyTask.create({
        data: {
          userId,
          taskCount: user.dailyWordCount,
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
        take: user.dailyWordCount,
        skip: 0,
      });
      await tx.dailyTaskWord.createMany({
        data: words.map((word) => {
          return {
            dailyTaskId: dailyTask.id,
            userId,
            wordId: word.id,
            // TODO 计算出来的
            questionMode: QuestionMode.TRAN_TO_WORD,
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
  private async findOrCreateTask(userId: bigint, now: Date, today: string) {
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

      // sameDay 同一天：意味着已经创建过了，仍然沿用今天的任务
      // within6Hours 跨天但不足 6 小时：仍然沿用昨天的任务
      if (sameDay || within6Hours) {
        return latestTask;
      }
    }
    // 创建新的task
    return await this.createTodayWords(userId, today);
  }

  /**
   * 获取今天的单词
   * @param userId
   * @returns
   */
  async getTodayWords(userId: bigint): Promise<TodayWordDto[]> {
    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');

    const dailyTask = await this.findOrCreateTask(userId, now, today);

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

    // 转换格式
    const res: TodayWordDto[] = [];
    for (const dailyTaskWord of dailyTaskWords) {
      const { word, translation, ukPronunciation, usPronunciation } =
        dailyTaskWord.word;

      switch (dailyTaskWord.questionMode) {
        case QuestionMode.SOUND_TO_TRAN:
        case QuestionMode.WORD_TO_TRAN:
          res.push({
            id: dailyTaskWord.id,
            questionMode: dailyTaskWord.questionMode,
            question: word,
            ukPronunciation,
            usPronunciation,
            answers: [translation, translation, translation],
            correctAnswerIndex: 0,
          });
          break;
        case QuestionMode.SOUND_TO_WORD:
        case QuestionMode.TRAN_TO_WORD:
          res.push({
            id: dailyTaskWord.id,
            questionMode: dailyTaskWord.questionMode,
            question: translation,
            ukPronunciation,
            usPronunciation,
            answers: [word, word, word],
            correctAnswerIndex: 0,
          });
          break;
        default:
          this.logger.error(
            `Invalid question mode: dailyWord.id=${dailyTaskWord.id} dailyWord.questionMode=${String(dailyTaskWord.questionMode)}`,
          );
      }
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
          id: dto.taskWordId,
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

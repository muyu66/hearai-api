import { Injectable } from '@nestjs/common';
import { clamp, randomInt, shuffle } from 'es-toolkit';
import { MAX_DAILY_WORD_COUNT } from 'src/common/constants/constants';
import { QuestionMode } from 'src/generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class LearningWordService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 挑选学习单词
   * 随机挑选从未学习过的单词
   * @param level
   * @param learningWordCount
   * @returns
   */
  async pickLearningWords(
    userId: bigint,
    level: number,
    learningWordCount: number,
  ): Promise<{ id: bigint; word: string; questionMode: QuestionMode }[]> {
    const count = await this.prisma.word.count({
      where: {
        level,
        dailyTaskWords: {
          none: { userId },
        },
      },
    });
    // 无词可学
    if (count === 0) {
      return [];
    }

    const skip = randomInt(0, clamp(count - MAX_DAILY_WORD_COUNT, 0, count));

    // 别人的错题
    const otherFailedWords = await this.prisma.dailyTaskWord.findMany({
      where: {
        word: {
          level,
        },
        userId: {
          not: {
            equals: userId,
          },
        },
      },
      select: {
        wordId: true,
      },
      take: MAX_DAILY_WORD_COUNT * 10, // dailyWordCount 最大为100
      distinct: 'wordId',
      orderBy: [
        {
          failedCount: 'desc',
        },
        {
          thinkingTime: 'desc',
        },
      ],
    });
    const otherCandidates =
      otherFailedWords.length === 0
        ? []
        : await this.prisma.word.findMany({
            where: {
              level,
              dailyTaskWords: {
                none: { userId }, // 不存在任何关联记录
              },
              id: {
                in: otherFailedWords.map((item) => item.wordId),
              },
            },
            select: {
              id: true,
              word: true,
            },
            take: MAX_DAILY_WORD_COUNT, // dailyWordCount 最大为100
            skip,
            orderBy: {
              id: 'asc',
            },
          });

    // 如果别人的错题已经能满足需求
    if (otherCandidates.length > MAX_DAILY_WORD_COUNT) {
      const learningWords = shuffle(otherCandidates).slice(
        0,
        learningWordCount,
      );
      return learningWords.map((word) => ({
        id: word.id,
        word: word.word,
        questionMode: QuestionMode.WORD_TO_TRAN,
      }));
    }

    // 默认获取用户未学习过的单词
    const fallbackCandidates = await this.prisma.word.findMany({
      where: {
        level,
        dailyTaskWords: {
          none: { userId }, // 不存在任何关联记录
        },
      },
      select: {
        id: true,
        word: true,
      },
      skip,
      take: MAX_DAILY_WORD_COUNT, // dailyWordCount 最大为100
      orderBy: {
        id: 'asc',
      },
    });

    // 混合别人的错题和随机抽取的保底单词
    const learningWords = shuffle([
      ...otherCandidates,
      ...fallbackCandidates,
    ]).slice(0, learningWordCount);
    return learningWords.map((word) => ({
      id: word.id,
      word: word.word,
      questionMode: QuestionMode.WORD_TO_TRAN,
    }));
  }
}

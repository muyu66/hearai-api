import { SPEAKERS } from '@/common/constants/constants';
import { Injectable } from '@nestjs/common';
import { clamp, randomInt, sample, shuffle } from 'es-toolkit';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class LearningSentenceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 挑选学习语句
   * 冷启动：随机抽取未学习过的语句
   * 热启动：获取非自己以外容易出错的语句
   * @param sentenceLevel
   * @param learningWordCount
   * @returns
   */
  async pickLearningSentences(
    userId: bigint,
    sentenceLevel: number,
    learningWordCount: number,
  ): Promise<{ sentenceId: bigint; speaker: string }[]> {
    // 从未学习过的语句数量
    const count = await this.prisma.sentence.count({
      where: {
        level: sentenceLevel,
        userSentenceHistory: {
          none: { userId },
        },
      },
    });
    // 无句可学
    if (count === 0) {
      return [];
    }

    const skip = randomInt(0, clamp(count - learningWordCount, 0, count));

    // 别人的热门错题，且我从未学习过
    const hotFailedCandidates = await this.prisma.userSentenceHistory.findMany({
      where: {
        sentence: {
          level: sentenceLevel,
        },
        userId: {
          not: {
            equals: userId,
          },
        },
      },
      select: {
        sentenceId: true,
        speaker: true,
      },
      take: 1000,
      distinct: 'sentenceId',
      orderBy: [
        {
          hintCount: 'desc',
        },
        {
          thinkingTime: 'desc',
        },
      ],
    });

    // 如果别人的错题 (我从未学习过) 已经能满足需求，热启动
    if (hotFailedCandidates.length > learningWordCount) {
      const learningSentences = shuffle(hotFailedCandidates).slice(
        0,
        learningWordCount,
      );
      return learningSentences.map((sentence) => ({
        sentenceId: sentence.sentenceId,
        speaker: sentence.speaker, // 直接返回最容易出错的 Speaker
      }));
    }

    // 默认获取用户未学习过的单词，冷启动
    const defaultCandidates = await this.prisma.sentence.findMany({
      where: {
        level: sentenceLevel,
        userSentenceHistory: {
          none: { userId }, // 不存在任何关联记录
        },
      },
      select: {
        id: true,
      },
      skip,
      take: learningWordCount,
      orderBy: {
        id: 'asc',
      },
    });

    // 混合热题和随机抽取的保底单词
    const learningSentences = shuffle([
      ...hotFailedCandidates.map((v) => ({
        id: v.sentenceId,
        speaker: v.speaker,
      })),
      ...defaultCandidates.map((v) => ({
        id: v.id,
        speaker: sample(SPEAKERS), // 要求每次都是随机
      })),
    ]).slice(0, learningWordCount);
    return learningSentences.map((sentence) => ({
      sentenceId: sentence.id,
      speaker: sentence.speaker,
    }));
  }
}

import { SPEAKERS } from '@/common/constants/constants';
import { PrismaService } from '@/database/prisma.service';
import { Injectable } from '@nestjs/common';
import { groupBy, maxBy, minBy, sample, without } from 'es-toolkit';

// 语句的复习紧迫程度打分
type SentenceUrgencyScore = {
  sentenceId: bigint;
  // 复习紧迫度
  urgency: number;
  // 预测错误风险
  predictedFailRisk: number;
  // 预测思考时长
  predictedThinkingTime: number;
  // 最近未复习时长
  recency: number;
  // 复习间隔超期程度
  intervalOverdue: number;
  // 上次复习日期
  lastCreatedAt: Date;
  // 最陌生的Speaker
  strangeSpeaker: string;
};

type SentenceRecord = {
  sentenceId: bigint;
  hintCount: number;
  thinkingTime: number;
  createdAt: Date;
  speaker: string;
};

@Injectable()
export class ReviewSentenceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 直接返回最紧迫的复习语句
   * (无视难度)
   */
  async pickReviewSentences(
    userId: bigint,
    limit: number,
  ): Promise<{ sentenceId: bigint; speaker: string }[]> {
    // 获取最近的语句复习记录
    const histories = await this.prisma.userSentenceHistory.findMany({
      where: {
        userId,
        isFinished: true,
      },
      select: {
        sentenceId: true,
        createdAt: true,
        hintCount: true,
        thinkingTime: true,
        speaker: true,
      },
      orderBy: [
        {
          createdAt: 'asc',
        },
      ],
      take: 1000,
    });
    if (histories.length === 0) return [];

    // 计算复习紧迫度
    const rankedSentences = this.rankReviewSentences(histories);

    return rankedSentences.slice(0, limit).map((sentence) => ({
      sentenceId: sentence.sentenceId,
      // 优先推送没听过没错过的Speaker
      speaker: sample(
        without(Object.values(SPEAKERS), sentence.strangeSpeaker),
      ),
    }));
  }

  /**
   * 计算复习紧迫度
   */
  private rankReviewSentences(
    histories: SentenceRecord[],
  ): SentenceUrgencyScore[] {
    const scores: SentenceUrgencyScore[] = [];

    const mapHistories = groupBy(histories, (item) => String(item.sentenceId));
    const today = new Date();

    for (const sentenceIdStr in mapHistories) {
      const score = this.scoreSentence(
        BigInt(sentenceIdStr),
        mapHistories[sentenceIdStr],
        today,
      );
      if (score) scores.push(score);
    }

    scores.sort((a, b) => b.urgency - a.urgency);
    return scores;
  }

  /**
   * 计算语句的复习紧迫度
   */
  private scoreSentence(
    sentenceId: bigint,
    sentenceRecords: SentenceRecord[],
    today: Date,
  ): SentenceUrgencyScore | null {
    if (sentenceRecords.length === 0) return null;

    // EWMA 参数：越大越看重最近一次记录
    const alpha = 0.45;
    const gapAlpha = 0.35;

    let ewmaFailed = sentenceRecords[0].hintCount;
    let ewmaThinking = sentenceRecords[0].thinkingTime;
    let avgGapDays: number | null = null;

    let prevDate = sentenceRecords[0].createdAt;
    const lastDate = prevDate;

    for (let i = 1; i < sentenceRecords.length; i++) {
      const item = sentenceRecords[i];
      const currDate = item.createdAt;

      const gapDays = this.diffDays(prevDate, currDate);
      if (gapDays > 0) {
        avgGapDays =
          avgGapDays === null
            ? gapDays
            : gapAlpha * gapDays + (1 - gapAlpha) * avgGapDays;
      }

      ewmaFailed = alpha * item.hintCount + (1 - alpha) * ewmaFailed;
      ewmaThinking = alpha * item.thinkingTime + (1 - alpha) * ewmaThinking;

      prevDate = currDate;
    }

    const recencyDays = Math.max(0, this.diffDays(lastDate, today));

    // 0 ~ 1
    const predictedFailRisk = this.clamp(1 - Math.exp(-ewmaFailed), 0, 1);

    // thinkingTime 通常右偏，先 log 再压到 0~1
    const predictedThinkingTime = this.clamp(
      Math.log1p(ewmaThinking) / Math.log1p(15000),
      0,
      1,
    );

    // 越久没复习越高，3 天左右开始明显上升
    const recency = this.clamp(1 - Math.exp(-recencyDays / 3), 0, 1);

    // 用历史平均间隔估计“是否逾期”
    const intervalOverdue =
      avgGapDays && avgGapDays > 0
        ? this.clamp(recencyDays / avgGapDays - 1, 0, 3) / 3
        : recency;

    // 你可以按业务偏好调权重
    const w1 = 0.45; // hintCount 风险
    const w2 = 0.25; // thinkingTime 风险
    const w3 = 0.2; // recency
    const w4 = 0.1; // overdue

    const urgency =
      w1 * predictedFailRisk +
      w2 * predictedThinkingTime +
      w3 * recency +
      w4 * intervalOverdue;

    const latestSentenceRecord =
      maxBy(sentenceRecords, (item) => item.createdAt.getTime()) ||
      sentenceRecords[sentenceRecords.length - 1];

    // 最陌生的Speaker
    const strangeSpeaker =
      minBy(
        Object.entries(groupBy(sentenceRecords, (item) => item.speaker)),
        ([, items]) => items.reduce((sum, item) => sum + item.hintCount, 0),
      )?.[0] || latestSentenceRecord.speaker;

    return {
      sentenceId,
      urgency,
      predictedFailRisk,
      predictedThinkingTime,
      recency,
      intervalOverdue,
      lastCreatedAt: latestSentenceRecord.createdAt,
      strangeSpeaker,
    };
  }

  private diffDays(a: Date, b: Date): number {
    const ms = b.getTime() - a.getTime();
    return Math.floor(ms / 86400000);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}

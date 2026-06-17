import { Injectable } from '@nestjs/common';
import { groupBy, maxBy, sample, without } from 'es-toolkit';
import { PrismaService } from 'src/database/prisma.service';
import { QuestionMode } from 'src/generated/prisma/enums';

type DailyWordHistory = {
  wordId: bigint;
  createdDate: string; // YYYY-MM-DD
  failedCount: number;
  thinkingTime: number; // ms
  questionMode: QuestionMode;
};

type WordUrgencyScore = {
  wordId: bigint;
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
  lastCreatedDate: string;
  // 该单词最薄弱的题型
  weakestQuestionMode: QuestionMode;
};

type DailyRecordsMap = Map<
  string,
  {
    createdDate: string;
    failedCount: number;
    thinkingTime: number;
    questionMode: QuestionMode;
  }
>;

@Injectable()
export class ReviewWordService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 直接返回今天最紧迫的复习单词
   */
  async pickReviewWords(
    userId: bigint,
    level: number,
    limit = 10,
  ): Promise<{ id: bigint; questionMode: QuestionMode }[]> {
    const scores = await this.rankReviewWords(userId, level);

    return scores.slice(0, limit).map((item) => ({
      id: item.wordId,
      // 用该单词最容易错的其它题型
      questionMode: sample(
        without(Object.values(QuestionMode), item.weakestQuestionMode),
      ),
    }));
  }

  /**
   * 为该用户、该 level 下所有历史单词计算复习紧迫度
   */
  private async rankReviewWords(
    userId: bigint,
    level: number,
  ): Promise<WordUrgencyScore[]> {
    const history = await this.prisma.dailyTaskWord.findMany({
      where: {
        userId,
        word: {
          level,
        },
        // 只有finished才有具体数据可供分析
        isFinished: true,
      },
      select: {
        wordId: true,
        createdDate: true,
        failedCount: true,
        thinkingTime: true,
        questionMode: true,
      },
      orderBy: [
        {
          wordId: 'asc',
        },
        {
          createdDate: 'asc',
        },
      ],
    });

    if (history.length === 0) return [];

    const grouped = this.groupByWordAndDate(history);
    const today = this.parseYmd(this.formatYmd(new Date()));

    const scores: WordUrgencyScore[] = [];

    for (const [wordId, dailyRecords] of grouped.entries()) {
      const score = this.scoreWord(wordId, dailyRecords, today);
      if (score) scores.push(score);
    }

    scores.sort((a, b) => b.urgency - a.urgency);
    return scores;
  }

  /**
   * 同一单词同一天可能有多个题型，把它们聚合成“日粒度”
   */
  private groupByWordAndDate(records: DailyWordHistory[]) {
    const map = new Map<bigint, DailyRecordsMap>();

    for (const record of records) {
      let byDate = map.get(record.wordId);
      if (!byDate) {
        byDate = new Map();
        map.set(record.wordId, byDate);
      }

      const existing = byDate.get(record.createdDate);
      if (existing) {
        existing.failedCount += record.failedCount;
        existing.thinkingTime += record.thinkingTime;
      } else {
        byDate.set(record.createdDate, {
          createdDate: record.createdDate,
          failedCount: record.failedCount,
          thinkingTime: record.thinkingTime,
          questionMode: record.questionMode,
        });
      }
    }

    return map;
  }

  /**
   * 对单个词计算紧迫度
   */
  private scoreWord(
    wordId: bigint,
    dailyRecordsMap: DailyRecordsMap,
    today: Date,
  ): WordUrgencyScore | null {
    const dailyRecords = [...dailyRecordsMap.values()].sort((a, b) =>
      a.createdDate.localeCompare(b.createdDate),
    );

    if (dailyRecords.length === 0) return null;

    // EWMA 参数：越大越看重最近一次记录
    const alpha = 0.45;
    const gapAlpha = 0.35;

    let ewmaFailed = dailyRecords[0].failedCount;
    let ewmaThinking = dailyRecords[0].thinkingTime;
    let avgGapDays: number | null = null;

    let prevDate = this.parseYmd(dailyRecords[0].createdDate);
    const lastDate = prevDate;

    for (let i = 1; i < dailyRecords.length; i++) {
      const item = dailyRecords[i];
      const currDate = this.parseYmd(item.createdDate);

      const gapDays = this.diffDays(prevDate, currDate);
      if (gapDays > 0) {
        avgGapDays =
          avgGapDays === null
            ? gapDays
            : gapAlpha * gapDays + (1 - gapAlpha) * avgGapDays;
      }

      ewmaFailed = alpha * item.failedCount + (1 - alpha) * ewmaFailed;
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
    const w1 = 0.45; // failed 风险
    const w2 = 0.25; // thinkingTime 风险
    const w3 = 0.2; // recency
    const w4 = 0.1; // overdue

    const urgency =
      w1 * predictedFailRisk +
      w2 * predictedThinkingTime +
      w3 * recency +
      w4 * intervalOverdue;

    const weakestQuestionMode = (maxBy(
      Object.entries(groupBy(dailyRecords, (item) => item.questionMode)),
      ([, items]) => items.reduce((sum, item) => sum + item.failedCount, 0),
    )?.[0] || QuestionMode.WORD_TO_TRAN) as QuestionMode;

    return {
      wordId,
      urgency,
      predictedFailRisk,
      predictedThinkingTime,
      recency,
      intervalOverdue,
      lastCreatedDate: dailyRecords[dailyRecords.length - 1].createdDate,
      weakestQuestionMode,
    };
  }

  private parseYmd(ymd: string): Date {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  }

  private formatYmd(date: Date): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private diffDays(a: Date, b: Date): number {
    const ms = b.getTime() - a.getTime();
    return Math.floor(ms / 86400000);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}

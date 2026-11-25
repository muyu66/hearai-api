import { OssService } from '@/common/providers/oss.provider';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ReportSentenceHistoryDto } from './dto/report-sentence-history.dto';
import { LearningSentenceService } from './learning-sentence.service';
import { ReviewSentenceService } from './review-sentence.service';
import { UserSentenceHistoryDto } from './dto/sentence.dto';

@Injectable()
export class SentenceService {
  private readonly logger = new Logger(SentenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly learningSentenceService: LearningSentenceService,
    private readonly reviewSentenceService: ReviewSentenceService,
    private readonly ossService: OssService,
  ) {}

  /**
   * 获取今天的单词
   * @param userId
   * @returns
   */
  async getSentences(userId: bigint): Promise<UserSentenceHistoryDto[]> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: {
        id: userId,
      },
    });

    // 按需 推动下一批次语句生成
    await this.planNext(userId, user.sentenceLevel);

    const userSentenceHistories =
      await this.prisma.userSentenceHistory.findMany({
        where: {
          userId,
          isFinished: false,
        },
        include: {
          sentence: true,
        },
      });

    const pronUrls: { sentenceId: bigint; pronUrl: string | null }[] = [];
    await Promise.all(
      userSentenceHistories.map(async (userSentenceHistory) => {
        pronUrls.push({
          sentenceId: userSentenceHistory.sentenceId,
          pronUrl: await this.getPronUrl(
            userSentenceHistory.sentenceId,
            userSentenceHistory.speaker,
          ),
        });
      }),
    );

    return userSentenceHistories.map((userSentenceHistory) => {
      const pronUrl = pronUrls.find(
        (pronUrl) => pronUrl.sentenceId === userSentenceHistory.sentenceId,
      )?.pronUrl;
      return {
        taskId: userSentenceHistory.id.toString(),
        words: userSentenceHistory.sentence.words,
        translation: userSentenceHistory.sentence.translation,
        pronUrl: pronUrl || null,
      };
    });
  }

  private async getPronUrl(
    sentenceId: bigint,
    speaker: string,
  ): Promise<string | null> {
    return this.ossService.generateSignatureUrl(
      `pronunciations/sentence/speakers/${speaker}/ids/${sentenceId.toString()}.wav`,
    );
  }

  /**
   * 汇报语句情况
   * @param id
   * @param dto
   * @param userId
   * @returns
   */
  async report(dto: ReportSentenceHistoryDto, userId: bigint): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: {
        id: userId,
      },
    });

    // 更新用户语句历史
    await this.prisma.userSentenceHistory.update({
      where: {
        id: BigInt(dto.taskId),
        userId,
        isFinished: false,
      },
      data: {
        isFinished: true,
        hintCount: dto.hintCount,
        thinkingTime: dto.thinkingTime,
      },
    });

    // 按需 推动下一批次语句生成
    await this.planNext(userId, user.sentenceLevel);
  }

  /**
   * 创建语句
   * @param userId
   * @param sentences
   * @returns
   */
  private async createUserSentenceHistories(
    userId: bigint,
    sentences: { sentenceId: bigint; speaker: string }[],
  ): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      await tx.userSentenceHistory.createMany({
        data: sentences.map((sentence) => {
          return {
            userId,
            sentenceId: sentence.sentenceId,
            speaker: sentence.speaker,
            isFinished: false,
            hintCount: 0,
            thinkingTime: 0,
          };
        }),
      });
    });
  }

  /**
   * 获取已经规划好的语句
   * @param userId
   * @param lesentenceLevelvel
   * @param planCount
   * @returns
   */
  private async getPlannedSentences(
    userId: bigint,
    sentenceLevel: number,
    planCount: number,
  ): Promise<{ sentenceId: bigint; speaker: string }[]> {
    const reviewRatio = 0.3; // 复习比例
    const reviewCount = Math.floor(planCount * reviewRatio); // 先保证复习的数量，剩下的都是学习数量

    const r = await this.reviewSentenceService.pickReviewSentences(
      userId,
      reviewCount,
    );

    // 计划数量 - 实际复习量 = 学习数量
    const learningWordCount = planCount - r.length;

    const l = await this.learningSentenceService.pickLearningSentences(
      userId,
      sentenceLevel,
      learningWordCount,
    );

    // 先复习，再学习
    return [...r, ...l];
  }

  private async planNext(userId: bigint, sentenceLevel: number): Promise<void> {
    const PLAN_BATCH_COUNT = 10; // 每批次需要规划的语句数量

    const undoneCount = await this.prisma.userSentenceHistory.count({
      where: {
        userId,
        isFinished: false,
      },
    });
    // 预先生成下一批次的语句
    if (undoneCount < PLAN_BATCH_COUNT / 2) {
      // 获取已经规划好的语句
      const sentences = await this.getPlannedSentences(
        userId,
        sentenceLevel,
        PLAN_BATCH_COUNT,
      );
      // 写入数据库
      await this.createUserSentenceHistories(userId, sentences);
    }
  }
}

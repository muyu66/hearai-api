import { OssService } from '@/common/providers/oss.provider';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ReportSentenceHistoryDto } from './dto/report-sentence-history.dto';
import { LearningSentenceService } from './learning-sentence.service';
import { ReviewSentenceService } from './review-sentence.service';
import { UserSentenceHistoryDto } from './dto/sentence.dto';
import { WordTokenizer } from 'natural';
import { Sentence, UserSentenceHistory } from '@/generated/prisma/client';

@Injectable()
export class SentenceService {
  private readonly logger = new Logger(SentenceService.name);
  private readonly tokenizer = new WordTokenizer();

  constructor(
    private readonly prisma: PrismaService,
    private readonly learningSentenceService: LearningSentenceService,
    private readonly reviewSentenceService: ReviewSentenceService,
    private readonly ossService: OssService,
  ) {}

  /**
   * 获取初始语句
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
    await this.getPlannedNext(userId, user.sentenceLevel);

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

    return this.formatDto(userSentenceHistories);
  }

  /**
   * 获取追加语句
   * @param userId
   * @returns
   */
  async getNextSentences(userId: bigint): Promise<UserSentenceHistoryDto[]> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: {
        id: userId,
      },
    });

    // 按需 推动下一批次语句生成
    const historyIds = await this.getPlannedNext(userId, user.sentenceLevel);
    if (historyIds.length === 0) {
      return [];
    }

    const userSentenceHistories =
      await this.prisma.userSentenceHistory.findMany({
        where: {
          id: {
            in: historyIds,
          },
          userId,
          isFinished: false,
        },
        include: {
          sentence: true,
        },
      });

    return this.formatDto(userSentenceHistories);
  }

  private async formatDto(
    userSentenceHistories: (UserSentenceHistory & { sentence: Sentence })[],
  ): Promise<UserSentenceHistoryDto[]> {
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
      const tokenizeWords = this.tokenizer
        .tokenize(userSentenceHistory.sentence.words)
        .map((v) => v.toLowerCase());

      const pronUrl = pronUrls.find(
        (pronUrl) => pronUrl.sentenceId === userSentenceHistory.sentenceId,
      )?.pronUrl;
      return {
        taskId: userSentenceHistory.id.toString(),
        tokenizeWords,
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
      `sentence_pronunciations/speakers/${speaker}/ids/${sentenceId.toString()}.wav`,
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
  }

  /**
   * 创建语句任务
   * @param userId
   * @param sentences
   * @returns 语句任务的ids
   */
  private async createUserSentenceHistories(
    userId: bigint,
    sentences: { sentenceId: bigint; speaker: string }[],
  ): Promise<bigint[]> {
    const ids: bigint[] = [];
    await this.prisma.$transaction(async (tx) => {
      for (let i = 1; i < sentences.length; i++) {
        const model = await tx.userSentenceHistory.create({
          data: {
            userId,
            sentenceId: sentences[i].sentenceId,
            speaker: sentences[i].speaker,
            isFinished: false,
            hintCount: 0,
            thinkingTime: 0,
          },
        });
        ids.push(model.id);
      }
    });
    return ids;
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

  /**
   * 按需 推动下一批次语句生成
   * @param userId
   * @param sentenceLevel
   * @returns 生成后的新语句ids
   */
  private async getPlannedNext(
    userId: bigint,
    sentenceLevel: number,
  ): Promise<bigint[]> {
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
      return this.createUserSentenceHistories(userId, sentences);
    }
    return [];
  }
}

import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SentenceController } from './sentence.controller';
import { SentenceService } from './sentence.service';
import { ReviewSentenceService } from './review-sentence.service';
import { LearningSentenceService } from './learning-sentence.service';
import { OssService } from '@/common/providers/oss.provider';

@Module({
  imports: [],
  controllers: [SentenceController],
  providers: [
    OssService,
    PrismaService,
    SentenceService,
    ReviewSentenceService,
    LearningSentenceService,
  ],
  exports: [],
})
export class SentenceModule {}

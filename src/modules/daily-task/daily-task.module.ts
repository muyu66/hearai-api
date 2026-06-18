import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DailyTaskController } from './daily-task.controller';
import { DailyTaskService } from './daily-task.service';
import { ReviewWordService } from './review-word.service';
import { LearningWordService } from './learning-word.service';
import { OssService } from 'src/common/providers/oss.provider';

@Module({
  imports: [],
  controllers: [DailyTaskController],
  providers: [
    OssService,
    PrismaService,
    DailyTaskService,
    ReviewWordService,
    LearningWordService,
  ],
  exports: [],
})
export class DailyTaskModule {}

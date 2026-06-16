import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DailyTaskController } from './daily-task.controller';
import { DailyTaskService } from './daily-task.service';

@Module({
  imports: [],
  controllers: [DailyTaskController],
  providers: [PrismaService, DailyTaskService],
  exports: [],
})
export class DailyTaskModule {}

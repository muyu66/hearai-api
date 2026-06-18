import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/interfaces/auth-user.interface';
import { DailyTaskService } from './daily-task.service';
import { NextTaskTimeDto, TodayWordDto } from './dto/daily-task.dto';
import { ReportDailyTaskWordDto } from './dto/report-daily-task-word.dto';

@Controller('api/daily-tasks')
export class DailyTaskController {
  constructor(private readonly dailyTaskService: DailyTaskService) {}

  @Get('today-words')
  async getTodayWords(@CurrUser() authUser: AuthUser): Promise<TodayWordDto[]> {
    return this.dailyTaskService.getTodayWords(BigInt(authUser.userId));
  }

  @Get('next-task-time')
  async getNextTaskTime(
    @CurrUser() authUser: AuthUser,
  ): Promise<NextTaskTimeDto> {
    return this.dailyTaskService.getNextTaskTime(BigInt(authUser.userId));
  }

  @Post(':taskId/report')
  async report(
    @Param('taskId') taskId: string,
    @Body() body: ReportDailyTaskWordDto,
    @CurrUser() authUser: AuthUser,
  ): Promise<void> {
    await this.dailyTaskService.report(
      BigInt(taskId),
      body,
      BigInt(authUser.userId),
    );
  }
}

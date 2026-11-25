import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ReportSentenceHistoryDto } from './dto/report-sentence-history.dto';
import { UserSentenceHistoryDto } from './dto/sentence.dto';
import { SentenceService } from './sentence.service';

@Controller('api/sentences')
export class SentenceController {
  constructor(private readonly sentenceService: SentenceService) {}

  @Get()
  async getSentences(
    @CurrUser() authUser: AuthUser,
  ): Promise<UserSentenceHistoryDto[]> {
    return this.sentenceService.getSentences(BigInt(authUser.userId));
  }

  @Post('report')
  async report(
    @Body() body: ReportSentenceHistoryDto,
    @CurrUser() authUser: AuthUser,
  ): Promise<void> {
    await this.sentenceService.report(body, BigInt(authUser.userId));
  }
}

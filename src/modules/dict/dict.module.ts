import { OssService } from '@/common/providers/oss.provider';
import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DictController } from './dict.controller';
import { DictService } from './dict.service';

@Module({
  imports: [],
  controllers: [DictController],
  providers: [OssService, PrismaService, DictService],
  exports: [],
})
export class DictModule {}

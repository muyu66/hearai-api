import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: bigint) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    return user;
  }

  async update(id: bigint, dto: UpdateUserDto) {
    await this.findById(id);

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.wordLevel != null ? { wordLevel: dto.wordLevel } : {}),
        ...(dto.dailyWordCount != null
          ? { dailyWordCount: dto.dailyWordCount }
          : {}),
        ...(dto.pronType != null ? { pronType: dto.pronType } : {}),
      },
    });
  }
}

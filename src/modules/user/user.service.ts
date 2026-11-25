import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from '@/generated/prisma/client';
import { generateCuteNickname } from 'cute-nickname';
import { makeId } from '@/common/tools/tool';

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

  async findByWechatOpenId(wechatOpenid: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { wechatOpenid, deletedAt: null },
    });
  }

  async findByGoogleOpenId(googleOpenid: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { googleOpenid, deletedAt: null },
    });
  }

  /**
   * 创建用户
   * @param dto wechatOpenid 与 googleOpenid 必须二选一
   * @returns
   */
  async create(dto: {
    wechatOpenid: string | null;
    googleOpenid: string | null;
  }): Promise<User> {
    const { wechatOpenid, googleOpenid } = dto;

    if (wechatOpenid === null && googleOpenid === null) {
      throw new BadRequestException(
        'wechatOpenid or googleOpenid must be provided',
      );
    }

    const id = makeId(12);
    return this.prisma.user.create({
      data: {
        username: wechatOpenid !== null ? 'wechat_' + id : 'google_' + id,
        nickname: generateCuteNickname({ forcePrefix: true }),
        // 新用户默认难度
        sentenceLevel: 0,
        wechatOpenid,
        googleOpenid,
      },
    });
  }

  async update(id: bigint, dto: UpdateUserDto) {
    await this.findById(id);

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.sentenceLevel != null
          ? { sentenceLevel: dto.sentenceLevel }
          : {}),
      },
    });
  }
}

import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/interfaces/auth-user.interface';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserDto } from './dto/user.dto';
import { UserService } from './user.service';

@Controller('api/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  async getProfile(@CurrUser() authUser: AuthUser): Promise<UserDto> {
    const user = await this.userService.findById(authUser.userId);
    return {
      nickname: user.nickname,
      wordLevel: user.wordLevel,
      dailyWordCount: user.dailyWordCount,
      pronType: user.pronType,
      isGoogleUser: user.wechatOpenid != null,
      isWechatUser: user.googleOpenid != null,
      createdAt: user.createdAt,
    };
  }

  @Patch('me')
  async updateProfile(
    @CurrUser() authUser: AuthUser,
    @Body() dto: UpdateUserDto,
  ): Promise<boolean> {
    const { wordLevel, dailyWordCount, pronType } = dto;
    await this.userService.update(authUser.userId, {
      wordLevel,
      dailyWordCount,
      pronType,
    });
    return true;
  }
}

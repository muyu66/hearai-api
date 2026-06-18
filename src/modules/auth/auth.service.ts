import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { User } from 'src/generated/prisma/client';
import { AuthUser } from 'src/common/interfaces/auth-user.interface';
import { lastValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { SignInfo } from './dto/sign-info.dto';

@Injectable()
export class AuthService {
  private readonly wechatAppId: string;
  private readonly wechatSecret: string;
  private readonly googleClientId: string;
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.wechatAppId = this.configService.get('WECHAT_APPID', '');
    this.wechatSecret = this.configService.get('WECHAT_SECRET', '');
    this.googleClientId = this.configService.get('GOOGLE_CLIENT_ID', '');
    this.googleClient = new OAuth2Client(this.googleClientId);
  }

  async signUpWechat(code: string): Promise<SignInfo> {
    if (code == null || code === '') {
      throw new BadRequestException('微信授权码不能为空');
    }
    const { openid } = await this.getWechatTokenByCode(code);
    if (openid == null || openid === '') {
      throw new UnauthorizedException('微信授权失败');
    }

    let user = await this.userService.findByWechatOpenId(openid);
    const newUser = !user;
    if (!user) {
      // 可能是微信权限太低了，取不到昵称和unionid
      user = await this.userService.create({
        wechatOpenid: openid,
        googleOpenid: null,
      });
    }

    const accessToken = await this.buildToken(user);
    return { accessToken, newUser };
  }

  async signUpGoogle(idToken: string): Promise<SignInfo> {
    // 验证 Google token
    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience: this.googleClientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid Google token');
    }
    const googleOpenid = payload.sub;

    let user = await this.userService.findByGoogleOpenId(googleOpenid);
    const newUser = !user;
    if (!user) {
      user = await this.userService.create({
        wechatOpenid: null,
        googleOpenid: googleOpenid,
      });
    }

    const accessToken = await this.buildToken(user);
    return { accessToken, newUser };
  }

  private async getWechatTokenByCode(code: string) {
    // 拿 code 换 token
    const tokenUrl = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${this.wechatAppId}&secret=${this.wechatSecret}&code=${code}&grant_type=authorization_code`;
    const tokenRes = await lastValueFrom(
      this.httpService.get<{
        access_token?: string;
        openid?: string;
        errcode: number;
      }>(tokenUrl),
    );
    if (tokenRes.data.errcode > 0) {
      throw new UnauthorizedException('微信授权失败');
    }
    return {
      accessToken: tokenRes.data.access_token,
      openid: tokenRes.data.openid,
    };
  }

  /**
   * 构建我自己的JWT令牌
   * @param user
   */
  private async buildToken(user: User): Promise<string> {
    return this.jwtService.signAsync<AuthUser>({
      userId: user.id,
      nickname: user.nickname,
      isWechatUser: user.wechatOpenid != null,
      isGoogleUser: user.googleOpenid != null,
    });
  }
}

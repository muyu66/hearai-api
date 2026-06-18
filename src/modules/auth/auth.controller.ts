import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sign-up-wechat')
  async signUpWechat(
    @Body()
    body: {
      code: string;
    },
  ): Promise<{ accessToken: string; newUser: boolean }> {
    return this.authService.signUpWechat(body.code);
  }

  @Post('sign-up-google')
  async signUpGoogle(
    @Body()
    body: {
      idToken: string;
    },
  ): Promise<{ accessToken: string; newUser: boolean }> {
    return this.authService.signUpGoogle(body.idToken);
  }
}

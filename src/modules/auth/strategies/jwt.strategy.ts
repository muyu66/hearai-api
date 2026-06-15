import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { TOKEN_KEY } from 'src/common/constants/constants';
import { AuthUser } from 'src/common/interfaces/auth-user.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          return (request?.cookies?.[TOKEN_KEY] as string | undefined) || null;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey:
        process.env.JWT_SECRET || 'hearai-secret-key-change-in-production',
    });
  }

  validate(payload: AuthUser) {
    return {
      userId: payload.userId,
      nickname: payload.nickname,
    };
  }
}

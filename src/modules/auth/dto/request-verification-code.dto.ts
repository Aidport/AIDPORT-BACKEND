import { IsEmail } from 'class-validator';

export class RequestVerificationCodeDto {
  @IsEmail()
  email: string;
}

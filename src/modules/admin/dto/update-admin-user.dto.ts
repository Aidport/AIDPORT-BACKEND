import { IsEnum, IsOptional } from 'class-validator';
import { UserAccountState } from '../../user/entities/user-account-state.enum';

export class UpdateAdminUserDto {
  @IsOptional()
  @IsEnum(UserAccountState)
  userState?: UserAccountState;
}

import { SetMetadata, createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { FeatureKey, Role } from "@manarah/shared";
import type { AuthedRequest, AuthUser } from "./types";

export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = "roles";
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const FEATURE_KEY = "feature";
export const Feature = (key: FeatureKey) => SetMetadata(FEATURE_KEY, key);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().user;
});

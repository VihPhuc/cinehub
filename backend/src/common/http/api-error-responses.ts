import { applyDecorators } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiGatewayTimeoutResponse,
  ApiServiceUnavailableResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { ApiErrorDto } from '../dto/api-response.dto';

export function ApiCommonErrors(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiBadRequestResponse({ type: ApiErrorDto, description: 'Invalid query or path' }),
    ApiTooManyRequestsResponse({
      type: ApiErrorDto,
      description: 'Rate limit exceeded; see Retry-After',
    }),
    ApiBadGatewayResponse({
      type: ApiErrorDto,
      description: 'Upstream invalid or unavailable',
    }),
    ApiServiceUnavailableResponse({
      type: ApiErrorDto,
      description: 'Upstream rate limit',
    }),
    ApiGatewayTimeoutResponse({
      type: ApiErrorDto,
      description: 'Upstream timeout',
    })
  );
}

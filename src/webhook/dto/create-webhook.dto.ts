import { IsArray, IsString, IsUrl, ArrayMinSize } from 'class-validator';

export const WEBHOOK_EVENTS = [
  'order.paid',
  'order.refunded',
  'order.shipped',
  'subscription.created',
  'subscription.expired',
] as const;

export type WebhookEvent = typeof WEBHOOK_EVENTS[number];

export class CreateWebhookDto {
  @IsUrl({ protocols: ['https'] }, { message: 'URL must use HTTPS' })
  url: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  events: WebhookEvent[];
}

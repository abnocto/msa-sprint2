import { Snowflake } from '@sapphire/snowflake';

// Snowflake ID намного больше автоинкремента монолита, поэтому не пересекаются с перенесенными бронями
const snowflake = new Snowflake(new Date('2026-01-01T00:00:00Z'));

export function nextId(): string {
  return snowflake.generate().toString();
}

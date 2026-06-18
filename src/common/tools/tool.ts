import { customAlphabet } from 'nanoid';

const generateRandomId = customAlphabet('1234567890qwertyuiopasdfghjklzxcvbnm');

/**
 * 生成随机ID
 * @returns
 */
export function makeId(size: number) {
  return generateRandomId(size);
}

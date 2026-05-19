import { customAlphabet } from "nanoid";

const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";
const gen = customAlphabet(alphabet, 10);

export function newSlug(): string {
  return gen();
}

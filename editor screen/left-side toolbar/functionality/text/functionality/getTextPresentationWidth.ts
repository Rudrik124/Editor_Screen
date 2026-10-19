export function getTextPresentationWidth(creationIndex: number): number {
  return Math.max(25, 100 - creationIndex * 20);
}

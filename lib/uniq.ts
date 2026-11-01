/** Уникальное имя канала realtime: повторная подписка на тот же топик иначе падает с ошибкой. */
export function uniq(base: string) {
  return `${base}-${Math.random().toString(36).slice(2, 10)}`;
}

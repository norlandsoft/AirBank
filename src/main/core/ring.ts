/** 定容环形缓冲：日志等滚动数据，超出容量丢弃最旧条目。 */
export class RingBuffer<T> {
  private items: T[] = []
  constructor(private readonly capacity: number) {}

  push(item: T): void {
    this.items.push(item)
    if (this.items.length > this.capacity) this.items.splice(0, this.items.length - this.capacity)
  }

  toArray(): T[] {
    return [...this.items]
  }

  clear(): void {
    this.items = []
  }

  get size(): number {
    return this.items.length
  }
}

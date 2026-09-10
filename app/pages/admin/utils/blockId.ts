/** 块编辑器的稳定 key 生成（浏览器端 crypto） */
export const newBlockId = (): string => crypto.randomUUID();

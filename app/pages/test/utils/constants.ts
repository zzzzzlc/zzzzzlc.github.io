import type { Mode } from '../types';

export const MODE_LABEL: Record<Mode, string> = {
    css: 'CSS',
    less: 'LESS',
    scss: 'SCSS',
    'css-module': 'CSS Modules',
};

/** 编译器 ESM 源（css / css-module 无需编译器） */
export const COMPILER_SRC: Partial<Record<Mode, string>> = {
    less: 'https://esm.sh/less@4.2.0',
    scss: 'https://esm.sh/sass@1.77.8',
};

export const DEFAULT_HTML = `<div class="grid-container">
  <div class="grid-item">1</div>
  <div class="grid-item">2</div>
  <div class="grid-item">3</div>
  <div class="grid-item">4</div>
  <div class="grid-item">5</div>
  <div class="grid-item">6</div>
  <div class="grid-item">7</div>
  <div class="grid-item">8</div>
  <div class="grid-item">9</div>
</div>`;

export const DEFAULT_CSS: Record<Mode, string> = {
    css: `.grid-container {
  display: grid;
  grid-template-columns: auto auto auto;
  grid-gap: 20px;
  padding: 10px;
  background-color: cadetblue;
  justify-content: space-around;
}
.grid-item {
  background-color: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(0, 0, 0, 0.8);
  padding: 20px;
  font-size: 30px;
  text-align: center;
}`,
    less: `@gap: 20px;
@item-bg: rgba(255, 255, 255, 0.8);

.grid-container {
  display: grid;
  grid-template-columns: repeat(3, auto);
  grid-gap: @gap;
  padding: 10px;
  background-color: cadetblue;
  justify-content: space-around;

  .grid-item {
    background-color: @item-bg;
    border: 1px solid rgba(0, 0, 0, 0.8);
    padding: @gap;
    font-size: 30px;
    text-align: center;
  }
}`,
    scss: `$gap: 20px;
$item-bg: rgba(255, 255, 255, 0.8);

.grid-container {
  display: grid;
  grid-template-columns: auto auto auto;
  grid-gap: $gap;
  padding: 10px;
  background-color: cadetblue;
  justify-content: space-around;

  .grid-item {
    background-color: $item-bg;
    border: 1px solid rgba(0, 0, 0, 0.8);
    padding: $gap;
    font-size: 30px;
    text-align: center;
  }
}`,
    'css-module': `/* 类名会被自动 hash 改写，HTML class 同步重命名 */
.grid-container {
  display: grid;
  grid-template-columns: auto auto auto;
  grid-gap: 20px;
  padding: 10px;
  background-color: cadetblue;
  justify-content: space-around;
}
.grid-item {
  background-color: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(0, 0, 0, 0.8);
  padding: 20px;
  font-size: 30px;
  text-align: center;
}`,
};

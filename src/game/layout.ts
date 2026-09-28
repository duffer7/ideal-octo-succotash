import Phaser from 'phaser';
import { getSafeBounds } from './safeArea';

/** Описание одной ячейки сетки. */
export interface GridCell {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Индексы строки/столбца (0-based). */
  row: number;
  col: number;
}

/** Параметры раскладки сетки. */
export interface GridOptions {
  /** Сколько колонок максимум. */
  maxColumns: number;
  /** Сколько строк максимум (может быть уменьшено, если не влезает). */
  maxRows: number;
  /** Отступы внутри безопасной зоны. */
  padding?: number;
  /** Промежуток между ячейками. */
  gap?: number;
  /** Ограничение на соотношение сторон ячейки (width/height). */
  maxAspect?: number;
  /**
   * Дополнительный отступ сверху (логические пиксели): резервирует место
   * под заголовок/шапку, чтобы сетка не наезжала на верхние элементы.
   */
  topOffset?: number;
}

/**
 * Строит адаптивную сетку, вписанную в безопасную зону экрана.
 * Число строк/колонок подбирается так, чтобы ячейки сохраняли
 * читаемый размер при любой ориентации и размере экрана.
 *
 * @param scene - Phaser.Scene (для доступа к scale)
 * @param count - сколько ячеек нужно разместить
 */
export function buildGrid(
  scene: Phaser.Scene,
  count: number,
  options: GridOptions,
): GridCell[] {
  const { maxColumns, maxRows, padding = 24, gap = 20, maxAspect = 1.6, topOffset = 0 } = options;

  const bounds = getSafeBounds(scene.scale, padding);

  // Освобождаем место сверху под заголовок и т.п.
  const availHeight = bounds.height - topOffset;

  // Ищем наилучшее число колонок: стараемся заполнить площадь равномерно.
  let best: { cols: number; rows: number; cellW: number; cellH: number } | null =
    null;

  for (let cols = maxColumns; cols >= 1; cols--) {
    const rows = Math.ceil(count / cols);
    if (rows > maxRows) continue;

    const cellW = (bounds.width - gap * (cols - 1)) / cols;
    const cellH = (availHeight - gap * (rows - 1)) / rows;

    if (cellW <= 0 || cellH <= 0) continue;

    // Не даём ячейкам становиться слишком вытянутыми.
    const aspect = cellW / cellH;
    const area = cellW * cellH;

    // Оценка: чем больше площадь и чем ближе соотношение к 1, тем лучше,
    // но жёстко ограничиваем перекос через maxAspect.
    const score = aspect > maxAspect || aspect < 1 / maxAspect ? area * 0.5 : area;

    if (!best || score > best.cellW * best.cellH) {
      best = { cols, rows, cellW, cellH };
    }
  }

  if (!best) {
    // Полный fallback: одна ячейка на всю площадь.
    return [
      {
        x: bounds.centerX,
        y: bounds.centerY,
        width: bounds.width,
        height: availHeight,
        row: 0,
        col: 0,
      },
    ];
  }

  const { cols, rows, cellW, cellH } = best;

  // Сдвигаем сетку к левому верхнему углу безопасной зоны, центрируя по вертикали.
  const totalW = cellW * cols + gap * (cols - 1);
  const totalH = cellH * rows + gap * (rows - 1);
  const startX = bounds.x + (bounds.width - totalW) / 2 + cellW / 2;
  const startY = bounds.y + topOffset + (availHeight - totalH) / 2 + cellH / 2;

  const cells: GridCell[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    cells.push({
      x: startX + col * (cellW + gap),
      y: startY + row * (cellH + gap),
      width: cellW,
      height: cellH,
      row,
      col,
    });
  }

  return cells;
}

/** Возвращает размер шрифта, пропорциональный меньшей стороне ячейки. */
export function fontForCell(cell: GridCell, factor = 0.4): number {
  return Math.min(cell.width, cell.height) * factor;
}



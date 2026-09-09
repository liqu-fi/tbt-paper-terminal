import { useLayoutEffect, useRef, useState } from "react";

/** Высота одной строки книги. Один в один с `h-[18px]` из `BookRow`. */
export const BOOK_ROW_PX = 18;

/**
 * Сколько пикселей внутри сетки занято не строками.
 *
 * @remarks Слагаемые прибиты классами фиксированной высоты в `BookGrid`, иначе
 * счёт разъехался бы от смены шрифта: шапка колонок `h-[22px]` + строка спреда
 * `h-7` (28px) + полоса дисбаланса `mt-1 h-4` (20px).
 */
const GRID_CHROME_PX = 22 + 28 + 20;

/** Меньше четырёх строк на сторону — уже не книга, а огрызок. */
const MIN_SLOTS = 4;
/**
 * Потолок запроса к шлюзу. Книга на большом экране не должна превращать
 * `depth` в неограниченное число: строк всё равно не видно больше, чем помещается.
 */
const MAX_SLOTS = 25;

interface BookSlots {
  /** Ref на контейнер сетки — за его высотой и следим. */
  ref: (node: HTMLElement | null) => void;
  /** Число слотов НА СТОРОНУ при текущей высоте панели. */
  slots: number;
}

/**
 * Считает число слотов книги от фактической высоты её контейнера.
 *
 * @remarks Раньше это были две константы (10 «на обе стороны», 20 в одностороннем
 * режиме) — число, взятое из макета, а не из экрана. На панели высотой 318px
 * (1280×800) сетка занимала 525px: 207px книги рисовались за пределами карточки,
 * поверх нижней панели. На большом мониторе та же константа оставляла пустоту.
 * Высота строки фиксирована (`BookRow`), поэтому обратный счёт точен.
 *
 * Одно число уходит и в сетку, и в `depth` запроса книги: разойдясь, они дали бы
 * половину пустой сетки (запрошено меньше, чем показываем) или лишний трафик.
 */
export function useBookSlots(sides: 1 | 2): BookSlots {
  const [height, setHeight] = useState(0);
  // Наблюдатель переживает смену узла: ref-колбэк только переподписывает его.
  const observer = useRef<ResizeObserver | null>(null);

  useLayoutEffect(() => {
    return () => {
      observer.current?.disconnect();
      observer.current = null;
    };
  }, []);

  const ref = (node: HTMLElement | null) => {
    observer.current?.disconnect();
    if (!node) return;
    setHeight(node.clientHeight);
    // ResizeObserver есть и в jsdom-окружении тестов не всегда — без него
    // остаётся первое измерение, а это лучше, чем падение при рендере.
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      setHeight(entry.contentRect.height);
    });
    ro.observe(node);
    observer.current = ro;
  };

  return { ref, slots: slotsForHeight(height, sides) };
}

/**
 * Чистая часть счёта — её и проверяет юнит-тест.
 *
 * @remarks Нулевая высота (первый кадр, до измерения) даёт минимум, а не ноль:
 * пустая сетка на один кадр мигала бы при каждой смене вкладки.
 */
export function slotsForHeight(height: number, sides: 1 | 2): number {
  const rows = Math.floor((height - GRID_CHROME_PX) / BOOK_ROW_PX / sides);
  return Math.min(MAX_SLOTS, Math.max(MIN_SLOTS, rows));
}

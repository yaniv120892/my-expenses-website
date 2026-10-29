export function requireInput(element: Element | null): HTMLInputElement {
  if (!(element instanceof HTMLInputElement)) {
    throw new Error(`expected an <input>, got ${element?.tagName ?? 'nothing'}`);
  }
  return element;
}

export function requireAt({
  elements,
  index,
}: {
  elements: HTMLElement[];
  index: number;
}): HTMLElement {
  const element = elements[index];
  if (!element) {
    throw new Error(`expected at least ${index + 1} elements, found ${elements.length}`);
  }
  return element;
}

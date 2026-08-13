export type VisionItem = { id: string; text: string };

function createId() {
  return `vision-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function normalizeVision(value: unknown): VisionItem[] {
  if (Array.isArray(value)) {
    const items = value.flatMap((item, index) => {
      if (!item || typeof item !== "object") return [];
      const source = item as Partial<VisionItem>;
      return [{
        id: typeof source.id === "string" && source.id ? source.id : `vision-${index}`,
        text: typeof source.text === "string" ? source.text : "",
      }];
    });
    return items.length ? items : [{ id: createId(), text: "" }];
  }

  if (typeof value === "string") {
    const lines = value
      .split("\n")
      .map((line) => line.replace(/^\s*(?:#\s*|[-*+]\s+|\d+\.\s+)/, "").trim())
      .filter(Boolean);
    return lines.length
      ? lines.map((text) => ({ id: createId(), text }))
      : [{ id: createId(), text: "" }];
  }

  return [{ id: createId(), text: "" }];
}

export function createVisionItem(): VisionItem {
  return { id: createId(), text: "" };
}

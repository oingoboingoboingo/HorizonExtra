/**
 * Personal Horizon mod: Multi-character dialogue colors
 *
 * Drop this file into the `chat/` folder of your Horizon source.
 */

import Vue from 'vue';

export type CharacterMode = 'both' | 'name' | 'quotes';

export interface CharacterSlot {
  name: string;
  color: string;
}

export const AVAILABLE_COLORS = [
  'red',
  'orange',
  'yellow',
  'green',
  'cyan',
  'purple',
  'blue',
  'pink',
  'black',
  'brown',
  'white',
  'gray'
] as const;

export type AvailableColor = (typeof AVAILABLE_COLORS)[number];

const STORAGE_KEY = 'horizon-personal-character-colors-v2';

interface StoredState {
  slots: CharacterSlot[];
  nameEnabled: boolean[]; // which characters color their name (multiple ok)
  quotesIndex: number; // which character colors quotes (-1 = none, only one)
  recolorExisting: boolean;
}

function defaultSlots(): CharacterSlot[] {
  return [
    { name: 'Character 1', color: 'cyan' },
    { name: 'Character 2', color: 'red' },
    { name: 'Character 3', color: 'yellow' },
    { name: 'Character 4', color: 'green' },
    { name: 'Character 5', color: 'purple' }
  ];
}

function loadFromStorage(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const slots = Array.isArray(parsed.slots)
        ? parsed.slots.slice(0, 5).map((s: any) => ({
            name: String(s.name || ''),
            color: AVAILABLE_COLORS.includes(s.color) ? s.color : 'cyan'
          }))
        : defaultSlots();

      // pad / clamp nameEnabled
      let nameEnabled: boolean[] = Array.isArray(parsed.nameEnabled)
        ? parsed.nameEnabled.slice(0, 5).map((v: any) => !!v)
        : [false, false, false, false, false];
      while (nameEnabled.length < 5) nameEnabled.push(false);

      const quotesIndex =
        typeof parsed.quotesIndex === 'number' &&
        parsed.quotesIndex >= -1 &&
        parsed.quotesIndex < 5
          ? parsed.quotesIndex
          : -1;

      return {
        slots,
        nameEnabled,
        quotesIndex,
        recolorExisting: !!parsed.recolorExisting
      };
    }
  } catch (e) {
    console.warn('[CharacterColors] Failed to load settings', e);
  }
  return {
    slots: defaultSlots(),
    nameEnabled: [false, false, false, false, false],
    quotesIndex: -1,
    recolorExisting: false
  };
}

function saveToStorage(state: StoredState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('[CharacterColors] Failed to save settings', e);
  }
}

const initial = loadFromStorage();

export const characterColorStore = Vue.observable({
  slots: initial.slots as CharacterSlot[],
  nameEnabled: initial.nameEnabled as boolean[],
  quotesIndex: initial.quotesIndex as number,
  recolorExisting: initial.recolorExisting as boolean,

  /** Is this character currently highlighted? (has name and/or quotes on) */
  isHighlighted(index: number): boolean {
    if (index < 0 || index >= 5) return false;
    return this.nameEnabled[index] || this.quotesIndex === index;
  },

  /** Does this character currently color names? */
  hasName(index: number): boolean {
    return !!this.nameEnabled[index];
  },

  /** Does this character currently color quotes? */
  hasQuotes(index: number): boolean {
    return this.quotesIndex === index;
  },

  /** Toggle the Name (C) flag – multiple can be on */
  toggleName(index: number): void {
    if (index < 0 || index >= 5) return;
    if (!this.slots[index]?.name?.trim()) return;

    const next = [...this.nameEnabled];
    next[index] = !next[index];
    this.nameEnabled = next;
    this.persist();
  },

  /** Toggle the Quotes (") flag – only one can be on */
  toggleQuotes(index: number): void {
    if (index < 0 || index >= 5) return;
    if (!this.slots[index]?.name?.trim()) return;

    if (this.quotesIndex === index) {
      this.quotesIndex = -1; // turn off
    } else {
      this.quotesIndex = index; // take exclusive ownership
    }
    this.persist();
  },

  updateSlot(index: number, name: string, color: string): void {
    if (index < 0 || index >= 5) return;
    this.slots[index] = {
      name: name.trim(),
      color: AVAILABLE_COLORS.includes(color as any) ? color : 'cyan'
    };
    this.slots = [...this.slots];

    // If the slot is now empty, clear its flags
    if (!this.slots[index].name) {
      const next = [...this.nameEnabled];
      next[index] = false;
      this.nameEnabled = next;
      if (this.quotesIndex === index) this.quotesIndex = -1;
    }
    this.persist();
  },

  setRecolorExisting(value: boolean): void {
    this.recolorExisting = value;
    this.persist();
  },

  persist(): void {
    saveToStorage({
      slots: this.slots,
      nameEnabled: this.nameEnabled,
      quotesIndex: this.quotesIndex,
      recolorExisting: this.recolorExisting
    });
  }
});

/**
 * Live coloring while typing.
 * Checks all characters that have Name enabled for exact name matches,
 * and the single character that has Quotes enabled for "..." pairs.
 */
export function applyLiveColoring(
  text: string,
  cursorPos: number,
  previousTextLength?: number
): { newText: string; newCursor: number } | null {
  // Skip deletions / backspace
  if (
    previousTextLength !== undefined &&
    text.length < previousTextLength
  ) {
    return null;
  }

  // 1. Name matches
  //    Rules:
  //    - Full configured name is matched
  //    - Each individual word of a multi-word name is matched
  //    - SPECIAL: if the previous word + current word form a configured
  //      multi-word name (e.g. "Shirakami" then immediately "Fubuki"),
  //      the current word inherits that character's color.
  //      This does NOT trigger across other words:
  //      "Kurokami fucks Fubuki" will NOT color Fubuki red.
  //    Priority when multiple match:
  //      1. Longer match wins
  //      2. Character that owns Quotes (") wins
  //      3. Lower slot index wins
  {
    interface Candidate {
      index: number;
      start: number;
      length: number;
      color: string;
      matchedText: string;
      score: number; // higher = better (used for pair matches)
    }
    const candidates: Candidate[] = [];

    // Helper: get the word immediately before `pos` (skipping BBCode tags)
    function getPreviousWord(
      src: string,
      pos: number
    ): { word: string; start: number } | null {
      // Walk left over whitespace
      let i = pos - 1;
      while (i >= 0 && /\s/.test(src[i])) i--;
      if (i < 0) return null;

      // Skip a closing [/color] tag if present
      if (src[i] === ']') {
        const tagStart = src.lastIndexOf('[', i);
        if (tagStart >= 0 && src.slice(tagStart, i + 1).startsWith('[/color]')) {
          i = tagStart - 1;
          while (i >= 0 && /\s/.test(src[i])) i--;
        }
      }
      // Skip an opening [color=...] tag if we landed inside/after one
      if (i >= 0 && src[i] === ']') {
        const tagStart = src.lastIndexOf('[', i);
        if (tagStart >= 0 && /^\[color=[a-z]+\]$/i.test(src.slice(tagStart, i + 1))) {
          i = tagStart - 1;
          while (i >= 0 && /\s/.test(src[i])) i--;
        }
      }

      if (i < 0 || /[\s\[\]"'.,!?;:\n]/.test(src[i])) return null;

      // Read the word
      let end = i + 1;
      while (i >= 0 && !/[\s\[\]"'.,!?;:\n]/.test(src[i])) i--;
      const start = i + 1;
      const word = src.slice(start, end);
      // Strip any color tags that might still be glued
      const clean = word.replace(/\[\/?color(?:=[a-z]+)?\]/gi, '');
      if (!clean) return null;
      return { word: clean, start };
    }

    for (let i = 0; i < 5; i++) {
      if (!characterColorStore.nameEnabled[i]) continue;
      const slot = characterColorStore.slots[i];
      if (!slot || !slot.name) continue;

      const words = slot.name.split(/\s+/).filter(w => w.length > 0);
      const parts = new Set<string>();
      parts.add(slot.name);
      for (const w of words) parts.add(w);

      for (const part of parts) {
        if (cursorPos < part.length) continue;
        const start = cursorPos - part.length;
        const candidate = text.slice(start, cursorPos);
        if (candidate !== part) continue;

        const beforeChar = start > 0 ? text[start - 1] : undefined;
        const afterChar =
          cursorPos < text.length ? text[cursorPos] : undefined;
        const isBoundary =
          (beforeChar === undefined ||
            /[\s\[\]"'.,!?;:\n]/.test(beforeChar)) &&
          (afterChar === undefined ||
            /[\s\[\]"'.,!?;:\n]/.test(afterChar));

        if (!isBoundary) continue;

        const openTag = `[color=${slot.color}]`;
        const closeTag = `[/color]`;
        if (isAlreadyColored(text, start, cursorPos, openTag, closeTag))
          continue;

        candidates.push({
          index: i,
          start,
          length: part.length,
          color: slot.color,
          matchedText: part,
          score: part.length // base score = length
        });
      }

      // Pair / chain check: previous word + current word
      // Only for multi-word names (2+ words)
      if (words.length >= 2) {
        // Check every adjacent pair in the configured name
        for (let w = 0; w < words.length - 1; w++) {
          const prevExpected = words[w];
          const currExpected = words[w + 1];

          if (cursorPos < currExpected.length) continue;
          const start = cursorPos - currExpected.length;
          const candidate = text.slice(start, cursorPos);
          if (candidate !== currExpected) continue;

          const beforeChar = start > 0 ? text[start - 1] : undefined;
          const afterChar =
            cursorPos < text.length ? text[cursorPos] : undefined;
          const isBoundary =
            (beforeChar === undefined ||
              /[\s\[\]"'.,!?;:\n]/.test(beforeChar)) &&
            (afterChar === undefined ||
              /[\s\[\]"'.,!?;:\n]/.test(afterChar));
          if (!isBoundary) continue;

          const prev = getPreviousWord(text, start);
          if (!prev || prev.word !== prevExpected) continue;

          const openTag = `[color=${slot.color}]`;
          const closeTag = `[/color]`;
          if (isAlreadyColored(text, start, cursorPos, openTag, closeTag))
            continue;

          // Boost score so pair matches beat a lone "Fubuki" from another char
          candidates.push({
            index: i,
            start,
            length: currExpected.length,
            color: slot.color,
            matchedText: currExpected,
            score: currExpected.length + 1000 // pair bonus
          });
        }
      }
    }

    if (candidates.length > 0) {
      const quotesOwner = characterColorStore.quotesIndex;
      candidates.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.index === quotesOwner) return -1;
        if (b.index === quotesOwner) return 1;
        return a.index - b.index;
      });

      const best = candidates[0];
      const openTag = `[color=${best.color}]`;
      const closeTag = `[/color]`;
      const wrapped = openTag + best.matchedText + closeTag;
      const newText =
        text.slice(0, best.start) + wrapped + text.slice(cursorPos);
      return { newText, newCursor: best.start + wrapped.length };
    }
  }

  // 2. Quote pair (only the single character that owns Quotes)
  if (characterColorStore.quotesIndex >= 0) {
    const slot = characterColorStore.slots[characterColorStore.quotesIndex];
    if (slot && slot.name && cursorPos > 0 && text[cursorPos - 1] === '"') {
      const color = slot.color;
      const openTag = `[color=${color}]`;
      const closeTag = `[/color]`;

      let openPos = -1;
      for (let i = cursorPos - 2; i >= 0; i--) {
        if (text[i] === '"') {
          openPos = i;
          break;
        }
        if (
          text[i] === ']' &&
          text.slice(Math.max(0, i - 6), i + 1).includes('[/color]')
        ) {
          break;
        }
      }

      if (openPos >= 0) {
        const quoted = text.slice(openPos, cursorPos);
        if (
          !quoted.includes('[color=') &&
          !quoted.includes('[/color]') &&
          !isAlreadyColored(text, openPos, cursorPos, openTag, closeTag)
        ) {
          const wrapped = openTag + quoted + closeTag;
          const newText =
            text.slice(0, openPos) + wrapped + text.slice(cursorPos);
          return { newText, newCursor: openPos + wrapped.length };
        }
      }
    }
  }

  return null;
}

function isAlreadyColored(
  text: string,
  start: number,
  end: number,
  openTag: string,
  closeTag: string
): boolean {
  const lookBehind = text.slice(
    Math.max(0, start - openTag.length - 2),
    start
  );
  const lookAhead = text.slice(end, end + closeTag.length + 2);
  if (lookBehind.endsWith(openTag) && lookAhead.startsWith(closeTag)) {
    return true;
  }
  const slice = text.slice(start, end);
  if (slice.includes('[color=') || slice.includes('[/color]')) {
    return true;
  }
  return false;
}

/**
 * Retrospective recolor (when the toggle is on).
 * Applies all currently-enabled Name and Quotes rules.
 */
export function recolorExistingText(text: string): string {
  let result = text;

  // Names – full name + each individual word
  // Process longer names first so "Shirakami Fubuki" is preferred over just "Fubuki"
  const nameJobs: { part: string; color: string; index: number }[] = [];
  for (let i = 0; i < 5; i++) {
    if (!characterColorStore.nameEnabled[i]) continue;
    const slot = characterColorStore.slots[i];
    if (!slot || !slot.name) continue;

    const parts = new Set<string>();
    parts.add(slot.name);
    for (const word of slot.name.split(/\s+/)) {
      if (word.length > 0) parts.add(word);
    }
    for (const part of parts) {
      nameJobs.push({ part, color: slot.color, index: i });
    }
  }

  // Longer first, then prefer quotes owner
  const quotesOwner = characterColorStore.quotesIndex;
  nameJobs.sort((a, b) => {
    if (b.part.length !== a.part.length) return b.part.length - a.part.length;
    if (a.index === quotesOwner) return -1;
    if (b.index === quotesOwner) return 1;
    return a.index - b.index;
  });

  for (const job of nameJobs) {
    const nameRegex = new RegExp(
      `(?<!\\[color=[a-z]+\\])\\b${escapeRegExp(job.part)}\\b(?!\\[/color\\])`,
      'g'
    );
    result = result.replace(
      nameRegex,
      `[color=${job.color}]$&[/color]`
    );
  }

  // Quotes (single owner)
  if (characterColorStore.quotesIndex >= 0) {
    const slot = characterColorStore.slots[characterColorStore.quotesIndex];
    if (slot) {
      const color = slot.color;
      result = result.replace(
        /(?<!\[color=[a-z]+\])"([^"]*?)"(?!\[\/color\])/g,
        `[color=${color}]"$1"[/color]`
      );
    }
  }

  return result;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

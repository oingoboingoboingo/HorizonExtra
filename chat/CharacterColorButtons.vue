<template>
  <div class="character-color-buttons">
    <div class="d-flex justify-content-between align-items-center mb-1">
      <small class="text-muted text-uppercase" style="letter-spacing: 0.05em"
        >Dialogue Colors</small
      >
      <button
        class="btn btn-link btn-sm p-0"
        title="Configure character names & colors"
        @click="$emit('open-settings')"
      >
        <i class="fas fa-cog"></i>
      </button>
    </div>

    <div class="btn-list">
      <div
        v-for="(slot, index) in slots"
        :key="index"
        class="character-row"
        :class="{
          active: isHighlighted(index),
          disabled: !slot.name.trim()
        }"
      >
        <!-- Main label -->
        <div
          class="character-label"
          :class="{ active: isHighlighted(index) }"
          :style="isHighlighted(index) ? activeStyle(slot.color) : {}"
          :title="slot.name || 'Empty slot – configure in settings'"
        >
          <span class="color-dot" :class="slot.color + '-dot'"></span>
          <span class="btn-label">{{ slot.name || '—' }}</span>
        </div>

        <!-- Mode toggles: " = quotes (exclusive), C = name (multiple) -->
        <div class="mode-toggles" v-if="slot.name.trim()">
          <button
            type="button"
            class="mode-btn"
            :class="{ on: hasQuotes(index) }"
            title='Color quotation marks "..." (only one at a time)'
            @click.stop="toggleQuotes(index)"
          >
            "
          </button>
          <button
            type="button"
            class="mode-btn"
            :class="{ on: hasName(index) }"
            title="Color this character name (multiple allowed)"
            @click.stop="toggleName(index)"
          >
            C
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
  import Vue from 'vue';
  import { characterColorStore, CharacterSlot } from './characterColors';

  export default Vue.extend({
    computed: {
      slots(): CharacterSlot[] {
        return characterColorStore.slots;
      }
    },
    methods: {
      isHighlighted(index: number): boolean {
        return characterColorStore.isHighlighted(index);
      },
      hasName(index: number): boolean {
        return characterColorStore.hasName(index);
      },
      hasQuotes(index: number): boolean {
        return characterColorStore.hasQuotes(index);
      },
      toggleName(index: number): void {
        characterColorStore.toggleName(index);
        this.$emit('active-changed');
      },
      toggleQuotes(index: number): void {
        characterColorStore.toggleQuotes(index);
        this.$emit('active-changed');
      },
      activeStyle(color: string): Record<string, string> {
        const map: Record<string, string> = {
          red: '#ff4444',
          orange: '#ff9944',
          yellow: '#dddd44',
          green: '#44cc44',
          cyan: '#44cccc',
          purple: '#aa66ff',
          blue: '#4488ff',
          pink: '#ff88cc',
          black: '#666',
          brown: '#aa8844',
          white: '#eee',
          gray: '#999'
        };
        const bg = map[color] || '#888';
        return {
          backgroundColor: bg,
          borderColor: bg,
          color: color === 'white' || color === 'yellow' ? '#111' : '#fff'
        };
      }
    }
  });
</script>

<style scoped>
  .character-color-buttons {
    padding: 8px 10px 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    margin-top: 6px;
  }
  .btn-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .character-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .character-row.disabled {
    opacity: 0.45;
  }
  .character-label {
    display: flex;
    align-items: center;
    gap: 8px;
    text-align: left;
    justify-content: flex-start;
    font-size: 0.85rem;
    padding: 4px 8px;
    flex: 1;
    min-width: 0;
    border-radius: 4px;
    border: 1px solid transparent;
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.55);
  }
  .character-label.active {
    font-weight: 600;
  }
  .btn-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .color-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    border: 1px solid rgba(0, 0, 0, 0.3);
  }

  .mode-toggles {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }
  .mode-btn {
    width: 22px;
    height: 22px;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.25);
    color: rgba(255, 255, 255, 0.35);
    font-size: 0.75rem;
    font-weight: 700;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.12s ease;
  }
  .mode-btn:hover {
    border-color: rgba(255, 255, 255, 0.35);
    color: rgba(255, 255, 255, 0.7);
  }
  .mode-btn.on {
    background: rgba(255, 255, 255, 0.18);
    border-color: rgba(255, 255, 255, 0.45);
    color: #fff;
  }

  .red-dot {
    background: #f00;
  }
  .orange-dot {
    background: #f90;
  }
  .yellow-dot {
    background: #ff0;
  }
  .green-dot {
    background: #0f0;
  }
  .cyan-dot {
    background: #0ff;
  }
  .purple-dot {
    background: #93f;
  }
  .blue-dot {
    background: #00f;
  }
  .pink-dot {
    background: #f9c;
  }
  .black-dot {
    background: #000;
  }
  .brown-dot {
    background: #8a6d3b;
  }
  .white-dot {
    background: #fff;
  }
  .gray-dot {
    background: #ccc;
  }
</style>

<template>
  <modal
    action="Character Name + Colors"
    ref="dialog"
    dialogClass="modal-lg"
    iconClass="fas fa-palette"
    :buttons="true"
    @submit="save"
  >
    <div class="character-color-settings">
      <p class="text-muted mb-3">
        Configure up to 5 characters. Use the <strong>"</strong> and
        <strong>C</strong> buttons in the sidebar to choose what each character
        colors:
        <br />
        <strong>"</strong> = quotation marks (only one at a time) &nbsp;·&nbsp;
        <strong>C</strong> = character name (multiple allowed)
      </p>

      <div
        v-for="(slot, index) in localSlots"
        :key="index"
        class="slot-row d-flex align-items-center mb-2 gap-2"
      >
        <span class="slot-number text-muted" style="width: 1.5rem">{{
          index + 1
        }}</span>

        <input
          type="text"
          class="form-control form-control-sm"
          v-model="localSlots[index].name"
          :placeholder="'Character ' + (index + 1)"
          maxlength="40"
          style="max-width: 180px"
        />

        <select
          class="form-select form-select-sm"
          v-model="localSlots[index].color"
          style="max-width: 120px"
        >
          <option v-for="c in availableColors" :key="c" :value="c">
            {{ c }}
          </option>
        </select>

        <span
          class="color-preview"
          :class="localSlots[index].color + 'Text'"
          :title="localSlots[index].color"
        >
          Aa
        </span>
      </div>

      <hr />

      <div class="form-check">
        <input
          class="form-check-input"
          type="checkbox"
          id="recolorExisting"
          v-model="localRecolorExisting"
        />
        <label class="form-check-label" for="recolorExisting">
          Also recolor existing names and quotes when I activate a character
        </label>
        <div class="form-text">
          When enabled, turning on a Name or Quotes button will also scan the
          current message and wrap matching text that is not already colored.
        </div>
      </div>
    </div>
  </modal>
</template>

<script lang="ts">
  import Vue from 'vue';
  import Modal from '../components/Modal.vue';
  import {
    characterColorStore,
    AVAILABLE_COLORS,
    CharacterSlot
  } from './characterColors';

  export default Vue.extend({
    components: { modal: Modal },
    data() {
      return {
        localSlots: [] as CharacterSlot[],
        localRecolorExisting: false,
        availableColors: AVAILABLE_COLORS
      };
    },
    methods: {
      open(): void {
        this.localSlots = characterColorStore.slots.map(s => ({
          name: s.name,
          color: s.color
        }));
        this.localRecolorExisting = characterColorStore.recolorExisting;
        (this.$refs.dialog as any).show();
      },
      save(): void {
        for (let i = 0; i < 5; i++) {
          const slot = this.localSlots[i] || { name: '', color: 'cyan' };
          characterColorStore.updateSlot(i, slot.name, slot.color);
        }
        characterColorStore.setRecolorExisting(this.localRecolorExisting);
        (this.$refs.dialog as any).hide();
      }
    }
  });
</script>

<style scoped>
  .slot-row {
    gap: 0.5rem;
  }
  .color-preview {
    font-weight: bold;
    min-width: 2rem;
    text-align: center;
  }
  .redText {
    color: #f00;
  }
  .orangeText {
    color: #f90;
  }
  .yellowText {
    color: #ff0;
  }
  .greenText {
    color: #0f0;
  }
  .cyanText {
    color: #0ff;
  }
  .purpleText {
    color: #93f;
  }
  .blueText {
    color: #00f;
  }
  .pinkText {
    color: #f9c;
  }
  .blackText {
    color: #000;
  }
  .brownText {
    color: #8a6d3b;
  }
  .whiteText {
    color: #fff;
    text-shadow: 0 0 1px #000;
  }
  .grayText {
    color: #ccc;
  }
</style>
